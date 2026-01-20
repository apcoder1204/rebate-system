"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const userController = __importStar(require("../controllers/userController"));
const auth_1 = require("../middleware/auth");
const security_1 = require("../middleware/security");
const router = express_1.default.Router();
// Authentication endpoints with rate limiting
router.post('/login', security_1.authRateLimit, userController.login);
router.post('/register', security_1.authRateLimit, userController.register);
// Protected user endpoints
router.get('/me', auth_1.authenticate, userController.getMe);
router.put('/me', auth_1.authenticate, userController.updateProfile);
router.post('/change-password', auth_1.authenticate, userController.changePassword);
// Allow staff to list users so they can filter customers in staff screens.
router.get('/list', auth_1.authenticate, (0, auth_1.authorize)('admin', 'manager', 'staff'), userController.listUsers);
// Phone-based verification endpoints (legacy - Twilio)
router.post('/send-verification-code', security_1.passwordResetRateLimit, userController.sendVerificationCode);
router.post('/verify-code', security_1.passwordResetRateLimit, userController.verifyCode);
router.post('/reset-password', security_1.passwordResetRateLimit, userController.resetPassword);
// Email-based verification endpoints (Resend)
router.post('/send-email-code', security_1.passwordResetRateLimit, userController.sendEmailVerificationCode);
router.post('/verify-email-code', security_1.passwordResetRateLimit, userController.verifyEmailCode);
router.post('/reset-password-email', security_1.passwordResetRateLimit, userController.resetPasswordByEmail);
// Role request endpoints
router.get('/role-requests', auth_1.authenticate, (0, auth_1.authorize)('admin', 'manager'), userController.getRoleRequests);
router.post('/role-requests/:id/review', auth_1.authenticate, (0, auth_1.authorize)('admin', 'manager'), userController.reviewRoleRequest);
router.get('/my-role-request', auth_1.authenticate, userController.getMyRoleRequest);
// Direct role management (admin only)
router.put('/:id/role', auth_1.authenticate, (0, auth_1.authorize)('admin'), userController.updateUserRole);
router.delete('/:id', auth_1.authenticate, (0, auth_1.authorize)('admin'), userController.deleteUser);
exports.default = router;
