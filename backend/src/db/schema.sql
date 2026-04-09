CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  balance DOUBLE PRECISION NOT NULL DEFAULT 1000.0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE markets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID REFERENCES users(id) NOT NULL,
  question TEXT NOT NULL,
  outcomes TEXT[] NOT NULL,
  probabilities DOUBLE PRECISION[] NOT NULL,
  liquidity_beta DOUBLE PRECISION NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  maker_quantities DOUBLE PRECISION[] NOT NULL,
  liquidity_cost DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE positions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  market_id UUID REFERENCES markets(id) NOT NULL,
  user_id UUID REFERENCES users(id) NOT NULL,
  quantities DOUBLE PRECISION[] NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(market_id, user_id)
);

CREATE TABLE statement_markets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  original_market_id UUID REFERENCES markets(id) NOT NULL,
  creator_id UUID REFERENCES users(id) NOT NULL,
  probabilities DOUBLE PRECISION[] NOT NULL,
  liquidity_beta DOUBLE PRECISION NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  maker_quantities DOUBLE PRECISION[] NOT NULL,
  liquidity_cost DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE statement_positions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  statement_market_id UUID REFERENCES statement_markets(id) NOT NULL,
  user_id UUID REFERENCES users(id) NOT NULL,
  quantities DOUBLE PRECISION[] NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(statement_market_id, user_id)
);

CREATE TABLE ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  description TEXT NOT NULL,
  reference_id UUID,
  reference_type VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
