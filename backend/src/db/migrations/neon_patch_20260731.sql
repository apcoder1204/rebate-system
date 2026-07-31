-- Safe patch for Neon production — 2026-07-31
-- All statements are additive (IF NOT EXISTS / ON CONFLICT DO NOTHING).
-- Safe to re-run multiple times.

-- 1. Ensure email column exists in verification_codes (added by add_email_verification.sql
--    but may be missing if that migration ran before the table was created)
ALTER TABLE verification_codes ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE verification_codes ALTER COLUMN phone DROP NOT NULL;
ALTER TABLE verification_codes DROP CONSTRAINT IF EXISTS verification_codes_purpose_check;
ALTER TABLE verification_codes ADD CONSTRAINT verification_codes_purpose_check
  CHECK (purpose IN ('registration', 'password_reset', 'email_verification'));
CREATE INDEX IF NOT EXISTS idx_verification_codes_email ON verification_codes(email);

-- 2. Ensure email_verified column exists on users
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;

-- 3. Ensure is_active column exists on users
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- 4. Ensure system_settings table and default values exist
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(50) UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);
INSERT INTO system_settings (key, value, description) VALUES
  ('auto_lock_days',           '3',          'Number of days after which pending orders are automatically locked'),
  ('default_rebate_percentage','1.00',        'Default rebate percentage for new contracts/orders'),
  ('allow_manual_unlock',      'true',        'Allow admins/managers to manually unlock orders'),
  ('cycle_end_date',           '2026-12-31',  'Fixed end date for the current contract cycle')
ON CONFLICT (key) DO NOTHING;

-- 5. Ensure audit_logs table exists
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,
  details JSONB,
  ip_address VARCHAR(45),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS description TEXT;

-- 6. Ensure role_requests table exists
CREATE TABLE IF NOT EXISTS role_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_role VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  review_comment TEXT,
  requested_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_date TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_role_requests_user ON role_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_role_requests_status ON role_requests(status);

-- 7. Order locking columns
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS locked_date TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS manually_unlocked BOOLEAN DEFAULT FALSE;

-- 8. Rebate payment columns
ALTER TABLE orders ADD COLUMN IF NOT EXISTS rebate_status VARCHAR(20) DEFAULT 'unpaid'
  CHECK (rebate_status IN ('unpaid', 'paid'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS rebate_paid_date TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS rebate_paid_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS rebate_payment_notes TEXT;
CREATE INDEX IF NOT EXISTS idx_orders_rebate_status ON orders(rebate_status);

-- 9. Order reminder tracking
ALTER TABLE orders ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS reminder_count INTEGER DEFAULT 0;

-- 10. Rebate requests table
CREATE TABLE IF NOT EXISTS rebate_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_amount DECIMAL(15,2),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
  notes TEXT,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_rebate_requests_contract ON rebate_requests(contract_id);
CREATE INDEX IF NOT EXISTS idx_rebate_requests_customer ON rebate_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_rebate_requests_status ON rebate_requests(status);

-- 11. Contract renewal columns
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS renewed_from_id UUID REFERENCES contracts(id) ON DELETE SET NULL;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS renewal_count INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_contracts_renewed_from ON contracts(renewed_from_id);

-- 12. Contract approval / signature columns
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS approved_date TIMESTAMP;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS customer_signature_data_url TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS manager_signature_data_url TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS manager_name VARCHAR(200);
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS manager_position VARCHAR(200);

-- 13. Notification tables (from add_notifications_20260716.sql — safe to re-run)
CREATE TABLE IF NOT EXISTS user_notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email_notifications  BOOLEAN NOT NULL DEFAULT TRUE,
  push_notifications   BOOLEAN NOT NULL DEFAULT TRUE,
  order_updates        BOOLEAN NOT NULL DEFAULT TRUE,
  contract_updates     BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, endpoint)
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);

-- Verify key columns exist
SELECT
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='verification_codes' AND column_name='email') AS vc_email_exists,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='users' AND column_name='email_verified') AS users_email_verified_exists,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='orders' AND column_name='rebate_status') AS orders_rebate_status_exists,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='contracts' AND column_name='renewed_from_id') AS contracts_renewed_from_exists,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name='user_notification_preferences') AS notif_prefs_table_exists,
  (SELECT value FROM system_settings WHERE key='cycle_end_date') AS cycle_end_date;
