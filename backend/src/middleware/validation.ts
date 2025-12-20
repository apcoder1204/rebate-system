import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';

/**
 * Validation middleware to check validation results
 */
export const validate = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.type === 'field' ? err.path : 'unknown',
        message: err.msg
      }))
    });
  }
  next();
};

/**
 * Sanitize string input to prevent XSS and injection
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') return '';
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/['";\\]/g, '') // Remove SQL injection characters
    .substring(0, 1000); // Limit length
}

/**
 * Validate UUID format
 */
export function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
}

/**
 * Validate phone number (basic validation)
 */
export function isValidPhone(phone: string): boolean {
  // Allow international format with + or local format
  const phoneRegex = /^(\+?\d{1,4}[\s-]?)?\(?\d{1,4}\)?[\s-]?\d{1,9}[\s-]?\d{1,9}$/;
  return phoneRegex.test(phone) && phone.length >= 10 && phone.length <= 20;
}

/**
 * Validate date string (ISO format)
 */
export function isValidDate(dateString: string): boolean {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Sanitize and validate numeric input
 */
export function sanitizeNumber(input: any, min?: number, max?: number): number | null {
  const num = typeof input === 'string' ? parseFloat(input) : Number(input);
  if (isNaN(num)) return null;
  if (min !== undefined && num < min) return null;
  if (max !== undefined && num > max) return null;
  return num;
}

/**
 * Validate role value
 */
export function isValidRole(role: string): boolean {
  return ['admin', 'manager', 'staff', 'user'].includes(role);
}

/**
 * Validate order status
 */
export function isValidOrderStatus(status: string): boolean {
  return ['pending', 'confirmed', 'cancelled'].includes(status);
}

/**
 * Validate contract status
 */
export function isValidContractStatus(status: string): boolean {
  return ['pending', 'pending_approval', 'approved', 'active', 'rejected', 'expired'].includes(status);
}

/**
 * Sanitize sortBy parameter to prevent SQL injection
 */
export function sanitizeSortBy(sortBy: string, allowedFields: string[], defaultSort: string = ''): string {
  if (!sortBy) return defaultSort;
  
  // Remove any SQL injection attempts
  const cleaned = sortBy.replace(/[^a-zA-Z0-9_-]/g, '');
  
  // Check if it's a valid field with optional - prefix
  const isDescending = cleaned.startsWith('-');
  const field = isDescending ? cleaned.substring(1) : cleaned;
  
  if (allowedFields.includes(field)) {
    return isDescending ? `-${field}` : field;
  }
  
  return defaultSort;
}

