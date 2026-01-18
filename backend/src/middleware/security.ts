import { Request, Response, NextFunction } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';

/**
 * Security headers middleware
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow file uploads
});

/**
 * Rate limiting for authentication endpoints
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  // Allow more room overall, but only count failed attempts
  max: process.env.NODE_ENV === 'production' ? 50 : 200,
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  // Only count failed logins (4xx/5xx). Successful logins are skipped.
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : '';
    // Use ipKeyGenerator helper for IPv6 compatibility
    const ip = ipKeyGenerator(req);
    return `${ip}:${email}`;
  },
  skip: (req) => {
    // Skip rate limiting for localhost in development
    return process.env.NODE_ENV !== 'production' && req.ip === '::1';
  },
});

/**
 * Rate limiting for general API endpoints
 * Uses user ID from JWT token for per-user rate limiting instead of IP-based
 */
export const apiRateLimit = rateLimit({
  windowMs: 150 * 60 * 1000, // 150 minutes
  max: 500, // Limit each user to 500 requests per windowMs
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use user ID from token if authenticated, otherwise fall back to IP
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      try {
        const jwtSecret = process.env.JWT_SECRET;
        if (jwtSecret && jwtSecret !== 'your-secret-key') {
          const decoded = jwt.verify(token, jwtSecret) as any;
          if (decoded?.id) {
            return decoded.id; // Per-user rate limiting
          }
        }
      } catch {
        // Invalid token, fall back to IP
      }
    }
    // Use ipKeyGenerator helper for IPv6 compatibility
    return ipKeyGenerator(req); // Fall back to IP for unauthenticated requests
  },
  skipSuccessfulRequests: false, // Count all requests
});

/**
 * Rate limiting for password reset
 */
export const passwordResetRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 password reset attempts per hour
  message: 'Too many password reset attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Prevent SSRF by validating URLs
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Block private/internal IPs
    const hostname = parsed.hostname;
    
    // Block localhost and private IPs
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.16.') ||
      hostname.startsWith('172.17.') ||
      hostname.startsWith('172.18.') ||
      hostname.startsWith('172.19.') ||
      hostname.startsWith('172.20.') ||
      hostname.startsWith('172.21.') ||
      hostname.startsWith('172.22.') ||
      hostname.startsWith('172.23.') ||
      hostname.startsWith('172.24.') ||
      hostname.startsWith('172.25.') ||
      hostname.startsWith('172.26.') ||
      hostname.startsWith('172.27.') ||
      hostname.startsWith('172.28.') ||
      hostname.startsWith('172.29.') ||
      hostname.startsWith('172.30.') ||
      hostname.startsWith('172.31.')
    ) {
      return false;
    }
    
    // Only allow http and https
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Sanitize file path to prevent directory traversal
 */
export function sanitizeFilePath(filePath: string): string {
  // Remove any path traversal attempts
  return filePath
    .replace(/\.\./g, '') // Remove ..
    .replace(/\/\//g, '/') // Remove double slashes
    .replace(/^\/+/, '') // Remove leading slashes
    .replace(/[^a-zA-Z0-9._-]/g, '_'); // Replace invalid characters
}

