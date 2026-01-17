import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { SystemSettings } from '../services/systemSettings';
import { AuditService } from '../services/auditService';
import { sendOrderReminders } from '../services/orderReminderService';
import pool from '../db/connection';
import { isValidUUID } from '../middleware/validation';

// ==================== SYSTEM SETTINGS ====================

export const getSettings = async (req: AuthRequest, res: Response) => {
  try {
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
    await AuditService.log(
      req.user!.id,
      'update_setting',
      'system',
      setting.id,
      { key, old_value: oldValue, new_value: value },
      req.ip
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
    const userResult = await pool.query('SELECT role, is_active FROM users WHERE id = $1', [id]);
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

    // Log action
    await AuditService.log(
      req.user!.id,
      is_active ? 'activate_user' : 'deactivate_user',
      'user',
      id,
      { previous_status: targetUser.is_active },
      req.ip
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
    await AuditService.log(
      req.user!.id,
      'trigger_order_reminders',
      'system',
      null,
      { emails_sent: result.emailsSent, errors: result.errors },
      req.ip
    );

    res.json(result);
  } catch (error) {
    console.error('Trigger order reminders error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
