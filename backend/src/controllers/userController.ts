import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db/connection';
import { AuthRequest } from '../middleware/auth';
import * as twilioService from '../services/twilioService';
import * as emailService from '../services/emailService';
import { sanitizeString, isValidEmail, isValidPhone, isValidUUID, sanitizeNumber } from '../middleware/validation';

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Validate and sanitize email
    const sanitizedEmail = sanitizeString(email.toLowerCase());
    if (!isValidEmail(sanitizedEmail)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    // Validate password type and max length (don't enforce min length for login - existing users may have shorter passwords)
    if (typeof password !== 'string' || password.length > 128) {
      return res.status(400).json({ error: 'Invalid password format' });
    }
    
    const result = await pool.query(
      'SELECT id, email, password_hash, full_name, role, phone, created_date, is_active FROM users WHERE email = $1',
      [sanitizedEmail]
    );
    
    if (result.rows.length === 0) {
      console.log(`Login attempt failed: User not found for email: ${sanitizedEmail}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = result.rows[0];

    // Check if account is active
    if (user.is_active === false) {
      console.log(`Login attempt failed: Inactive account for email: ${sanitizedEmail}`);
      return res.status(403).json({ error: 'Account is inactive. Please contact support.' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!isValidPassword) {
      console.log(`Login attempt failed: Invalid password for email: ${sanitizedEmail}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any }
    );
    
    console.log(`Login successful for user: ${user.email} (${user.role})`);
    
    res.json({
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        phone: user.phone,
        created_date: user.created_date,
      },
      token,
    });
  } catch (error: any) {
    console.error('Login error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      email: req.body?.email,
    });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, full_name, phone, requested_role, verification_code } = req.body;
    
    if (!email || !password || !full_name || !phone) {
      return res.status(400).json({ error: 'Email, password, full name, and phone are required' });
    }
    
    // Validate and sanitize inputs
    const sanitizedEmail = sanitizeString(email.toLowerCase());
    if (!isValidEmail(sanitizedEmail)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    if (typeof password !== 'string' || password.length < 6 || password.length > 128) {
      return res.status(400).json({ error: 'Password must be between 6 and 128 characters' });
    }
    
    const sanitizedFullName = sanitizeString(full_name);
    if (sanitizedFullName.length < 2 || sanitizedFullName.length > 100) {
      return res.status(400).json({ error: 'Full name must be between 2 and 100 characters' });
    }
    
    if (!isValidPhone(phone)) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }
    
    // Validate requested_role if provided
    if (requested_role && !['admin', 'manager', 'staff'].includes(requested_role)) {
      return res.status(400).json({ error: 'Invalid role requested' });
    }
    
    // Validate verification code format if provided
    if (verification_code && (typeof verification_code !== 'string' || verification_code.length !== 6)) {
      return res.status(400).json({ error: 'Invalid verification code format' });
    }
    
    // Check if user already exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [sanitizedEmail]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }
    
    // Verify email if verification code is provided
    if (verification_code) {
      const verification = await emailService.verifyEmailCode(sanitizedEmail, verification_code, 'registration');
      if (!verification.success) {
        // Code might have been verified already - check if recently verified
        const isRecentlyVerified = await emailService.isCodeRecentlyVerified(sanitizedEmail, verification_code, 'registration');
        if (!isRecentlyVerified) {
          return res.status(400).json({ error: verification.message || 'Invalid verification code' });
        }
      }
    } else {
      // Check if email is already verified (for existing verification)
      const isVerified = await emailService.isEmailVerified(sanitizedEmail);
      if (!isVerified) {
        return res.status(400).json({ 
          error: 'Email verification required. Please verify your email address first.' 
        });
      }
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Format phone number
    let formattedPhone = phone.trim();
    if (!formattedPhone.startsWith('+')) {
      if (formattedPhone.startsWith('0')) {
        formattedPhone = '+255' + formattedPhone.substring(1);
      } else {
        formattedPhone = '+255' + formattedPhone;
      }
    }
    
    // Always create user with 'user' role initially
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, phone, role, phone_verified, email_verified, is_active) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING id, email, full_name, role, phone, created_date, is_active`,
      [sanitizedEmail, hashedPassword, sanitizedFullName, formattedPhone, 'user', true, true, true]
    );
    
    const user = result.rows[0];
    
    // If user requested a higher role, create a role request
    if (requested_role && requested_role !== 'user') {
      await pool.query(
        `INSERT INTO role_requests (user_id, requested_role, status) 
         VALUES ($1, $2, 'pending')`,
        [user.id, requested_role]
      );
    }
    
    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        phone: user.phone,
        created_date: user.created_date,
      },
      role_requested: requested_role && requested_role !== 'user' ? true : false,
      message: requested_role && requested_role !== 'user' 
        ? 'Your account has been created. Your role request is pending approval. Please login to continue.' 
        : 'Account created successfully. Please login to continue.',
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMe = async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT id, email, full_name, role, phone, created_date FROM users WHERE id = $1',
      [req.user!.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    let fullName: string | null = null;
    let phone: string | null = null;
    
    if (req.body.full_name !== undefined) {
      if (typeof req.body.full_name !== 'string') {
        return res.status(400).json({ error: 'Full name must be a string' });
      }
      fullName = sanitizeString(req.body.full_name);
      if (fullName.length < 2 || fullName.length > 100) {
        return res.status(400).json({ error: 'Full name must be between 2 and 100 characters' });
      }
    }
    
    if (req.body.phone !== undefined) {
      if (typeof req.body.phone !== 'string') {
        return res.status(400).json({ error: 'Phone must be a string' });
      }
      const trimmedPhone = req.body.phone.trim();
      if (!isValidPhone(trimmedPhone)) {
        return res.status(400).json({ error: 'Invalid phone number format' });
      }
      phone = trimmedPhone;
    }

    if (!fullName && !phone) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    const result = await pool.query(
      `UPDATE users 
       SET full_name = COALESCE($1, full_name),
           phone = COALESCE($2, phone)
       WHERE id = $3
       RETURNING id, email, full_name, role, phone, created_date, updated_date`,
      [fullName, phone, req.user!.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: result.rows[0],
      message: 'Profile updated successfully',
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const changePassword = async (req: AuthRequest, res: Response) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Current and new passwords are required' });
    }

    // Validate password types and lengths
    if (typeof current_password !== 'string' || typeof new_password !== 'string') {
      return res.status(400).json({ error: 'Passwords must be strings' });
    }

    if (new_password.length < 6 || new_password.length > 128) {
      return res.status(400).json({ error: 'New password must be between 6 and 128 characters' });
    }
    
    if (current_password.length > 128) {
      return res.status(400).json({ error: 'Invalid current password format' });
    }

    const userResult = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user!.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    const isCurrentValid = await bcrypt.compare(current_password, user.password_hash);

    if (!isCurrentValid) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const isSamePassword = await bcrypt.compare(new_password, user.password_hash);
    if (isSamePassword) {
      return res.status(400).json({ error: 'New password must be different from current password' });
    }

    const hashedPassword = await bcrypt.hash(new_password, 10);
    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [hashedPassword, req.user!.id]
    );

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const listUsers = async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT id, email, full_name, role, phone, created_date, is_active FROM users ORDER BY created_date DESC'
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get role requests (admin/manager only)
export const getRoleRequests = async (req: AuthRequest, res: Response) => {
  try {
    const status = (req.query.status as string) || 'pending';
    
    // Validate status to prevent SQL injection
    const validStatuses = ['pending', 'approved', 'rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be pending, approved, or rejected' });
    }
    
    const result = await pool.query(
      `SELECT 
        rr.*,
        u.email as user_email,
        u.full_name as user_name,
        reviewer.email as reviewer_email,
        reviewer.full_name as reviewer_name
      FROM role_requests rr
      LEFT JOIN users u ON rr.user_id = u.id
      LEFT JOIN users reviewer ON rr.reviewed_by = reviewer.id
      WHERE rr.status = $1
      ORDER BY rr.requested_date DESC`,
      [status]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Get role requests error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Approve or reject role request (admin/manager only)
export const reviewRoleRequest = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { action, comment } = req.body; // action: 'approve' or 'reject'
    
    // Validate ID format
    if (!isValidUUID(id)) {
      return res.status(400).json({ error: 'Invalid request ID format' });
    }
    
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Use "approve" or "reject"' });
    }
    
    // Sanitize comment if provided
    const sanitizedComment = comment ? sanitizeString(comment).substring(0, 500) : null;
    
    // Get the role request
    const requestResult = await pool.query(
      'SELECT * FROM role_requests WHERE id = $1',
      [id]
    );
    
    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: 'Role request not found' });
    }
    
    const roleRequest = requestResult.rows[0];
    
    if (roleRequest.status !== 'pending') {
      return res.status(400).json({ error: 'Role request has already been reviewed' });
    }
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const newStatus = action === 'approve' ? 'approved' : 'rejected';
      
      // Update role request
      await client.query(
        `UPDATE role_requests 
         SET status = $1, reviewed_by = $2, reviewed_date = CURRENT_TIMESTAMP, review_comment = $3
         WHERE id = $4`,
        [newStatus, req.user!.id, sanitizedComment, id]
      );
      
      // If approved, update user role
      if (action === 'approve') {
        await client.query(
          'UPDATE users SET role = $1 WHERE id = $2',
          [roleRequest.requested_role, roleRequest.user_id]
        );
      }
      
      await client.query('COMMIT');
      
      res.json({
        message: `Role request ${action}d successfully`,
        role_request_id: id,
        action: newStatus,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Review role request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteUser = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Validate ID format
    if (!isValidUUID(id)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    // Only admins can delete users
    if (req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can delete users' });
    }

    // Prevent self-delete
    if (req.user!.id === id) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }

    // Check if target exists and role
    const userResult = await pool.query(
      'SELECT role FROM users WHERE id = $1',
      [id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const targetRole = userResult.rows[0].role;

    // Prevent removing last admin
    if (targetRole === 'admin') {
      const adminCount = await pool.query("SELECT COUNT(*) as count FROM users WHERE role = 'admin'");
      if (parseInt(adminCount.rows[0].count) <= 1) {
        return res.status(400).json({ error: 'Cannot delete the last admin. Promote another admin first.' });
      }
    }

    await pool.query('DELETE FROM users WHERE id = $1', [id]);

    res.json({ message: 'User deleted successfully', user_id: id });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update user role directly (admin only, with safety checks)
export const updateUserRole = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    
    // Validate ID format
    if (!isValidUUID(id)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }
    
    if (!['admin', 'manager', 'staff', 'user'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    
    // Get current user role
    const userResult = await pool.query(
      'SELECT role FROM users WHERE id = $1',
      [id]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const currentRole = userResult.rows[0].role;
    
    // Safety check: Prevent removing the last admin
    if (currentRole === 'admin' && role !== 'admin') {
      const adminCount = await pool.query(
        "SELECT COUNT(*) as count FROM users WHERE role = 'admin'"
      );
      
      if (parseInt(adminCount.rows[0].count) <= 1) {
        return res.status(400).json({ 
          error: 'Cannot remove the last admin. Please promote another user to admin first.' 
        });
      }
    }
    
    // Update user role
    await pool.query(
      'UPDATE users SET role = $1 WHERE id = $2',
      [role, id]
    );
    
    res.json({
      message: 'User role updated successfully',
      user_id: id,
      new_role: role,
    });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get user's own role request status
export const getMyRoleRequest = async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT rr.*, 
        reviewer.email as reviewer_email,
        reviewer.full_name as reviewer_name
      FROM role_requests rr
      LEFT JOIN users reviewer ON rr.reviewed_by = reviewer.id
      WHERE rr.user_id = $1 AND rr.status = 'pending'
      ORDER BY rr.requested_date DESC
      LIMIT 1`,
      [req.user!.id]
    );
    
    if (result.rows.length === 0) {
      return res.json({ has_pending_request: false });
    }
    
    return res.json({
      has_pending_request: true,
      request: result.rows[0],
    });
  } catch (error) {
    console.error('Get my role request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Send verification code
export const sendVerificationCode = async (req: Request, res: Response) => {
  try {
    const { phone, purpose } = req.body;
    
    if (!phone || typeof phone !== 'string') {
      return res.status(400).json({ error: 'Phone number is required' });
    }
    
    if (!purpose || !['registration', 'password_reset'].includes(purpose)) {
      return res.status(400).json({ error: 'Invalid purpose. Use "registration" or "password_reset"' });
    }
    
    // Validate phone format
    if (!isValidPhone(phone)) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }
    
    // For password reset, check if user exists
    if (purpose === 'password_reset') {
      let formattedPhone = phone.trim();
      if (!formattedPhone.startsWith('+')) {
        if (formattedPhone.startsWith('0')) {
          formattedPhone = '+255' + formattedPhone.substring(1);
        } else {
          formattedPhone = '+255' + formattedPhone;
        }
      }
      
      const userResult = await pool.query(
        'SELECT id FROM users WHERE phone = $1',
        [formattedPhone]
      );
      
      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'No account found with this phone number' });
      }
    }
    
    const result = await twilioService.sendVerificationCode(phone, purpose);
    
    if (!result.success) {
      return res.status(400).json({ error: result.message || 'Failed to send verification code' });
    }
    
    res.json({
      message: result.message || 'Verification code sent successfully',
      // Only return code in dev mode for registration, not password reset
      ...(result.code && purpose === 'registration' && { code: result.code, dev_mode: true }),
    });
  } catch (error) {
    console.error('Send verification code error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Verify code
export const verifyCode = async (req: Request, res: Response) => {
  try {
    const { phone, code, purpose } = req.body;
    
    if (!phone || !code || !purpose) {
      return res.status(400).json({ error: 'Phone, code, and purpose are required' });
    }
    
    if (typeof phone !== 'string' || typeof code !== 'string' || typeof purpose !== 'string') {
      return res.status(400).json({ error: 'Invalid input types' });
    }
    
    if (!isValidPhone(phone)) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }
    
    // Validate code format (6 digits)
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: 'Verification code must be 6 digits' });
    }
    
    if (!['registration', 'password_reset'].includes(purpose)) {
      return res.status(400).json({ error: 'Invalid purpose' });
    }
    
    const result = await twilioService.verifyCode(phone, code, purpose as 'registration' | 'password_reset');
    
    if (!result.success) {
      return res.status(400).json({ error: result.message || 'Verification failed' });
    }
    
    res.json({ message: result.message || 'Code verified successfully' });
  } catch (error) {
    console.error('Verify code error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Reset password (phone-based - legacy)
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { phone, verification_code, new_password } = req.body;
    
    if (!phone || !verification_code || !new_password) {
      return res.status(400).json({ error: 'Phone, verification code, and new password are required' });
    }
    
    if (typeof phone !== 'string' || typeof verification_code !== 'string' || typeof new_password !== 'string') {
      return res.status(400).json({ error: 'Invalid input types' });
    }
    
    if (!isValidPhone(phone)) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }
    
    // Validate verification code format
    if (!/^\d{6}$/.test(verification_code)) {
      return res.status(400).json({ error: 'Verification code must be 6 digits' });
    }
    
    if (new_password.length < 6 || new_password.length > 128) {
      return res.status(400).json({ error: 'Password must be between 6 and 128 characters' });
    }
    
    // Verify code first
    const verification = await twilioService.verifyCode(phone, verification_code, 'password_reset');
    if (!verification.success) {
      return res.status(400).json({ error: verification.message || 'Invalid verification code' });
    }
    
    // Format phone number
    let formattedPhone = phone.trim();
    if (!formattedPhone.startsWith('+')) {
      if (formattedPhone.startsWith('0')) {
        formattedPhone = '+255' + formattedPhone.substring(1);
      } else {
        formattedPhone = '+255' + formattedPhone;
      }
    }
    
    // Find user by phone
    const userResult = await pool.query(
      'SELECT id FROM users WHERE phone = $1',
      [formattedPhone]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Update password
    const hashedPassword = await bcrypt.hash(new_password, 10);
    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [hashedPassword, userResult.rows[0].id]
    );
    
    res.json({ message: 'Password reset successfully. Please login with your new password.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ==================== EMAIL-BASED VERIFICATION (Resend) ====================

// Send email verification code
export const sendEmailVerificationCode = async (req: Request, res: Response) => {
  try {
    const { email, purpose } = req.body;
    
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    if (!purpose || !['registration', 'password_reset'].includes(purpose)) {
      return res.status(400).json({ error: 'Invalid purpose. Use "registration" or "password_reset"' });
    }
    
    // Validate email format
    const sanitizedEmail = sanitizeString(email.toLowerCase());
    if (!isValidEmail(sanitizedEmail)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    // For password reset, check if user exists
    if (purpose === 'password_reset') {
      const userResult = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [sanitizedEmail]
      );
      
      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'No account found with this email address' });
      }
    }
    
    const result = await emailService.sendVerificationCodeByEmail(sanitizedEmail, purpose);
    
    if (!result.success) {
      return res.status(400).json({ error: result.message || 'Failed to send verification code' });
    }
    
    res.json({
      message: result.message || 'Verification code sent to your email',
    });
  } catch (error) {
    console.error('Send email verification code error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Verify email code
export const verifyEmailCode = async (req: Request, res: Response) => {
  try {
    const { email, code, purpose } = req.body;
    
    if (!email || !code || !purpose) {
      return res.status(400).json({ error: 'Email, code, and purpose are required' });
    }
    
    if (typeof email !== 'string' || typeof code !== 'string' || typeof purpose !== 'string') {
      return res.status(400).json({ error: 'Invalid input types' });
    }
    
    const sanitizedEmail = sanitizeString(email.toLowerCase());
    if (!isValidEmail(sanitizedEmail)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    // Validate code format (6 digits)
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: 'Verification code must be 6 digits' });
    }
    
    if (!['registration', 'password_reset'].includes(purpose)) {
      return res.status(400).json({ error: 'Invalid purpose' });
    }
    
    const result = await emailService.verifyEmailCode(sanitizedEmail, code, purpose as 'registration' | 'password_reset');
    
    if (!result.success) {
      return res.status(400).json({ error: result.message || 'Verification failed' });
    }
    
    res.json({ message: result.message || 'Code verified successfully' });
  } catch (error) {
    console.error('Verify email code error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Reset password by email
export const resetPasswordByEmail = async (req: Request, res: Response) => {
  try {
    const { email, verification_code, new_password } = req.body;
    
    if (!email || !verification_code || !new_password) {
      return res.status(400).json({ error: 'Email, verification code, and new password are required' });
    }
    
    if (typeof email !== 'string' || typeof verification_code !== 'string' || typeof new_password !== 'string') {
      return res.status(400).json({ error: 'Invalid input types' });
    }
    
    const sanitizedEmail = sanitizeString(email.toLowerCase());
    if (!isValidEmail(sanitizedEmail)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    // Validate verification code format
    if (!/^\d{6}$/.test(verification_code)) {
      return res.status(400).json({ error: 'Verification code must be 6 digits' });
    }
    
    if (new_password.length < 6 || new_password.length > 128) {
      return res.status(400).json({ error: 'Password must be between 6 and 128 characters' });
    }
    
    // Check if code is valid - first try to verify unverified code, then check if already verified
    const verification = await emailService.verifyEmailCode(sanitizedEmail, verification_code, 'password_reset');
    if (!verification.success) {
      // Code might have been verified in a previous step - check if it was recently verified
      const isRecentlyVerified = await emailService.isCodeRecentlyVerified(sanitizedEmail, verification_code, 'password_reset');
      if (!isRecentlyVerified) {
        return res.status(400).json({ error: verification.message || 'Invalid verification code' });
      }
    }
    
    // Find user by email
    const userResult = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [sanitizedEmail]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Update password
    const hashedPassword = await bcrypt.hash(new_password, 10);
    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [hashedPassword, userResult.rows[0].id]
    );
    
    res.json({ message: 'Password reset successfully. Please login with your new password.' });
  } catch (error) {
    console.error('Reset password by email error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
