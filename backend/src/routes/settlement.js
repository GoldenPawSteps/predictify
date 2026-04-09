const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const { costFunction, liquidityCost, getPrices, gradientDotProduct } = require('../math/market');

const router = express.Router();

// POST /settlement/markets/:marketId/statement — create a statement market
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

    const numericProbabilities = probabilities.map(p => Number(p));
    if (numericProbabilities.some(p => !Number.isFinite(p))) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'All probabilities must be valid numbers' });
    }
    const probSum = numericProbabilities.reduce((a, b) => a + b, 0);
    if (!Number.isFinite(probSum) || probSum <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Sum of probabilities must be greater than 0' });
    }
    const normalizedProbs = numericProbabilities.map(p => p / probSum);
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

    // Deduct L from statement maker's balance into statement market escrow
    await client.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [L, req.user.id]);
    await client.query('UPDATE markets SET status = $1 WHERE id = $2', ['pending_resolution', marketId]);

    const stmtResult = await client.query(
      `INSERT INTO statement_markets (original_market_id, creator_id, probabilities, liquidity_beta, end_time, maker_quantities, liquidity_cost, escrow)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [marketId, req.user.id, normalizedProbs, liquidity_beta, endDate, makerQuantities, L, L]
    );
    const stmt = stmtResult.rows[0];

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

// POST /settlement/:id/take — trade in statement market
router.post('/:id/take', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { delta_quantities } = req.body;

  if (!delta_quantities || !Array.isArray(delta_quantities)) {
    return res.status(400).json({ error: 'delta_quantities array is required' });
  }
  if (!delta_quantities.every(v => typeof v === 'number' && Number.isFinite(v))) {
    return res.status(400).json({ error: 'delta_quantities must contain only finite numbers' });
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

    // Get taker's current statement position to compute Δ_min = min(q'^t) - min(q^t)
    const takerPosResult = await client.query(
      'SELECT quantities FROM statement_positions WHERE statement_market_id = $1 AND user_id = $2 FOR UPDATE',
      [id, req.user.id]
    );
    const currentTakerQty = takerPosResult.rows[0]
      ? takerPosResult.rows[0].quantities
      : new Array(nOutcomes).fill(0);

    const q_prime_t = currentTakerQty.map((q, i) => q + delta_quantities[i]);
    const delta_min = Math.min(...q_prime_t) - Math.min(...currentTakerQty);

    const netCost = deltaC - delta_min;

    const userResult = await client.query('SELECT balance FROM users WHERE id = $1 FOR UPDATE', [req.user.id]);
    if (userResult.rows[0].balance < netCost) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Insufficient balance. Trade costs ${netCost.toFixed(4)}` });
    }

    // Deduct from taker — held in statement market escrow until settlement
    await client.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [netCost, req.user.id]);

    // Update statement market: new aggregate state and escrow
    await client.query(
      'UPDATE statement_markets SET maker_quantities = $1, escrow = escrow + $2 WHERE id = $3',
      [new_maker_quantities, netCost, id]
    );

    // Update taker statement position: q'^t
    if (takerPosResult.rows[0]) {
      await client.query(
        'UPDATE statement_positions SET quantities = $1, updated_at = NOW() WHERE statement_market_id = $2 AND user_id = $3',
        [q_prime_t, id, req.user.id]
      );
    } else {
      await client.query(
        'INSERT INTO statement_positions (statement_market_id, user_id, quantities) VALUES ($1, $2, $3)',
        [id, req.user.id, q_prime_t]
      );
    }

    await client.query(
      'INSERT INTO ledger (user_id, amount, description, reference_id, reference_type) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, -netCost, `Trade in statement market ${id}`, id, 'statement_trade']
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

// POST /settlement/:id/resolve — resolve statement market and settle all participants
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

    // Lock original market
    const origResult = await client.query('SELECT * FROM markets WHERE id = $1 FOR UPDATE', [stmt.original_market_id]);
    const market = origResult.rows[0];

    // --- Final prices: gradient of C' at q'^m ---
    // dC'(q'^m)[x] = gradientDotProduct(stmt.maker_quantities, stmt.probabilities, stmt.liquidity_beta, x)
    const finalPrices = getPrices(stmt.maker_quantities, stmt.probabilities, stmt.liquidity_beta);

    // C'(q'^m) for statement maker payout
    const C_prime_qm = costFunction(stmt.maker_quantities, stmt.probabilities, stmt.liquidity_beta);

    // dC'(q'^m)[q'^m]
    const grad_stmt_at_stmt = gradientDotProduct(
      stmt.maker_quantities, stmt.probabilities, stmt.liquidity_beta,
      stmt.maker_quantities
    );

    // C(q^m) for original market maker payout
    const C_qm = costFunction(market.maker_quantities, market.probabilities, market.liquidity_beta);

    // dC'(q'^m)[q^m] — uses statement market prices but applied to original market aggregate
    const grad_stmt_at_orig = gradientDotProduct(
      stmt.maker_quantities, stmt.probabilities, stmt.liquidity_beta,
      market.maker_quantities
    );

    const settlements = {};

    // --- Statement maker settlement ---
    // B'^m ← B'^m + L' + C'(q'^m) - dC'(q'^m)[q'^m]
    const stmtMakerPayout = stmt.liquidity_cost + C_prime_qm - grad_stmt_at_stmt;
    settlements[stmt.creator_id] = (settlements[stmt.creator_id] || 0) + stmtMakerPayout;

    // --- Statement takers settlement ---
    // B'^t ← B'^t + dC'(q'^m)[q'^t] - min(q'^t)
    const stmtPositions = await client.query(
      'SELECT * FROM statement_positions WHERE statement_market_id = $1',
      [id]
    );
    for (const pos of stmtPositions.rows) {
      // Statement maker's position is handled separately above
      if (pos.user_id === stmt.creator_id) continue;
      const grad = gradientDotProduct(
        stmt.maker_quantities, stmt.probabilities, stmt.liquidity_beta,
        pos.quantities
      );
      const payout = grad - Math.min(...pos.quantities);
      settlements[pos.user_id] = (settlements[pos.user_id] || 0) + payout;
    }

    // --- Original market maker settlement ---
    // B^m ← B^m + L + C(q^m) - dC'(q'^m)[q^m]
    const origMakerPayout = market.liquidity_cost + C_qm - grad_stmt_at_orig;
    settlements[market.creator_id] = (settlements[market.creator_id] || 0) + origMakerPayout;

    // --- Original market takers settlement ---
    // B^t ← B^t + dC'(q'^m)[q^t] - min(q^t)
    const origPositions = await client.query(
      'SELECT * FROM positions WHERE market_id = $1',
      [stmt.original_market_id]
    );
    for (const pos of origPositions.rows) {
      // Market maker's payout is based on market.maker_quantities (q^m), not a positions row
      if (pos.user_id === market.creator_id) continue;
      const grad = gradientDotProduct(
        stmt.maker_quantities, stmt.probabilities, stmt.liquidity_beta,
        pos.quantities
      );
      const payout = grad - Math.min(...pos.quantities);
      settlements[pos.user_id] = (settlements[pos.user_id] || 0) + payout;
    }

    // Apply all settlements
    for (const [userId, amount] of Object.entries(settlements)) {
      if (Math.abs(amount) > 1e-10) {
        await client.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [amount, userId]);
        await client.query(
          'INSERT INTO ledger (user_id, amount, description, reference_id, reference_type) VALUES ($1, $2, $3, $4, $5)',
          [userId, amount, `Settlement for statement market ${id}`, id, 'settlement']
        );
      }
    }

    // Mark both markets as resolved and clear escrow now that all settlements are finalized
    await client.query(
      'UPDATE statement_markets SET status = $1, escrow = 0 WHERE id = $2',
      ['resolved', id]
    );
    await client.query(
      'UPDATE markets SET status = $1, escrow = 0 WHERE id = $2',
      ['resolved', stmt.original_market_id]
    );

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
