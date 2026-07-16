import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { SystemSettings } from '../services/systemSettings';
import { AuditService } from '../services/auditService';
import { AuditFormatter } from '../services/auditFormatter';
import { CacheService } from '../services/cacheService';
import { sendOrderReminders } from '../services/orderReminderService';
import { sendRebateReminderEmail, sendContractRenewalReminderEmail } from '../services/emailService';
import pool, { readQuery } from '../db/connection';
import { isValidUUID } from '../middleware/validation';
import { getUserNotifPrefs } from './notificationController';

// ==================== SYSTEM SETTINGS ====================

export const getSettings = async (req: AuthRequest, res: Response) => {
  try {
    if (!['admin', 'manager', 'staff'].includes(req.user!.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const settings = await SystemSettings.getAll();
    res.json(settings);
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateSetting = async (req: AuthRequest, res: Response) => {
  try {
    const { key, value } = req.body;
    
    if (!key || value === undefined) {
      return res.status(400).json({ error: 'Key and value are required' });
    }

    if (!['admin'].includes(req.user!.role)) {
      return res.status(403).json({ error: 'Only admins can update system settings' });
    }

    // Capture old value for audit
    const oldValue = await SystemSettings.get(key);

    const setting = await SystemSettings.update(key, String(value), req.user!.id);
    
    // Log action
    const actorName = await AuditService.getUserName(req.user!.id);
    const description = AuditFormatter.updateSetting(actorName, key, oldValue, String(value));
    await AuditService.log(
      req.user!.id,
      'update_setting',
      'system',
      setting.id,
      { key, old_value: oldValue, new_value: value },
      req.ip,
      description
    );

    res.json(setting);
  } catch (error) {
    console.error('Update setting error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ==================== AUDIT LOGS ====================

export const getAuditLogs = async (req: AuthRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    const entityType = req.query.entity_type as string;

    if (!['admin'].includes(req.user!.role)) {
      return res.status(403).json({ error: 'Only admins can view audit logs' });
    }

    const logs = await AuditService.getLogs(limit, offset, entityType);
    res.json(logs);
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ==================== USER MANAGEMENT EXTENSIONS ====================

export const toggleUserActive = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    if (!isValidUUID(id)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ error: 'is_active must be a boolean' });
    }

    if (!['admin'].includes(req.user!.role)) {
      return res.status(403).json({ error: 'Only admins can change user status' });
    }

    // Prevent deactivating self
    if (req.user!.id === id) {
      return res.status(400).json({ error: 'You cannot change your own active status' });
    }

    // Get current status and role for validation/audit
    const userResult = await pool.query('SELECT role, is_active, full_name, email FROM users WHERE id = $1', [id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const targetUser = userResult.rows[0];

    // Prevent deactivating the last admin
    if (targetUser.role === 'admin' && is_active === false) {
      const adminCount = await pool.query(
        "SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND is_active = TRUE"
      );
      if (parseInt(adminCount.rows[0].count) <= 1) {
        return res.status(400).json({ error: 'Cannot deactivate the last active admin.' });
      }
    }

    await pool.query(
      'UPDATE users SET is_active = $1, updated_date = CURRENT_TIMESTAMP WHERE id = $2',
      [is_active, id]
    );

    // Invalidate auth cache so change takes effect on next request
    await CacheService.del(`auth:user:${id}`);

    // Log action
    const adminName = await AuditService.getUserName(req.user!.id);
    const userDesc = is_active
      ? AuditFormatter.activateUser(adminName, targetUser.full_name, targetUser.email)
      : AuditFormatter.deactivateUser(adminName, targetUser.full_name, targetUser.email);
    await AuditService.log(
      req.user!.id,
      is_active ? 'activate_user' : 'deactivate_user',
      'user',
      id,
      { previous_status: targetUser.is_active },
      req.ip,
      userDesc
    );

    res.json({ 
      message: `User ${is_active ? 'activated' : 'deactivated'} successfully`,
      user_id: id,
      is_active 
    });
  } catch (error) {
    console.error('Toggle user status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ==================== ORDER REMINDERS ====================

export const triggerOrderReminders = async (req: AuthRequest, res: Response) => {
  try {
    if (!['admin', 'manager'].includes(req.user!.role)) {
      return res.status(403).json({ error: 'Only admins and managers can trigger order reminders' });
    }

    const result = await sendOrderReminders();

    // Log action
    const reminderActorName = await AuditService.getUserName(req.user!.id);
    const reminderDesc = AuditFormatter.triggerOrderReminders(reminderActorName, result.emailsSent, result.errors);
    await AuditService.log(
      req.user!.id,
      'trigger_order_reminders',
      'system',
      undefined,
      { emails_sent: result.emailsSent, errors: result.errors },
      req.ip,
      reminderDesc
    );

    res.json(result);
  } catch (error) {
    console.error('Trigger order reminders error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const triggerNotificationReminders = async (req: AuthRequest, res: Response) => {
  try {
    if (!['admin', 'manager'].includes(req.user!.role)) {
      return res.status(403).json({ error: 'Admins and managers only' });
    }

    let rebateSent = 0;
    let renewalSent = 0;

    // Rebate claim reminders
    const { rows: rebateRows } = await readQuery(`
      SELECT DISTINCT ON (c.customer_id, c.id)
        c.customer_id, c.contract_number, u.email, u.full_name,
        SUM(o.rebate_amount) FILTER (WHERE o.rebate_status = 'unpaid') AS unpaid_rebate
      FROM contracts c
      JOIN users u ON u.id = c.customer_id
      JOIN orders o ON o.contract_id = c.id
      WHERE c.status = 'expired' AND o.rebate_status = 'unpaid'
      GROUP BY c.customer_id, c.id, c.contract_number, u.email, u.full_name
      HAVING SUM(o.rebate_amount) FILTER (WHERE o.rebate_status = 'unpaid') > 0
    `);
    for (const row of rebateRows) {
      const prefs = await getUserNotifPrefs(row.customer_id);
      if (prefs.email_notifications && prefs.contract_updates) {
        await sendRebateReminderEmail(row.email, row.full_name, row.contract_number, parseFloat(row.unpaid_rebate));
        rebateSent++;
      }
    }

    // Renewal reminders (contracts expiring within 14 days)
    const { rows: renewalRows } = await readQuery(`
      SELECT c.customer_id, c.contract_number, c.end_date, u.email, u.full_name,
             (c.end_date::date - CURRENT_DATE)::int AS days_left
      FROM contracts c
      JOIN users u ON u.id = c.customer_id
      WHERE c.status IN ('active', 'approved')
        AND c.end_date::date BETWEEN CURRENT_DATE AND CURRENT_DATE + 14
    `);
    for (const row of renewalRows) {
      const prefs = await getUserNotifPrefs(row.customer_id);
      if (prefs.email_notifications && prefs.contract_updates) {
        await sendContractRenewalReminderEmail(
          row.email, row.full_name, row.contract_number,
          String(row.end_date), row.days_left
        );
        renewalSent++;
      }
    }

    res.json({
      message: 'Notification reminders sent',
      rebate_reminders_sent: rebateSent,
      renewal_reminders_sent: renewalSent,
    });
  } catch (error) {
    console.error('Trigger notification reminders error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
