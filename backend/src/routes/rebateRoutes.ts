import express from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  getRebateCalculation,
  payRebate,
  getRebateSettings,
  requestRebate,
  getMyRebateRequest,
  listRebateRequests,
  approveRebateRequest,
  rejectRebateRequest,
  searchCustomerRebate,
} from '../controllers/rebateController';

const router = express.Router();

// Staff — direct payment + calculator
router.get('/calculator', authenticate, authorize('admin', 'manager', 'staff'), getRebateCalculation);
router.post('/pay', authenticate, authorize('admin', 'manager', 'staff'), payRebate);
router.get('/settings', authenticate, authorize('admin', 'manager', 'staff'), getRebateSettings);

// Staff — customer search for the rebate calculator on admin panel
router.get('/search', authenticate, authorize('admin', 'manager', 'staff'), searchCustomerRebate);

// Staff — manage rebate requests
router.get('/requests', authenticate, authorize('admin', 'manager', 'staff'), listRebateRequests);
router.post('/requests/:id/approve', authenticate, authorize('admin', 'manager', 'staff'), approveRebateRequest);
router.post('/requests/:id/reject', authenticate, authorize('admin', 'manager', 'staff'), rejectRebateRequest);

// Customer — submit and check their rebate redemption request
router.post('/request', authenticate, requestRebate);
router.get('/my-requests', authenticate, getMyRebateRequest);

export default router;
