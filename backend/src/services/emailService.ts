import { Resend } from 'resend';
import pool from '../db/connection';

// Initialize Resend client
const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

// Email sender configuration
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@cctvpoint.org';
// Ensure APP_NAME is a clean name, not a URL
const APP_NAME = process.env.APP_NAME || 'CCTV Point Rebate';

/**
 * Generate a random 6-digit verification code
now dont implement anything but i have couple of qns to ask you 
1. is JWT_SECRET important and why?
2.now what if i need to do ammends of some parts of System will my current data stay in place even if it requires some modification on db
3.how do i get backup assuarance?
4. wha i need to implement signup/signin with google? 
*/
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Send verification code via email using Resend
 */
export async function sendVerificationCodeByEmail(
  email: string,
  purpose: 'registration' | 'password_reset'
): Promise<{ success: boolean; code?: string; message?: string }> {
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

    await pool.query(
      `INSERT INTO verification_codes (email, code, purpose, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [normalizedEmail, code, purpose, expiresAt]
    );

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

      if (process.env.NODE_ENV !== 'production') {
        console.log(`Verification email sent to ${normalizedEmail}, ID: ${data?.id}`);
      } else {
        console.log(`Verification email sent, ID: ${data?.id}`);
      }
      return { success: true, message: 'Verification code sent to your email' };
    } catch (resendError: any) {
      console.error('Resend error:', resendError);
      return {
        success: false,
        message: `Failed to send email: ${resendError.message}. Please try again.`,
      };
    }
  } catch (error: any) {
    console.error('Error sending verification code:', error);
    return { success: false, message: error.message || 'Failed to send verification code' };
  }
}

/**
 * Verify the code entered by user (email-based)
 */
export async function verifyEmailCode(
  email: string,
  code: string,
  purpose: 'registration' | 'password_reset'
): Promise<{ success: boolean; message?: string }> {
  try {
    const normalizedEmail = email.trim().toLowerCase();

    // Find valid, unexpired, unverified code
    const result = await pool.query(
      `SELECT id, expires_at FROM verification_codes
       WHERE email = $1 AND code = $2 AND purpose = $3 
       AND verified = FALSE AND expires_at > CURRENT_TIMESTAMP
       ORDER BY created_at DESC
       LIMIT 1`,
      [normalizedEmail, code, purpose]
    );

    if (result.rows.length === 0) {
      return { success: false, message: 'Invalid or expired verification code' };
    }

    // Mark code as verified
    await pool.query(
      'UPDATE verification_codes SET verified = TRUE WHERE id = $1',
      [result.rows[0].id]
    );

    // If it's registration, mark email as verified in users table
    if (purpose === 'registration') {
      await pool.query(
        'UPDATE users SET email_verified = TRUE WHERE email = $1',
        [normalizedEmail]
      );
    }

    return { success: true, message: 'Code verified successfully' };
  } catch (error: any) {
    console.error('Error verifying code:', error);
    return { success: false, message: error.message || 'Failed to verify code' };
  }
}

/**
 * Check if email is already verified (for registration)
 * This checks if there's a verified code in the verification_codes table
 */
export async function isEmailVerified(email: string): Promise<boolean> {
  try {
    const normalizedEmail = email.trim().toLowerCase();

    // Check if there's a recently verified code for this email (within last 30 minutes)
    const result = await pool.query(
      `SELECT id FROM verification_codes 
       WHERE email = $1 AND purpose = 'registration' AND verified = TRUE
       AND created_at > NOW() - INTERVAL '30 minutes'
       ORDER BY created_at DESC
       LIMIT 1`,
      [normalizedEmail]
    );

    return result.rows.length > 0;
  } catch (error) {
    console.error('Error checking email verification:', error);
    return false;
  }
}

/**
 * Check if a code was recently verified (for password reset flow where code is verified separately)
 */
export async function isCodeRecentlyVerified(
  email: string,
  code: string,
  purpose: 'registration' | 'password_reset'
): Promise<boolean> {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    
    // Check if there's a verified code within the last 30 minutes
    const result = await pool.query(
      `SELECT id FROM verification_codes
       WHERE email = $1 AND code = $2 AND purpose = $3 
       AND verified = TRUE 
       AND created_at > NOW() - INTERVAL '30 minutes'
       ORDER BY created_at DESC
       LIMIT 1`,
      [normalizedEmail, code, purpose]
    );
    
    return result.rows.length > 0;
  } catch (error) {
    console.error('Error checking if code is recently verified:', error);
    return false;
  }
}

/**
 * Clean up expired verification codes
 */
export async function cleanupExpiredCodes(): Promise<void> {
  try {
    await pool.query(
      'DELETE FROM verification_codes WHERE expires_at < CURRENT_TIMESTAMP OR verified = TRUE'
    );
  } catch (error) {
    console.error('Error cleaning up expired codes:', error);
  }
}

/**
 * Send order reminder email to customer
 */
export async function sendOrderReminderEmail(
  email: string,
  customerName: string,
  orderNumber: string,
  orderDate: string,
  totalAmount: number,
  rebateAmount: number
): Promise<{ success: boolean; message?: string }> {
  try {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email.trim())) {
      return { success: false, message: 'Invalid email address' };
    }

    const normalizedEmail = email.trim().toLowerCase();

    // If Resend is not configured, return error
    if (!resend) {
      console.error('Resend API key is not configured');
      return {
        success: false,
        message: 'Email service is not configured. Please contact support.',
      };
    }

    const subject = `${APP_NAME} - Reminder: Please Confirm Your Order`;
    const formattedDate = new Date(orderDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const formattedTotal = parseFloat(String(totalAmount)).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    const formattedRebate = parseFloat(String(rebateAmount)).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1e293b; margin: 0; font-size: 24px;">Order Confirmation Reminder</h1>
          </div>
          <p style="color: #475569; font-size: 16px; line-height: 1.6;">
            Dear ${customerName || 'Valued Customer'},
          </p>
          <p style="color: #475569; font-size: 16px; line-height: 1.6;">
            This is a friendly reminder that you have a pending order that requires your confirmation.
          </p>
          <div style="background: #f8fafc; border-left: 4px solid #3b82f6; padding: 20px; margin: 24px 0; border-radius: 4px;">
            <p style="margin: 0 0 8px 0; color: #1e293b; font-weight: 600;">Order Details:</p>
            <p style="margin: 4px 0; color: #475569;"><strong>Order Number:</strong> ${orderNumber}</p>
            <p style="margin: 4px 0; color: #475569;"><strong>Order Date:</strong> ${formattedDate}</p>
            <p style="margin: 4px 0; color: #475569;"><strong>Total Amount:</strong> Tsh ${formattedTotal}</p>
            <p style="margin: 4px 0; color: #10b981; font-weight: 600;"><strong>Rebate Amount:</strong> Tsh ${formattedRebate}</p>
          </div>
          <p style="color: #475569; font-size: 16px; line-height: 1.6;">
            Please log in to your account to confirm or dispute this order. Your prompt action will help us process your rebate efficiently.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL || 'https://rebate.cctvpoint.org'}/my-orders" 
               style="display: inline-block; background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
              View My Orders
            </a>
          </div>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
          <p style="color: #94a3b8; font-size: 12px; text-align: center; line-height: 1.6;">
            If you have already confirmed this order, please ignore this email. If you have any questions or concerns, please contact our support team.
          </p>
          <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 16px;">
            Thank you for being a valued customer!
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

      if (process.env.NODE_ENV !== 'production') {
        console.log(`Order reminder email sent to ${normalizedEmail}, ID: ${data?.id}`);
      } else {
        console.log(`Order reminder email sent, ID: ${data?.id}`);
      }
      return { success: true, message: 'Order reminder email sent successfully' };
    } catch (resendError: any) {
      console.error('Resend error:', resendError);
      return {
        success: false,
        message: `Failed to send email: ${resendError.message}. Please try again.`,
      };
    }
  } catch (error: any) {
    console.error('Error sending order reminder email:', error);
    return { success: false, message: error.message || 'Failed to send order reminder email' };
  }
}

// ─── Swahili transactional email templates ────────────────────────────────────

const swahiliBase = (title: string, bodyHtml: string, ctaUrl: string, ctaLabel: string) => `
<!DOCTYPE html>
<html lang="sw">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Tahoma,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
      <!-- Header -->
      <tr>
        <td style="background:#0f172a;padding:28px 36px;">
          <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">CCTV Point</p>
          <p style="margin:4px 0 0;font-size:13px;color:#94a3b8;">Mfumo wa Usimamizi wa Rebate</p>
        </td>
      </tr>
      <!-- Body -->
      <tr>
        <td style="padding:36px 36px 28px;">
          ${bodyHtml}
          <div style="text-align:center;margin-top:32px;">
            <a href="${ctaUrl}" style="display:inline-block;background:#3b82f6;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;">${ctaLabel}</a>
          </div>
        </td>
      </tr>
      <!-- Footer -->
      <tr>
        <td style="background:#f8fafc;padding:20px 36px;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="margin:0;font-size:12px;color:#94a3b8;">© 2026 CCTV Point · Dar es Salaam, Tanzania</p>
          <p style="margin:4px 0 0;font-size:12px;color:#cbd5e1;">Tuma maswali kwenye: support@cctvpoint.org</p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

export async function sendWelcomeEmail(email: string, fullName: string): Promise<void> {
  if (!resend) return;
  const firstName = fullName.split(' ')[0];
  const frontendUrl = process.env.FRONTEND_URL || 'https://rebate.cctvpoint.org';
  const body = `
    <h2 style="margin:0 0 16px;font-size:24px;color:#0f172a;">Karibu, ${firstName}! 🎉</h2>
    <p style="margin:0 0 12px;font-size:15px;color:#334155;line-height:1.6;">
      Habari ${firstName}, <strong>karibu kwenye familia ya CCTV Point!</strong>
    </p>
    <p style="margin:0 0 12px;font-size:15px;color:#334155;line-height:1.6;">
      Akaunti yako imefunguliwa. Sasa unaweza kufuatilia maagizo yako, kukusanya rebate, na kupata taarifa zote kuhusu biashara yako moja kwa moja.
    </p>
    <div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:14px 18px;border-radius:0 8px 8px 0;margin:20px 0;">
      <p style="margin:0;font-size:14px;color:#1e40af;font-weight:600;">Jinsi ya kuanza:</p>
      <ul style="margin:8px 0 0;padding-left:20px;color:#1e40af;font-size:14px;line-height:1.8;">
        <li>Ingia kwenye mfumo wako</li>
        <li>Angalia maagizo yako ya hivi karibuni</li>
        <li>Fuatilia rebate yako inayokua</li>
      </ul>
    </div>
    <p style="margin:16px 0 0;font-size:14px;color:#64748b;">Asante kwa kuchagua CCTV Point. Tuko hapa kukusaidia!</p>`;
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Karibu CCTV Point! Akaunti Yako Imefunguliwa',
      html: swahiliBase('Karibu CCTV Point', body, `https://${frontendUrl}`, 'Ingia Sasa'),
    });
  } catch (err) {
    console.error('[email] sendWelcomeEmail failed:', err);
  }
}

