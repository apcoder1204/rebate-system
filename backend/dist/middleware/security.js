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
exports.passwordResetRateLimit = exports.apiRateLimit = exports.authRateLimit = exports.securityHeaders = void 0;
exports.isValidUrl = isValidUrl;
exports.sanitizeFilePath = sanitizeFilePath;
const express_rate_limit_1 = __importStar(require("express-rate-limit"));
const helmet_1 = __importDefault(require("helmet"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
/**
 * Security headers middleware
 */
exports.securityHeaders = (0, helmet_1.default)({
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
exports.authRateLimit = (0, express_rate_limit_1.default)({
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
        const ip = (0, express_rate_limit_1.ipKeyGenerator)(req);
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
exports.apiRateLimit = (0, express_rate_limit_1.default)({
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
                    const decoded = jsonwebtoken_1.default.verify(token, jwtSecret);
                    if (decoded?.id) {
                        return decoded.id; // Per-user rate limiting
                    }
                }
            }
            catch {
                // Invalid token, fall back to IP
            }
        }
        // Use ipKeyGenerator helper for IPv6 compatibility
        return (0, express_rate_limit_1.ipKeyGenerator)(req); // Fall back to IP for unauthenticated requests
    },
    skipSuccessfulRequests: false, // Count all requests
});
/**
 * Rate limiting for password reset
 */
exports.passwordResetRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // Limit each IP to 3 password reset attempts per hour
    message: 'Too many password reset attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
/**
 * Prevent SSRF by validating URLs
 */
function isValidUrl(url) {
    try {
        const parsed = new URL(url);
        // Block private/internal IPs
        const hostname = parsed.hostname;
        // Block localhost and private IPs
        if (hostname === 'localhost' ||
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
            hostname.startsWith('172.31.')) {
            return false;
        }
        // Only allow http and https
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    }
    catch {
        return false;
    }
}
/**
 * Sanitize file path to prevent directory traversal
 */
function sanitizeFilePath(filePath) {
    // Remove any path traversal attempts
    return filePath
        .replace(/\.\./g, '') // Remove ..
        .replace(/\/\//g, '/') // Remove double slashes
        .replace(/^\/+/, '') // Remove leading slashes
        .replace(/[^a-zA-Z0-9._-]/g, '_'); // Replace invalid characters
}
