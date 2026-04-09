const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const { costFunction, liquidityCost, getPrices } = require('../math/market');

const router = express.Router();

// POST /markets/:marketId/statement — create a statement market
router.post('/markets/:marketId/statement', authMiddleware, async (req, res) => {
  const { marketId } = req.params;
  const { probabilities, liquidity_beta, end_time } = req.body;

  if (!probabilities || !liquidity_beta || !end_time) {
    return res.status(400).json({ error: 'probabilities, liquidity_beta and end_time are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const marketResult = await client.query('SELECT * FROM markets WHERE id = $1 FOR UPDATE', [marketId]);
    if (!marketResult.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Market not found' });
    }
    const market = marketResult.rows[0];

    if (market.status !== 'active') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Market is not active' });
    }
    if (new Date(market.end_time) > new Date()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Market has not ended yet' });
    }
    if (probabilities.length !== market.outcomes.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Expected ${market.outcomes.length} probabilities` });
    }

    const probSum = probabilities.reduce((a, b) => a + b, 0);
    const normalizedProbs = probabilities.map(p => p / probSum);
    if (normalizedProbs.some(p => p <= 0 || p >= 1)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'All probabilities must be strictly between 0 and 1' });
    }

    const endDate = new Date(end_time);
    if (isNaN(endDate.getTime()) || endDate <= new Date()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'end_time must be in the future' });
    }
    if (liquidity_beta <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'liquidity_beta must be positive' });
    }

    const L = liquidityCost(normalizedProbs, liquidity_beta);
    const makerQuantities = new Array(market.outcomes.length).fill(0);

    // Check balance
    const userResult = await client.query('SELECT balance FROM users WHERE id = $1 FOR UPDATE', [req.user.id]);
    if (userResult.rows[0].balance < L) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Insufficient balance. Need ${L.toFixed(4)}` });
    }

    await client.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [L, req.user.id]);
    await client.query('UPDATE markets SET status = $1 WHERE id = $2', ['pending_resolution', marketId]);

    const stmtResult = await client.query(
      `INSERT INTO statement_markets (original_market_id, creator_id, probabilities, liquidity_beta, end_time, maker_quantities, liquidity_cost)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [marketId, req.user.id, normalizedProbs, liquidity_beta, endDate, makerQuantities, L]
    );
    const stmt = stmtResult.rows[0];

    await client.query(
      'INSERT INTO statement_positions (statement_market_id, user_id, quantities) VALUES ($1, $2, $3)',
      [stmt.id, req.user.id, makerQuantities]
    );

    await client.query(
      'INSERT INTO ledger (user_id, amount, description, reference_id, reference_type) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, -L, `Created statement market for ${marketId}`, stmt.id, 'statement_creation']
    );

    await client.query('COMMIT');
    res.status(201).json({ statement_market: stmt });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// POST /statement/:id/take — trade in statement market
router.post('/:id/take', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { delta_quantities } = req.body;

  if (!delta_quantities || !Array.isArray(delta_quantities)) {
    return res.status(400).json({ error: 'delta_quantities array is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const stmtResult = await client.query('SELECT * FROM statement_markets WHERE id = $1 FOR UPDATE', [id]);
    if (!stmtResult.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Statement market not found' });
    }
    const stmt = stmtResult.rows[0];

    if (stmt.status !== 'active') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Statement market is not active (status: ${stmt.status})` });
    }
    if (new Date(stmt.end_time) <= new Date()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Statement market has expired' });
    }

    // Get original market for outcomes count
    const origResult = await client.query('SELECT outcomes FROM markets WHERE id = $1', [stmt.original_market_id]);
    const nOutcomes = origResult.rows[0].outcomes.length;

    if (delta_quantities.length !== nOutcomes) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Expected ${nOutcomes} delta quantities` });
    }

    const { maker_quantities, probabilities, liquidity_beta } = stmt;

    const C_before = costFunction(maker_quantities, probabilities, liquidity_beta);
    const new_maker_quantities = maker_quantities.map((q, i) => q + delta_quantities[i]);
    const C_after = costFunction(new_maker_quantities, probabilities, liquidity_beta);
    const deltaC = C_after - C_before;
    const delta_min = Math.min(...delta_quantities);
    const netCost = deltaC - delta_min;

    const userResult = await client.query('SELECT balance FROM users WHERE id = $1 FOR UPDATE', [req.user.id]);
    if (userResult.rows[0].balance < netCost) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Insufficient balance. Trade costs ${netCost.toFixed(4)}` });
    }

    await client.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [netCost, req.user.id]);
    await client.query('UPDATE statement_markets SET maker_quantities = $1 WHERE id = $2', [new_maker_quantities, id]);

    const existingPos = await client.query(
      'SELECT * FROM statement_positions WHERE statement_market_id = $1 AND user_id = $2 FOR UPDATE',
      [id, req.user.id]
    );
    if (existingPos.rows[0]) {
      const newQty = existingPos.rows[0].quantities.map((q, i) => q + delta_quantities[i]);
      await client.query(
        'UPDATE statement_positions SET quantities = $1, updated_at = NOW() WHERE statement_market_id = $2 AND user_id = $3',
        [newQty, id, req.user.id]
      );
    } else {
      await client.query(
        'INSERT INTO statement_positions (statement_market_id, user_id, quantities) VALUES ($1, $2, $3)',
        [id, req.user.id, delta_quantities]
      );
    }

    // Update maker position
    const makerPos = await client.query(
      'SELECT * FROM statement_positions WHERE statement_market_id = $1 AND user_id = $2 FOR UPDATE',
      [id, stmt.creator_id]
    );
    if (makerPos.rows[0]) {
      const newMakerQty = makerPos.rows[0].quantities.map((q, i) => q - delta_quantities[i]);
      await client.query(
        'UPDATE statement_positions SET quantities = $1, updated_at = NOW() WHERE statement_market_id = $2 AND user_id = $3',
        [newMakerQty, id, stmt.creator_id]
      );
    } else {
      await client.query(
        'INSERT INTO statement_positions (statement_market_id, user_id, quantities) VALUES ($1, $2, $3)',
        [id, stmt.creator_id, delta_quantities.map(d => -d)]
      );
    }

    await client.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [netCost, stmt.creator_id]);

    await client.query(
      'INSERT INTO ledger (user_id, amount, description, reference_id, reference_type) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, -netCost, `Trade in statement market ${id}`, id, 'statement_trade']
    );
    await client.query(
      'INSERT INTO ledger (user_id, amount, description, reference_id, reference_type) VALUES ($1, $2, $3, $4, $5)',
      [stmt.creator_id, netCost, `Received from trade in statement market ${id}`, id, 'statement_trade']
    );

    await client.query('COMMIT');
    res.json({
      success: true,
      deltaC,
      delta_min,
      net_cost: netCost,
      current_prices: getPrices(new_maker_quantities, probabilities, liquidity_beta),
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// POST /statement/:id/resolve — resolve statement market
router.post('/:id/resolve', authMiddleware, async (req, res) => {
  const { id } = req.params;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const stmtResult = await client.query('SELECT * FROM statement_markets WHERE id = $1 FOR UPDATE', [id]);
    if (!stmtResult.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Statement market not found' });
    }
    const stmt = stmtResult.rows[0];

    if (stmt.status !== 'active') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Statement market is not active (status: ${stmt.status})` });
    }
    if (new Date(stmt.end_time) > new Date()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Statement market has not ended yet' });
    }

    // Get final prices from statement market
    const finalPrices = getPrices(stmt.maker_quantities, stmt.probabilities, stmt.liquidity_beta);

    // Get all positions in both original and statement market
    const origPositions = await client.query(
      'SELECT * FROM positions WHERE market_id = $1',
      [stmt.original_market_id]
    );
    const stmtPositions = await client.query(
      'SELECT * FROM statement_positions WHERE statement_market_id = $1',
      [id]
    );

    // Settle: each participant receives dot(quantities, finalPrices) from each market they're in
    const settlements = {};

    for (const pos of origPositions.rows) {
      const payout = pos.quantities.reduce((sum, q, i) => sum + q * finalPrices[i], 0);
      settlements[pos.user_id] = (settlements[pos.user_id] || 0) + payout;
    }
    for (const pos of stmtPositions.rows) {
      const payout = pos.quantities.reduce((sum, q, i) => sum + q * finalPrices[i], 0);
      settlements[pos.user_id] = (settlements[pos.user_id] || 0) + payout;
    }

    // Apply settlements
    for (const [userId, amount] of Object.entries(settlements)) {
      if (amount !== 0) {
        await client.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [amount, userId]);
        await client.query(
          'INSERT INTO ledger (user_id, amount, description, reference_id, reference_type) VALUES ($1, $2, $3, $4, $5)',
          [userId, amount, `Settlement for statement market ${id}`, id, 'settlement']
        );
      }
    }

    // Mark both markets as resolved
    await client.query('UPDATE statement_markets SET status = $1 WHERE id = $2', ['resolved', id]);
    await client.query('UPDATE markets SET status = $1 WHERE id = $2', ['resolved', stmt.original_market_id]);

    await client.query('COMMIT');
    res.json({ success: true, final_prices: finalPrices, settlements });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
