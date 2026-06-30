-- Migration: add rebate payment tracking to orders
-- Run AFTER backing up the database. All changes are additive (ADD COLUMN IF NOT EXISTS).

ALTER TABLE orders ADD COLUMN IF NOT EXISTS rebate_status VARCHAR(20) DEFAULT 'unpaid'
  CHECK (rebate_status IN ('unpaid', 'paid'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS rebate_paid_date TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS rebate_paid_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS rebate_payment_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_rebate_status ON orders(rebate_status);