export async function sendOrderCreatedEmail(
  email: string,
  fullName: string,
  orderNumber: string,
  totalAmount: number,
  rebateAmount: number
): Promise<void> {
  if (!resend) return;
  const firstName = fullName.split(' ')[0];
  const frontendUrl = process.env.FRONTEND_URL || 'https://rebate.cctvpoint.org';
  const body = `
    <h2 style="margin:0 0 16px;font-size:22px;color:#0f172a;">Agizo Lako Limepokelewa</h2>
    <p style="margin:0 0 16px;font-size:15px;color:#334155;">Habari ${firstName}, agizo lako limefika salama na linasubiri uthibitisho.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:16px;">
      <tr><td style="padding:18px 20px;">
        <table width="100%">
          <tr>
            <td style="font-size:13px;color:#64748b;padding-bottom:8px;">Nambari ya Agizo</td>
            <td style="font-size:13px;color:#0f172a;font-weight:700;text-align:right;padding-bottom:8px;">${orderNumber}</td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#64748b;padding-bottom:8px;">Jumla ya Thamani</td>
            <td style="font-size:13px;color:#0f172a;font-weight:700;text-align:right;padding-bottom:8px;">Tsh ${totalAmount.toLocaleString('en-TZ', { minimumFractionDigits: 2 })}</td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#16a34a;font-weight:600;">Rebate Inayokusanyika</td>
            <td style="font-size:13px;color:#16a34a;font-weight:700;text-align:right;">Tsh ${rebateAmount.toLocaleString('en-TZ', { minimumFractionDigits: 2 })}</td>
          </tr>
        </table>
      </td></tr>
    </table>
    <p style="margin:0;font-size:14px;color:#64748b;line-height:1.6;">Timu yetu itakagua agizo lako hivi karibuni. Utapata taarifa ukisha kuthibitishwa.</p>`;
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `Agizo Lako Limepokelewa — ${orderNumber}`,
      html: swahiliBase('Agizo Limepokelewa', body, `https://${frontendUrl}/my-orders`, 'Angalia Maagizo Yangu'),
    });
  } catch (err) {
    console.error('[email] sendOrderCreatedEmail failed:', err);
  }
}

