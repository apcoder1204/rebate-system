-- Backfill descriptions for all existing audit_log rows that have description = NULL.
-- Safe to run multiple times (WHERE description IS NULL guard).

-- 1. update_setting
UPDATE audit_logs al
SET description =
  (SELECT u.full_name FROM users u WHERE u.id = al.user_id)
  || ' updated system setting "'
  || REPLACE(al.details->>'key', '_', ' ')
  || '" from "' || (al.details->>'old_value')
  || '" to "' || (al.details->>'new_value') || '".'
WHERE al.action = 'update_setting'
  AND al.description IS NULL
  AND al.details IS NOT NULL;

-- 2. activate_user
UPDATE audit_logs al
SET description =
  (SELECT u.full_name FROM users u WHERE u.id = al.user_id)
  || ' activated the account of '
  || (SELECT u2.full_name FROM users u2 WHERE u2.id = al.entity_id)
  || ' (' || (SELECT u2.email FROM users u2 WHERE u2.id = al.entity_id) || ').'
WHERE al.action = 'activate_user'
  AND al.description IS NULL;

-- 3. deactivate_user
UPDATE audit_logs al
SET description =
  (SELECT u.full_name FROM users u WHERE u.id = al.user_id)
  || ' deactivated the account of '
  || (SELECT u2.full_name FROM users u2 WHERE u2.id = al.entity_id)
  || ' (' || (SELECT u2.email FROM users u2 WHERE u2.id = al.entity_id) || ').'
WHERE al.action = 'deactivate_user'
  AND al.description IS NULL;

-- 4. lock_order
UPDATE audit_logs al
SET description =
  (SELECT u.full_name FROM users u WHERE u.id = al.user_id)
  || ' manually locked order '
  || (SELECT o.order_number FROM orders o WHERE o.id = al.entity_id)
  || ' for customer '
  || (SELECT u2.full_name FROM users u2 JOIN orders o ON o.customer_id = u2.id WHERE o.id = al.entity_id)
  || '.'
WHERE al.action = 'lock_order'
  AND al.description IS NULL;

-- 5. unlock_order
UPDATE audit_logs al
SET description =
  (SELECT u.full_name FROM users u WHERE u.id = al.user_id)
  || ' manually unlocked order '
  || (SELECT o.order_number FROM orders o WHERE o.id = al.entity_id)
  || ' for customer '
  || (SELECT u2.full_name FROM users u2 JOIN orders o ON o.customer_id = u2.id WHERE o.id = al.entity_id)
  || '.'
WHERE al.action = 'unlock_order'
  AND al.description IS NULL;

-- 6. pay_rebate
UPDATE audit_logs al
SET description =
  (SELECT u.full_name FROM users u WHERE u.id = al.user_id)
  || ' paid a rebate of Tsh '
  || TO_CHAR((al.details->>'total_paid')::numeric, 'FM999,999,990.00')
  || ' to '
  || (SELECT u2.full_name FROM users u2 WHERE u2.id = (al.details->>'customer_id')::uuid)
  || ' covering '
  || jsonb_array_length(al.details->'order_ids')
  || ' order(s).'
  || CASE WHEN al.details->>'notes' IS NOT NULL AND al.details->>'notes' != 'null'
          THEN ' Note: ' || (al.details->>'notes')
          ELSE '' END
WHERE al.action = 'pay_rebate'
  AND al.description IS NULL
  AND al.details IS NOT NULL;

-- 7. request_rebate (actor = customer, entity_id = contract_id)
UPDATE audit_logs al
SET description =
  (SELECT u.full_name FROM users u WHERE u.id = al.user_id)
  || ' submitted a rebate request for contract '
  || (SELECT c.contract_number FROM contracts c WHERE c.id = al.entity_id)
  || ' (amount: Tsh '
  || TO_CHAR((al.details->>'total_rebate_amount')::numeric, 'FM999,999,990.00')
  || ').'
WHERE al.action = 'request_rebate'
  AND al.description IS NULL
  AND al.details IS NOT NULL;

-- 8. approve_rebate (entity_id = contract_id)
UPDATE audit_logs al
SET description =
  (SELECT u.full_name FROM users u WHERE u.id = al.user_id)
  || ' approved the rebate request from '
  || (SELECT u2.full_name FROM users u2 WHERE u2.id = (al.details->>'customer_id')::uuid)
  || ' for contract '
  || (SELECT c.contract_number FROM contracts c WHERE c.id = al.entity_id)
  || ' and paid Tsh '
  || TO_CHAR((al.details->>'total_rebate_amount')::numeric, 'FM999,999,990.00')
  || '.'
WHERE al.action = 'approve_rebate'
  AND al.description IS NULL
  AND al.details IS NOT NULL;

-- 9. renew_contract (entity_id = new contract id, source_contract_id in details)
UPDATE audit_logs al
SET description =
  (SELECT u.full_name FROM users u WHERE u.id = al.user_id)
  || ' renewed contract '
  || (SELECT c.contract_number FROM contracts c WHERE c.id = (al.details->>'source_contract_id')::uuid)
  || ' for customer '
  || (SELECT u2.full_name FROM users u2
      JOIN contracts c ON c.customer_id = u2.id
      WHERE c.id = (al.details->>'source_contract_id')::uuid)
  || ' — new contract '
  || (SELECT c.contract_number FROM contracts c WHERE c.id = al.entity_id)
  || ' created (renewal #'
  || (al.details->>'renewal_count')
  || ').'
WHERE al.action = 'renew_contract'
  AND al.description IS NULL
  AND al.details IS NOT NULL;
