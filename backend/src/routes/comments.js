const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// GET /markets/:marketId/comments
router.get('/:marketId/comments', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.body, c.created_at, u.username
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.market_id = $1
       ORDER BY c.created_at DESC`,
      [req.params.marketId]
    );
    res.json({ comments: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /markets/:marketId/comments
router.post('/:marketId/comments', authMiddleware, async (req, res) => {
  const { body } = req.body;
  if (!body || !body.trim()) {
    return res.status(400).json({ error: 'Comment body is required' });
  }
  if (body.length > 2000) {
    return res.status(400).json({ error: 'Comment must be 2000 characters or fewer' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO comments (market_id, user_id, body)
       VALUES ($1, $2, $3)
       RETURNING id, body, created_at`,
      [req.params.marketId, req.user.id, body.trim()]
    );
    res.status(201).json({
      comment: { ...result.rows[0], username: req.user.username },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