export async function sendContractApprovedEmail(
  email: string,
  fullName: string,
  contractNumber: string,
  endDate: string
): Promise<void> {
  if (!resend) return;
  const firstName = fullName.split(' ')[0];
  const frontendUrl = process.env.FRONTEND_URL || 'https://rebate.cctvpoint.org';
  const formattedEnd = new Date(endDate).toLocaleDateString('sw-TZ', { year: 'numeric', month: 'long', day: 'numeric' });
  const body = `
    <h2 style="margin:0 0 16px;font-size:22px;color:#0f172a;">Mkataba Wako Umeidhinishwa! ✅</h2>
    <p style="margin:0 0 16px;font-size:15px;color:#334155;">Hongera ${firstName}! Mkataba wako na CCTV Point umeidhinishwa rasmi.</p>
    <div style="background:#f0fdf4;border-left:4px solid #16a34a;padding:14px 18px;border-radius:0 8px 8px 0;margin:0 0 16px;">
      <p style="margin:0 0 6px;font-size:13px;color:#64748b;">Nambari ya Mkataba</p>
      <p style="margin:0;font-size:18px;font-weight:700;color:#15803d;">${contractNumber}</p>
      <p style="margin:8px 0 0;font-size:13px;color:#64748b;">Mkataba unaisha: <strong style="color:#166534;">${formattedEnd}</strong></p>
    </div>
    <p style="margin:0 0 12px;font-size:15px;color:#334155;line-height:1.6;">
      Sasa unaweza kuanza kuagiza bidhaa na kukusanya rebate yako ya <strong>1%</strong> ya kila agizo. Rebate yote itakulipwa mkataba ukiisha.
    </p>
    <p style="margin:0;font-size:14px;color:#64748b;">Agiza zaidi, pata zaidi — rebate yako inakua na kila nunuzi!</p>`;
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `Mkataba Wako Umeidhinishwa — ${contractNumber}`,
      html: swahiliBase('Mkataba Umeidhinishwa', body, `https://${frontendUrl}/my-contracts`, 'Angalia Mkataba Wangu'),
    });
  } catch (err) {
    console.error('[email] sendContractApprovedEmail failed:', err);
  }
}

