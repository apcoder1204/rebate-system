import express from 'express';
import { authenticate } from '../middleware/auth';
import { getSettings, updateSetting, getAuditLogs, toggleUserActive, triggerOrderReminders } from '../controllers/adminController';
import { getRevenueReport, getOrderTrends, getCustomerStats, getSummaryStats } from '../controllers/reportController';

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

// Reports
router.get('/reports/revenue', authenticate, getRevenueReport);
router.get('/reports/order-trends', authenticate, getOrderTrends);
router.get('/reports/customer-stats', authenticate, getCustomerStats);
router.get('/reports/summary', authenticate, getSummaryStats);

export default router;

