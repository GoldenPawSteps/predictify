const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.get('/positions', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.quantities, p.updated_at,
              m.id as market_id, m.question, m.outcomes, m.probabilities,
              m.liquidity_beta, m.maker_quantities, m.status, m.end_time
       FROM positions p
       JOIN markets m ON p.market_id = m.id
       WHERE p.user_id = $1
       ORDER BY p.updated_at DESC`,
      [req.user.id]
    );
    res.json({ positions: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/ledger', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT l.*,
        CASE
          WHEN l.reference_type IN ('trade', 'market_creation') THEN m.question
          WHEN l.reference_type IN ('statement_creation', 'statement_trade', 'settlement') THEN COALESCE(sm_orig.question, m2.question)
        END as market_question,
        CASE
          WHEN l.reference_type IN ('trade', 'market_creation') THEN l.reference_id
          WHEN l.reference_type = 'statement_creation' THEN sm.original_market_id
          WHEN l.reference_type IN ('statement_trade', 'settlement') THEN COALESCE(sm2.original_market_id, l.reference_id)
        END as market_id
       FROM ledger l
       LEFT JOIN markets m ON l.reference_type IN ('trade', 'market_creation') AND m.id = l.reference_id
       LEFT JOIN statement_markets sm ON l.reference_type = 'statement_creation' AND sm.id = l.reference_id
       LEFT JOIN markets sm_orig ON sm.original_market_id = sm_orig.id
       LEFT JOIN statement_markets sm2 ON l.reference_type IN ('statement_trade', 'settlement') AND sm2.id = l.reference_id
       LEFT JOIN markets m2 ON sm2.original_market_id = m2.id
       WHERE l.user_id = $1
       ORDER BY l.created_at DESC LIMIT 100`,
      [req.user.id]
    );
    res.json({ ledger: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