export async function sendRebateReminderEmail(
  email: string,
  fullName: string,
  contractNumber: string,
  unpaidRebate: number
): Promise<void> {
  if (!resend) return;
  const firstName = fullName.split(' ')[0];
  const frontendUrl = process.env.FRONTEND_URL || 'https://rebate.cctvpoint.org';
  const body = `
    <h2 style="margin:0 0 16px;font-size:22px;color:#0f172a;">Rebate Yako Inakusubiri! 💰</h2>
    <p style="margin:0 0 16px;font-size:15px;color:#334155;">Habari ${firstName},</p>
    <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.6;">
      Mkataba wako nambari <strong>${contractNumber}</strong> umeisha na una rebate inayosubiri malipo.
    </p>
    <div style="background:#fefce8;border:2px solid #eab308;border-radius:8px;padding:20px;text-align:center;margin:20px 0;">
      <p style="margin:0 0 4px;font-size:13px;color:#713f12;">Jumla ya Rebate Inayosubiri</p>
      <p style="margin:0;font-size:32px;font-weight:800;color:#854d0e;">Tsh ${unpaidRebate.toLocaleString('en-TZ', { minimumFractionDigits: 2 })}</p>
    </div>
    <p style="margin:0 0 12px;font-size:15px;color:#334155;line-height:1.6;">
      Wasiliana na timu yetu leo ili kupanga malipo yako. Usikose fedha zako!
    </p>
    <p style="margin:0;font-size:14px;color:#64748b;">Kama una maswali, piga simu au tuma ujumbe kwenye <a href="mailto:support@cctvpoint.org" style="color:#3b82f6;">support@cctvpoint.org</a>.</p>`;
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `Kumbukumbu: Rebate Yako ya Tsh ${unpaidRebate.toLocaleString()} Inakusubiri`,
      html: swahiliBase('Dai Rebate Yako', body, `https://${frontendUrl}/my-orders`, 'Angalia Maagizo Yangu'),
    });
  } catch (err) {
    console.error('[email] sendRebateReminderEmail failed:', err);
  }
}

