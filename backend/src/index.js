const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Global rate limiter
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

// Stricter limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth requests, please try again later.' },
});

app.use(globalLimiter);

const authRouter = require('./routes/auth');
// Apply strict limiter only to login/register, not to /auth/me
app.use('/auth/login', authLimiter);
app.use('/auth/register', authLimiter);
app.use('/auth', authRouter);
app.use('/markets', require('./routes/markets'));
app.use('/trades', require('./routes/trades'));
app.use('/settlement', require('./routes/settlement'));
app.use('/portfolio', require('./routes/portfolio'));

const pool = require('./db');
const PORT = process.env.PORT || 3001;
pool.query(`ALTER TABLE markets ADD COLUMN IF NOT EXISTS description TEXT`)
  .then(() => pool.query(`ALTER TABLE markets ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}'`))
  .then(() => pool.query(`ALTER TABLE markets ADD COLUMN IF NOT EXISTS volume DOUBLE PRECISION NOT NULL DEFAULT 0`))
  .then(() => pool.query(`ALTER TABLE statement_markets ADD COLUMN IF NOT EXISTS volume DOUBLE PRECISION NOT NULL DEFAULT 0`))
  .then(() => app.listen(PORT, () => console.log(`Server running on port ${PORT}`)))
  .catch(err => { console.error('Migration failed', err); process.exit(1); });
