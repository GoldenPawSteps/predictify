const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const { costFunction, liquidityCost, getPrices } = require('../math/market');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT m.*, u.username as creator_username
       FROM markets m
       JOIN users u ON m.creator_id = u.id
       ORDER BY m.created_at DESC`
    );
    const markets = result.rows.map(m => ({
      ...m,
      current_prices: getPrices(m.maker_quantities, m.probabilities, m.liquidity_beta),
    }));
    res.json({ markets });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const marketResult = await pool.query(
      `SELECT m.*, u.username as creator_username
       FROM markets m
       JOIN users u ON m.creator_id = u.id
       WHERE m.id = $1`,
      [req.params.id]
    );
    if (!marketResult.rows[0]) return res.status(404).json({ error: 'Market not found' });
    const market = marketResult.rows[0];
    market.current_prices = getPrices(market.maker_quantities, market.probabilities, market.liquidity_beta);

    const positionsResult = await pool.query(
      `SELECT p.*, u.username
       FROM positions p
       JOIN users u ON p.user_id = u.id
       WHERE p.market_id = $1`,
      [req.params.id]
    );

    // Check for statement market
    const stmtResult = await pool.query(
      'SELECT * FROM statement_markets WHERE original_market_id = $1 ORDER BY created_at DESC LIMIT 1',
      [req.params.id]
    );

    let stmtPositions = [];
    if (stmtResult.rows[0]) {
      const spResult = await pool.query(
        `SELECT sp.*, u.username
         FROM statement_positions sp
         JOIN users u ON sp.user_id = u.id
         WHERE sp.statement_market_id = $1`,
        [stmtResult.rows[0].id]
      );
      stmtPositions = spResult.rows;
    }

    res.json({
      market,
      positions: positionsResult.rows,
      statement_market: stmtResult.rows[0] || null,
      statement_positions: stmtPositions,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  const { question, description, tags, outcomes, probabilities, liquidity_beta, end_time } = req.body;

  if (!question || !outcomes || !probabilities || !liquidity_beta || !end_time) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  if (outcomes.length !== probabilities.length) {
    return res.status(400).json({ error: 'outcomes and probabilities must have same length' });
  }
  if (outcomes.length < 2) {
    return res.status(400).json({ error: 'At least 2 outcomes required' });
  }
  if (liquidity_beta <= 0) {
    return res.status(400).json({ error: 'liquidity_beta must be positive' });
  }
  const endDate = new Date(end_time);
  if (isNaN(endDate.getTime()) || endDate <= new Date()) {
    return res.status(400).json({ error: 'end_time must be in the future' });
  }

  // Coerce and validate probabilities
  const numericProbabilities = probabilities.map(p => Number(p));
  if (numericProbabilities.some(p => !Number.isFinite(p))) {
    return res.status(400).json({ error: 'All probabilities must be valid numbers' });
  }
  const probSum = numericProbabilities.reduce((a, b) => a + b, 0);
  if (!Number.isFinite(probSum) || probSum <= 0) {
    return res.status(400).json({ error: 'Sum of probabilities must be greater than 0' });
  }
  const normalizedProbs = numericProbabilities.map(p => p / probSum);

  if (normalizedProbs.some(p => p <= 0 || p >= 1)) {
    return res.status(400).json({ error: 'All probabilities must be strictly between 0 and 1' });
  }

  const L = liquidityCost(normalizedProbs, liquidity_beta);
  const makerQuantities = new Array(outcomes.length).fill(0);
  const sanitizedTags = Array.isArray(tags)
    ? [...new Set(tags.map(t => String(t).trim().toLowerCase()).filter(t => t.length > 0 && t.length <= 50))].slice(0, 10)
    : [];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check maker balance
    const userResult = await client.query('SELECT balance FROM users WHERE id = $1 FOR UPDATE', [req.user.id]);
    const user = userResult.rows[0];
    if (!user) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'User not found' }); }
    if (user.balance < L) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Insufficient balance. Need ${L.toFixed(4)}, have ${user.balance.toFixed(4)}` });
    }

    // Deduct L from maker balance
    await client.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [L, req.user.id]);

    // Create market — initial escrow equals the liquidity cost L deposited by maker
    const marketResult = await client.query(
      `INSERT INTO markets (creator_id, question, description, tags, outcomes, probabilities, liquidity_beta, end_time, maker_quantities, liquidity_cost, escrow)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [req.user.id, question, description || null, sanitizedTags, outcomes, normalizedProbs, liquidity_beta, endDate, makerQuantities, L, L]
    );
    const market = marketResult.rows[0];

    // Initialize maker position (zero quantities)
    await client.query(
      `INSERT INTO positions (market_id, user_id, quantities) VALUES ($1, $2, $3)`,
      [market.id, req.user.id, makerQuantities]
    );

    // Ledger entry
    await client.query(
      `INSERT INTO ledger (user_id, amount, description, reference_id, reference_type) VALUES ($1, $2, $3, $4, $5)`,
      [req.user.id, -L, `Created market: ${question}`, market.id, 'market_creation']
    );

    // Record initial price snapshot
    const initialPrices = getPrices(makerQuantities, normalizedProbs, liquidity_beta);
    await client.query(
      'INSERT INTO price_history (market_id, market_type, prices) VALUES ($1, $2, $3)',
      [market.id, 'market', initialPrices]
    );

    await client.query('COMMIT');
    res.status(201).json({ market: { ...market, current_prices: getPrices(makerQuantities, normalizedProbs, liquidity_beta) } });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

router.get('/:id/price-history', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT prices, created_at FROM price_history
       WHERE market_id = $1 AND market_type = 'market'
       ORDER BY created_at ASC`,
      [req.params.id]
    );
    res.json({ history: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
