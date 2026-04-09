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
  if (!delta_quantities.every(v => typeof v === 'number' && Number.isFinite(v))) {
    return res.status(400).json({ error: 'delta_quantities must contain only finite numbers' });
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

    // C(q^m) before trade
    const C_before = costFunction(maker_quantities, probabilities, liquidity_beta);

    // q'^m = q^m + Δq
    const new_maker_quantities = maker_quantities.map((q, i) => q + delta_quantities[i]);

    // C(q'^m) after trade
    const C_after = costFunction(new_maker_quantities, probabilities, liquidity_beta);

    // ΔC = C(q'^m) - C(q^m)
    const deltaC = C_after - C_before;

    // Get taker's current position to compute Δ_min = min(q'^t) - min(q^t)
    const takerPosResult = await client.query(
      'SELECT quantities FROM positions WHERE market_id = $1 AND user_id = $2 FOR UPDATE',
      [marketId, req.user.id]
    );
    const currentTakerQty = takerPosResult.rows[0]
      ? takerPosResult.rows[0].quantities
      : new Array(market.outcomes.length).fill(0);

    const q_prime_t = currentTakerQty.map((q, i) => q + delta_quantities[i]);
    const delta_min = Math.min(...q_prime_t) - Math.min(...currentTakerQty);

    // Net cost to taker: ΔC - Δ_min
    const netCost = deltaC - delta_min;

    // Lock user
    const userResult = await client.query('SELECT balance FROM users WHERE id = $1 FOR UPDATE', [req.user.id]);
    const user = userResult.rows[0];
    if (!user) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'User not found' }); }

    if (user.balance < netCost) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Insufficient balance. Trade costs ${netCost.toFixed(4)}, have ${user.balance.toFixed(4)}` });
    }

    // Deduct net cost from taker — funds held in market escrow until settlement
    await client.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [netCost, req.user.id]);

    // Update market: new aggregate state q^m and escrow
    await client.query(
      'UPDATE markets SET maker_quantities = $1, escrow = escrow + $2 WHERE id = $3',
      [new_maker_quantities, netCost, marketId]
    );

    // Update taker position: q^t ← q^t + Δq
    if (takerPosResult.rows[0]) {
      await client.query(
        'UPDATE positions SET quantities = $1, updated_at = NOW() WHERE market_id = $2 AND user_id = $3',
        [q_prime_t, marketId, req.user.id]
      );
    } else {
      await client.query(
        'INSERT INTO positions (market_id, user_id, quantities) VALUES ($1, $2, $3)',
        [marketId, req.user.id, q_prime_t]
      );
    }

    // Ledger entry for taker
    await client.query(
      'INSERT INTO ledger (user_id, amount, description, reference_id, reference_type) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, -netCost, `Trade in market ${marketId}`, marketId, 'trade']
    );

    await client.query('COMMIT');

    const updatedMarket = await pool.query('SELECT * FROM markets WHERE id = $1', [marketId]);
    const m = updatedMarket.rows[0];
    const finalPrices = getPrices(m.maker_quantities, m.probabilities, m.liquidity_beta);

    // Record price snapshot
    await pool.query(
      'INSERT INTO price_history (market_id, market_type, prices) VALUES ($1, $2, $3)',
      [marketId, 'market', finalPrices]
    );

    res.json({
      success: true,
      deltaC,
      delta_min,
      net_cost: netCost,
      current_prices: finalPrices,
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
