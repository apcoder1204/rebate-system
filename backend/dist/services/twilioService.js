"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendVerificationCode = sendVerificationCode;
exports.verifyCode = verifyCode;
exports.isPhoneVerified = isPhoneVerified;
exports.cleanupExpiredCodes = cleanupExpiredCodes;
const twilio_1 = __importDefault(require("twilio"));
const connection_1 = __importDefault(require("../db/connection"));
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
// Initialize Twilio client
const client = accountSid && authToken ? (0, twilio_1.default)(accountSid, authToken) : null;
/**
 * Generate a random 6-digit verification code
 */
function generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}
/**
 * Send verification code via SMS using Twilio
 */
async function sendVerificationCode(phone, purpose) {
    try {
        // Validate phone number format (basic validation)
        if (!phone || phone.trim().length < 10) {
            return { success: false, message: 'Invalid phone number' };
        }
        // Format phone number (ensure it starts with +)
        let formattedPhone = phone.trim();
        if (!formattedPhone.startsWith('+')) {
            // If no country code, assume Tanzania (+255)
            if (formattedPhone.startsWith('0')) {
                formattedPhone = '+255' + formattedPhone.substring(1);
            }
            else {
                formattedPhone = '+255' + formattedPhone;
            }
        }
        // Generate verification code
        const code = generateVerificationCode();
        // Store code in database (expires in 10 minutes)
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 10);
        await connection_1.default.query(`INSERT INTO verification_codes (phone, code, purpose, expires_at)
       VALUES ($1, $2, $3, $4)`, [formattedPhone, code, purpose, expiresAt]);
        // If Twilio is not configured, fail for password reset (no dev mode)
        if (!client || !twilioPhoneNumber) {
            if (purpose === 'password_reset') {
                return {
                    success: false,
                    message: 'SMS service is not configured. Please contact support.',
                };
            }
            // For registration, still allow dev mode
            console.log(`[DEV MODE] Verification code for ${formattedPhone}: ${code}`);
            return {
                success: true,
                code: code, // Return code in dev mode for registration only
                message: 'Verification code generated (Twilio not configured - check console)',
            };
        }
        // Send SMS via Twilio
        try {
            const message = await client.messages.create({
                body: `Your verification code is: ${code}. This code expires in 10 minutes.`,
                from: twilioPhoneNumber,
                to: formattedPhone,
            });
            console.log(`Verification SMS sent to ${formattedPhone}, SID: ${message.sid}`);
            return { success: true, message: 'Verification code sent successfully' };
        }
        catch (twilioError) {
            console.error('Twilio error:', twilioError);
            // If Twilio fails for password reset, don't return the code
            if (purpose === 'password_reset') {
                return {
                    success: false,
                    message: `Failed to send SMS: ${twilioError.message}. Please try again or contact support.`,
                };
            }
            // For registration, still return code in case of error
            return {
                success: true,
                code: code,
                message: `Twilio error: ${twilioError.message}. Code: ${code}`,
            };
        }
    }
    catch (error) {
        console.error('Error sending verification code:', error);
        return { success: false, message: error.message || 'Failed to send verification code' };
    }
}
/**
 * Verify the code entered by user
 */
async function verifyCode(phone, code, purpose) {
    try {
        // Format phone number
        let formattedPhone = phone.trim();
        if (!formattedPhone.startsWith('+')) {
            if (formattedPhone.startsWith('0')) {
                formattedPhone = '+255' + formattedPhone.substring(1);
            }
            else {
                formattedPhone = '+255' + formattedPhone;
            }
        }
        // Find valid, unexpired, unverified code
        const result = await connection_1.default.query(`SELECT id, expires_at FROM verification_codes
       WHERE phone = $1 AND code = $2 AND purpose = $3 
       AND verified = FALSE AND expires_at > CURRENT_TIMESTAMP
       ORDER BY created_at DESC
       LIMIT 1`, [formattedPhone, code, purpose]);
        if (result.rows.length === 0) {
            return { success: false, message: 'Invalid or expired verification code' };
        }
        // Mark code as verified
        await connection_1.default.query('UPDATE verification_codes SET verified = TRUE WHERE id = $1', [result.rows[0].id]);
        // If it's registration, mark phone as verified in users table
        if (purpose === 'registration') {
            await connection_1.default.query('UPDATE users SET phone_verified = TRUE WHERE phone = $1', [formattedPhone]);
        }
        return { success: true, message: 'Code verified successfully' };
    }
    catch (error) {
        console.error('Error verifying code:', error);
        return { success: false, message: error.message || 'Failed to verify code' };
    }
}
/**
 * Check if phone is already verified (for registration)
 */
async function isPhoneVerified(phone) {
    try {
        let formattedPhone = phone.trim();
        if (!formattedPhone.startsWith('+')) {
            if (formattedPhone.startsWith('0')) {
                formattedPhone = '+255' + formattedPhone.substring(1);
            }
            else {
                formattedPhone = '+255' + formattedPhone;
            }
        }
        const result = await connection_1.default.query('SELECT phone_verified FROM users WHERE phone = $1', [formattedPhone]);
        return result.rows.length > 0 && result.rows[0].phone_verified === true;
    }
    catch (error) {
        console.error('Error checking phone verification:', error);
        return false;
    }
}
/**
 * Clean up expired verification codes (can be run as a cron job)
 */
async function cleanupExpiredCodes() {
    try {
        await connection_1.default.query('DELETE FROM verification_codes WHERE expires_at < CURRENT_TIMESTAMP OR verified = TRUE');
    }
    catch (error) {
        console.error('Error cleaning up expired codes:', error);
    }
}
