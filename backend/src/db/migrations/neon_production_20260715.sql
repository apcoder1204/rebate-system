-- Production migration for Neon — 2026-07-15
-- Apply BEFORE switching DEV_LOCAL_ONLY to false.
-- All changes are additive (IF NOT EXISTS / ON CONFLICT DO NOTHING) — safe to re-run.
-- Run via: psql "$NEON_DATABASE_URL" -f neon_production_20260715.sql

-- 1. Rebate payment columns on orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS rebate_status VARCHAR(20) DEFAULT 'unpaid'
  CHECK (rebate_status IN ('unpaid', 'paid'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS rebate_paid_date TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS rebate_paid_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS rebate_payment_notes TEXT;
CREATE INDEX IF NOT EXISTS idx_orders_rebate_status ON orders(rebate_status);

-- 2. Contract renewal columns
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS renewed_from_id UUID REFERENCES contracts(id) ON DELETE SET NULL;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS renewal_count INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_contracts_renewed_from ON contracts(renewed_from_id);

-- 3. Fixed cycle end date (current program cycle ends 2026-12-31)
INSERT INTO system_settings (key, value, description)
VALUES ('cycle_end_date', '2026-12-31', 'Fixed end date for the current contract cycle')
ON CONFLICT (key) DO NOTHING;

-- Verify
SELECT
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='orders' AND column_name='rebate_status') AS orders_rebate_status_exists,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='contracts' AND column_name='renewed_from_id') AS contracts_renewed_from_exists,
  (SELECT value FROM system_settings WHERE key='cycle_end_date') AS cycle_end_date;
