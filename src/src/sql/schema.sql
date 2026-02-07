-- ============================================================================
-- CasaValle — Supabase Schema
-- Run this in your Supabase SQL Editor (one time setup)
-- ============================================================================

-- Users table (PIN, email for recovery, lockout)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  pin_hash TEXT,
  email TEXT,
  failed_attempts INT DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed the 4 roommates
INSERT INTO users (id, name) VALUES
  ('lucas', 'Lucas'),
  ('luis', 'Luis'),
  ('monica', 'Mónica'),
  ('niels', 'Niels')
ON CONFLICT (id) DO NOTHING;

-- Bank accounts (one per user)
CREATE TABLE IF NOT EXISTS bank_accounts (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  clabe TEXT NOT NULL CHECK (length(clabe) = 18 AND clabe ~ '^\d{18}$'),
  bank_name TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  category TEXT NOT NULL,
  description TEXT DEFAULT '',
  note TEXT DEFAULT '',
  photo TEXT,
  paid_by TEXT NOT NULL REFERENCES users(id),
  split_among TEXT[] NOT NULL,
  split_type TEXT DEFAULT 'equal' CHECK (split_type IN ('equal', 'custom', 'percent')),
  custom_split JSONB,
  expense_month TEXT NOT NULL,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurring_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_month ON expenses(expense_month);
CREATE INDEX IF NOT EXISTS idx_expenses_paid_by ON expenses(paid_by);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);

-- Recurring expenses (templates)
CREATE TABLE IF NOT EXISTS recurring (
  id TEXT PRIMARY KEY,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  category TEXT NOT NULL,
  description TEXT DEFAULT '',
  paid_by TEXT NOT NULL REFERENCES users(id),
  split_among TEXT[] NOT NULL,
  split_type TEXT DEFAULT 'equal',
  active BOOLEAN DEFAULT TRUE,
  paused_months TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Settlements / payment records
CREATE TABLE IF NOT EXISTS settlements (
  id TEXT PRIMARY KEY,
  from_user TEXT NOT NULL REFERENCES users(id),
  to_user TEXT NOT NULL REFERENCES users(id),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  settle_month TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'confirmed')),
  proof_photo TEXT,
  paid_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_settlements_month ON settlements(settle_month);

-- Budgets per category
CREATE TABLE IF NOT EXISTS budgets (
  category TEXT PRIMARY KEY,
  monthly_limit NUMERIC(12,2) NOT NULL CHECK (monthly_limit > 0),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

-- Policies: allow all operations for anon (trusted roommates)
CREATE POLICY "Allow all on users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on bank_accounts" ON bank_accounts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on expenses" ON expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on recurring" ON recurring FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on settlements" ON settlements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on budgets" ON budgets FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE expenses;
ALTER PUBLICATION supabase_realtime ADD TABLE settlements;
ALTER PUBLICATION supabase_realtime ADD TABLE recurring;