export async function sendContractRenewalReminderEmail(
  email: string,
  fullName: string,
  contractNumber: string,
  expiryDate: string,
  daysLeft: number
): Promise<void> {
  if (!resend) return;
  const firstName = fullName.split(' ')[0];
  const frontendUrl = process.env.FRONTEND_URL || 'https://rebate.cctvpoint.org';
  const formattedExpiry = new Date(expiryDate).toLocaleDateString('sw-TZ', { year: 'numeric', month: 'long', day: 'numeric' });
  const urgencyColor = daysLeft <= 7 ? '#dc2626' : '#d97706';
  const body = `
    <h2 style="margin:0 0 16px;font-size:22px;color:#0f172a;">Mkataba Wako Unakwisha Hivi Karibuni ⚠️</h2>
    <p style="margin:0 0 16px;font-size:15px;color:#334155;">Habari ${firstName},</p>
    <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.6;">
      Mkataba wako nambari <strong>${contractNumber}</strong> unakwisha hivi karibuni. Fanya upya leo ili kuendelea kukusanya rebate yako.
    </p>
    <div style="background:#fff7ed;border:2px solid ${urgencyColor};border-radius:8px;padding:20px;text-align:center;margin:20px 0;">
      <p style="margin:0 0 4px;font-size:13px;color:#9a3412;">Mkataba Unaisha</p>
      <p style="margin:0 0 4px;font-size:22px;font-weight:800;color:${urgencyColor};">${formattedExpiry}</p>
      <p style="margin:0;font-size:13px;font-weight:600;color:${urgencyColor};">Siku ${daysLeft} zimebaki!</p>
    </div>
    <p style="margin:0 0 12px;font-size:15px;color:#334155;line-height:1.6;">
      Wasiliana na timu yetu haraka ili kufanya upya mkataba wako bila kukosa muda wa kukusanya rebate.
    </p>
    <p style="margin:0;font-size:14px;color:#64748b;">Piga simu au tuma ujumbe: <a href="mailto:support@cctvpoint.org" style="color:#3b82f6;">support@cctvpoint.org</a></p>`;
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `Haraka! Mkataba ${contractNumber} Unakwisha Siku ${daysLeft} Zimebaki`,
      html: swahiliBase('Fanya Upya Mkataba', body, `https://${frontendUrl}/my-contracts`, 'Angalia Mkataba Wangu'),
    });
  } catch (err) {
    console.error('[email] sendContractRenewalReminderEmail failed:', err);
  }
}

export async function sendRebatePaidEmail(
  email: string,
  fullName: string,
  contractNumber: string,
  paidAmount: number
): Promise<void> {
  if (!resend) return;
  const firstName = fullName.split(' ')[0];
  const frontendUrl = process.env.FRONTEND_URL || 'https://rebate.cctvpoint.org';
  const body = `
    <h2 style="margin:0 0 16px;font-size:22px;color:#0f172a;">Rebate Yako Imelipwa! 🎊</h2>
    <p style="margin:0 0 16px;font-size:15px;color:#334155;">Hongera sana ${firstName}!</p>
    <div style="background:#f0fdf4;border:2px solid #16a34a;border-radius:8px;padding:24px;text-align:center;margin:20px 0;">
      <p style="margin:0 0 4px;font-size:13px;color:#166534;">Jumla ya Rebate Iliyolipwa</p>
      <p style="margin:0 0 8px;font-size:36px;font-weight:800;color:#15803d;">Tsh ${paidAmount.toLocaleString('en-TZ', { minimumFractionDigits: 2 })}</p>
      <p style="margin:0;font-size:13px;color:#16a34a;">Mkataba: ${contractNumber}</p>
    </div>
    <p style="margin:0 0 12px;font-size:15px;color:#334155;line-height:1.6;">
      Timu ya CCTV Point imefanikisha malipo ya rebate yako. Asante kwa biashara yako na uaminifu wako kwetu.
    </p>
    <p style="margin:0 0 12px;font-size:15px;color:#334155;line-height:1.6;">
      Endelea kufanya biashara nasi na upate nafasi ya kukusanya rebate zaidi kwenye mkataba wako mpya!
    </p>
    <p style="margin:0;font-size:14px;color:#64748b;">Asante kwa kuchagua CCTV Point — tunashukuru uaminifu wako. 🙏</p>`;
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `Rebate Imelipwa — Tsh ${paidAmount.toLocaleString()} (${contractNumber})`,
      html: swahiliBase('Rebate Imelipwa', body, `https://${frontendUrl}/my-orders`, 'Angalia Historia Yangu'),
    });
  } catch (err) {
    console.error('[email] sendRebatePaidEmail failed:', err);
  }
}
