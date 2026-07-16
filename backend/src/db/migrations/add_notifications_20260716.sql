-- Notification system migration — 2026-07-16
-- Safe to re-run (IF NOT EXISTS throughout)

-- 1. Per-user notification preferences
CREATE TABLE IF NOT EXISTS user_notification_preferences (
  user_id             UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  push_notifications  BOOLEAN NOT NULL DEFAULT TRUE,
  order_updates       BOOLEAN NOT NULL DEFAULT TRUE,
  contract_updates    BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Web Push subscriptions (one user can subscribe from multiple devices)
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

-- Verify
SELECT
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'user_notification_preferences') AS prefs_table_exists,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'push_subscriptions') AS push_table_exists;
