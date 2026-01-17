import express from 'express';
import { authenticate } from '../middleware/auth';
import { getSettings, updateSetting, getAuditLogs, toggleUserActive, triggerOrderReminders } from '../controllers/adminController';

const router = express.Router();

// System Settings
router.get('/settings', authenticate, getSettings);
router.put('/settings', authenticate, updateSetting);

// Audit Logs
router.get('/logs', authenticate, getAuditLogs);

// User Management Extension
router.put('/users/:id/active', authenticate, toggleUserActive);

// Order Reminders
router.post('/reminders/send', authenticate, triggerOrderReminders);

export default router;

