import { Request, Response, NextFunction } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import redis from '../db/redis';

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

// Build optional Redis store for rate limiters (enables distributed rate limiting across instances)
const makeRedisStore = (prefix: string) =>
  redis
    ? new RedisStore({
        sendCommand: (...args: string[]) => (redis as any).call(...args),
        prefix,
      })
    : undefined;

/**
 * Rate limiting for authentication endpoints
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 50 : 200,
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  store: makeRedisStore('rl:auth:'),
  keyGenerator: (req: Request) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : '';
    const ip = ipKeyGenerator(req as any);
    return `${ip}:${email}`;
  },
  skip: (req) => process.env.NODE_ENV !== 'production' && req.ip === '::1',
});

/**
 * Rate limiting for general API endpoints
 * Uses user ID from JWT token for per-user rate limiting instead of IP-based
 */
export const apiRateLimit = rateLimit({
  windowMs: 150 * 60 * 1000, // 150 minutes
  max: 500,
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  store: makeRedisStore('rl:api:'),
  keyGenerator: (req) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      try {
        const jwtSecret = process.env.JWT_SECRET;
        if (jwtSecret && jwtSecret !== 'your-secret-key') {
          const decoded = jwt.verify(token, jwtSecret) as any;
          if (decoded?.id) return decoded.id;
        }
      } catch {
        // fall through to IP
      }
    }
    return ipKeyGenerator(req as any);
  },
  skipSuccessfulRequests: false,
});

/**
 * Rate limiting for password reset
 */
export const passwordResetRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: 'Too many password reset attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  store: makeRedisStore('rl:reset:'),
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

