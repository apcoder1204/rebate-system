"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendVerificationCodeByEmail = sendVerificationCodeByEmail;
exports.verifyEmailCode = verifyEmailCode;
exports.isEmailVerified = isEmailVerified;
exports.isCodeRecentlyVerified = isCodeRecentlyVerified;
exports.cleanupExpiredCodes = cleanupExpiredCodes;
const resend_1 = require("resend");
const connection_1 = __importDefault(require("../db/connection"));
// Initialize Resend client
const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new resend_1.Resend(resendApiKey) : null;
// Email sender configuration
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@cctvpoint.org';
const APP_NAME = process.env.APP_NAME || 'RebateFlow';
/**
 * Generate a random 6-digit verification code
 */
function generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}
/**
 * Send verification code via email using Resend
 */
async function sendVerificationCodeByEmail(email, purpose) {
    try {
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email.trim())) {
            return { success: false, message: 'Invalid email address' };
        }
        const normalizedEmail = email.trim().toLowerCase();
        // Generate verification code
        const code = generateVerificationCode();
        // Store code in database (expires in 10 minutes)
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 10);
        await connection_1.default.query(`INSERT INTO verification_codes (email, code, purpose, expires_at)
       VALUES ($1, $2, $3, $4)`, [normalizedEmail, code, purpose, expiresAt]);
        // If Resend is not configured, return error
        if (!resend) {
            console.error('Resend API key is not configured');
            return {
                success: false,
                message: 'Email service is not configured. Please contact support.',
            };
        }
        // Prepare email content based on purpose
        const subject = purpose === 'registration'
            ? `${APP_NAME} - Verify Your Email Address`
            : `${APP_NAME} - Password Reset Code`;
        const htmlContent = purpose === 'registration'
            ? `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px;">
          <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #1e293b; margin: 0; font-size: 24px;">Welcome to ${APP_NAME}!</h1>
            </div>
            <p style="color: #475569; font-size: 16px; line-height: 1.6;">
              Thank you for registering. Please use the verification code below to complete your registration:
            </p>
            <div style="background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; padding: 20px; border-radius: 8px; margin: 24px 0;">
              ${code}
            </div>
            <p style="color: #64748b; font-size: 14px; text-align: center;">
              This code expires in <strong>10 minutes</strong>.
            </p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
            <p style="color: #94a3b8; font-size: 12px; text-align: center;">
              If you didn't request this code, please ignore this email.
            </p>
          </div>
        </body>
        </html>
      `
            : `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px;">
          <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #1e293b; margin: 0; font-size: 24px;">Password Reset Request</h1>
            </div>
            <p style="color: #475569; font-size: 16px; line-height: 1.6;">
              We received a request to reset your password. Use the code below to proceed:
            </p>
            <div style="background: linear-gradient(135deg, #10b981, #059669); color: white; font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; padding: 20px; border-radius: 8px; margin: 24px 0;">
              ${code}
            </div>
            <p style="color: #64748b; font-size: 14px; text-align: center;">
              This code expires in <strong>10 minutes</strong>.
            </p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
            <p style="color: #94a3b8; font-size: 12px; text-align: center;">
              If you didn't request a password reset, please ignore this email or contact support if you have concerns.
            </p>
          </div>
        </body>
        </html>
      `;
        // Send email via Resend
        try {
            const { data, error } = await resend.emails.send({
                from: FROM_EMAIL,
                to: normalizedEmail,
                subject,
                html: htmlContent,
            });
            if (error) {
                console.error('Resend error:', error);
                return {
                    success: false,
                    message: `Failed to send email: ${error.message}. Please try again.`,
                };
            }
            console.log(`Verification email sent to ${normalizedEmail}, ID: ${data?.id}`);
            return { success: true, message: 'Verification code sent to your email' };
        }
        catch (resendError) {
            console.error('Resend error:', resendError);
            return {
                success: false,
                message: `Failed to send email: ${resendError.message}. Please try again.`,
            };
        }
    }
    catch (error) {
        console.error('Error sending verification code:', error);
        return { success: false, message: error.message || 'Failed to send verification code' };
    }
}
/**
 * Verify the code entered by user (email-based)
 */
async function verifyEmailCode(email, code, purpose) {
    try {
        const normalizedEmail = email.trim().toLowerCase();
        // Find valid, unexpired, unverified code
        const result = await connection_1.default.query(`SELECT id, expires_at FROM verification_codes
       WHERE email = $1 AND code = $2 AND purpose = $3 
       AND verified = FALSE AND expires_at > CURRENT_TIMESTAMP
       ORDER BY created_at DESC
       LIMIT 1`, [normalizedEmail, code, purpose]);
        if (result.rows.length === 0) {
            return { success: false, message: 'Invalid or expired verification code' };
        }
        // Mark code as verified
        await connection_1.default.query('UPDATE verification_codes SET verified = TRUE WHERE id = $1', [result.rows[0].id]);
        // If it's registration, mark email as verified in users table
        if (purpose === 'registration') {
            await connection_1.default.query('UPDATE users SET email_verified = TRUE WHERE email = $1', [normalizedEmail]);
        }
        return { success: true, message: 'Code verified successfully' };
    }
    catch (error) {
        console.error('Error verifying code:', error);
        return { success: false, message: error.message || 'Failed to verify code' };
    }
}
/**
 * Check if email is already verified (for registration)
 * This checks if there's a verified code in the verification_codes table
 */
async function isEmailVerified(email) {
    try {
        const normalizedEmail = email.trim().toLowerCase();
        // Check if there's a recently verified code for this email (within last 30 minutes)
        const result = await connection_1.default.query(`SELECT id FROM verification_codes 
       WHERE email = $1 AND purpose = 'registration' AND verified = TRUE
       AND created_at > NOW() - INTERVAL '30 minutes'
       ORDER BY created_at DESC
       LIMIT 1`, [normalizedEmail]);
        return result.rows.length > 0;
    }
    catch (error) {
        console.error('Error checking email verification:', error);
        return false;
    }
}
/**
 * Check if a code was recently verified (for password reset flow where code is verified separately)
 */
async function isCodeRecentlyVerified(email, code, purpose) {
    try {
        const normalizedEmail = email.trim().toLowerCase();
        // Check if there's a verified code within the last 30 minutes
        const result = await connection_1.default.query(`SELECT id FROM verification_codes
       WHERE email = $1 AND code = $2 AND purpose = $3 
       AND verified = TRUE 
       AND created_at > NOW() - INTERVAL '30 minutes'
       ORDER BY created_at DESC
       LIMIT 1`, [normalizedEmail, code, purpose]);
        return result.rows.length > 0;
    }
    catch (error) {
        console.error('Error checking if code is recently verified:', error);
        return false;
    }
}
/**
 * Clean up expired verification codes
 */
async function cleanupExpiredCodes() {
    try {
        await connection_1.default.query('DELETE FROM verification_codes WHERE expires_at < CURRENT_TIMESTAMP OR verified = TRUE');
    }
    catch (error) {
        console.error('Error cleaning up expired codes:', error);
    }
}
