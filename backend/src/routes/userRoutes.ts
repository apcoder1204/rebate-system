import express from 'express';
import * as userController from '../controllers/userController';
import { authenticate, authorize } from '../middleware/auth';
import { authRateLimit, passwordResetRateLimit } from '../middleware/security';

const router = express.Router();

// Authentication endpoints with rate limiting
router.post('/login', authRateLimit, userController.login);
router.post('/register', authRateLimit, userController.register);

// Protected user endpoints
router.get('/me', authenticate, userController.getMe);
router.put('/me', authenticate, userController.updateProfile);
router.post('/change-password', authenticate, userController.changePassword);
// Allow staff to list users so they can filter customers in staff screens.
router.get('/list', authenticate, authorize('admin', 'manager', 'staff'), userController.listUsers);

// Phone-based verification endpoints (legacy - Twilio)
router.post('/send-verification-code', passwordResetRateLimit, userController.sendVerificationCode);
router.post('/verify-code', passwordResetRateLimit, userController.verifyCode);
router.post('/reset-password', passwordResetRateLimit, userController.resetPassword);

// Email-based verification endpoints (Resend)
router.post('/send-email-code', passwordResetRateLimit, userController.sendEmailVerificationCode);
router.post('/verify-email-code', passwordResetRateLimit, userController.verifyEmailCode);
router.post('/reset-password-email', passwordResetRateLimit, userController.resetPasswordByEmail);

// Role request endpoints
router.get('/role-requests', authenticate, authorize('admin', 'manager'), userController.getRoleRequests);
router.post('/role-requests/:id/review', authenticate, authorize('admin', 'manager'), userController.reviewRoleRequest);
router.get('/my-role-request', authenticate, userController.getMyRoleRequest);

// Direct role management (admin only)
router.put('/:id/role', authenticate, authorize('admin'), userController.updateUserRole);
router.delete('/:id', authenticate, authorize('admin'), userController.deleteUser);

export default router;

