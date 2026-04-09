const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const { costFunction, getPrices } = require('../math/market');

const router = express.Router();

router.post('/:marketId', authMiddleware, async (req, res) => {
  const { marketId } = req.params;
  const { delta_quantities } = req.body;

  if (!delta_quantities || !Array.isArray(delta_quantities)) {
    return res.status(400).json({ error: 'delta_quantities array is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock market row
    const marketResult = await client.query('SELECT * FROM markets WHERE id = $1 FOR UPDATE', [marketId]);
    if (!marketResult.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Market not found' });
    }
    const market = marketResult.rows[0];

    if (market.status !== 'active') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Market is not active (status: ${market.status})` });
    }
    if (new Date(market.end_time) <= new Date()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Market has expired' });
    }
    if (delta_quantities.length !== market.outcomes.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Expected ${market.outcomes.length} delta quantities` });
    }

    const { maker_quantities, probabilities, liquidity_beta } = market;

    // C_before = cost at current maker quantities
    const C_before = costFunction(maker_quantities, probabilities, liquidity_beta);

    // New maker quantities after trade
    const new_maker_quantities = maker_quantities.map((q, i) => q + delta_quantities[i]);

    // C_after = cost at new quantities
    const C_after = costFunction(new_maker_quantities, probabilities, liquidity_beta);

    // ΔC = C_after - C_before (cost of trade)
    const deltaC = C_after - C_before;

    // Δ_min = min(delta_quantities) — taker's guaranteed payoff offset
    const delta_min = Math.min(...delta_quantities);

    // Net cost to taker
    const netCost = deltaC - delta_min;

    // Lock user
    const userResult = await client.query('SELECT balance FROM users WHERE id = $1 FOR UPDATE', [req.user.id]);
    const user = userResult.rows[0];
    if (!user) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'User not found' }); }

    if (user.balance < netCost) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Insufficient balance. Trade costs ${netCost.toFixed(4)}, have ${user.balance.toFixed(4)}` });
    }

    // Deduct net cost from taker
    await client.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [netCost, req.user.id]);

    // Update maker quantities on market
    await client.query('UPDATE markets SET maker_quantities = $1 WHERE id = $2', [new_maker_quantities, marketId]);

    // Update taker position
    const existingPos = await client.query(
      'SELECT * FROM positions WHERE market_id = $1 AND user_id = $2 FOR UPDATE',
      [marketId, req.user.id]
    );
    if (existingPos.rows[0]) {
      const newQty = existingPos.rows[0].quantities.map((q, i) => q + delta_quantities[i]);
      await client.query(
        'UPDATE positions SET quantities = $1, updated_at = NOW() WHERE market_id = $2 AND user_id = $3',
        [newQty, marketId, req.user.id]
      );
    } else {
      await client.query(
        'INSERT INTO positions (market_id, user_id, quantities) VALUES ($1, $2, $3)',
        [marketId, req.user.id, delta_quantities]
      );
    }

    // Update maker position (inverse delta — maker takes the other side)
    const makerPosResult = await client.query(
      'SELECT * FROM positions WHERE market_id = $1 AND user_id = $2 FOR UPDATE',
      [marketId, market.creator_id]
    );
    if (makerPosResult.rows[0]) {
      const newMakerQty = makerPosResult.rows[0].quantities.map((q, i) => q - delta_quantities[i]);
      await client.query(
        'UPDATE positions SET quantities = $1, updated_at = NOW() WHERE market_id = $2 AND user_id = $3',
        [newMakerQty, marketId, market.creator_id]
      );
    } else {
      await client.query(
        'INSERT INTO positions (market_id, user_id, quantities) VALUES ($1, $2, $3)',
        [marketId, market.creator_id, delta_quantities.map(d => -d)]
      );
    }

    // Credit maker with net cost (minus delta_min offset which goes to taker's position value)
    await client.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [netCost, market.creator_id]);

    // Ledger entries
    await client.query(
      'INSERT INTO ledger (user_id, amount, description, reference_id, reference_type) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, -netCost, `Trade in market ${marketId}`, marketId, 'trade']
    );
    await client.query(
      'INSERT INTO ledger (user_id, amount, description, reference_id, reference_type) VALUES ($1, $2, $3, $4, $5)',
      [market.creator_id, netCost, `Received from trade in market ${marketId}`, marketId, 'trade']
    );

    await client.query('COMMIT');

    const updatedMarket = await pool.query('SELECT * FROM markets WHERE id = $1', [marketId]);
    const m = updatedMarket.rows[0];
    res.json({
      success: true,
      deltaC,
      delta_min,
      net_cost: netCost,
      current_prices: getPrices(m.maker_quantities, m.probabilities, m.liquidity_beta),
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
