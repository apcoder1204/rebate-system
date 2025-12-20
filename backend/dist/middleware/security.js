"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.passwordResetRateLimit = exports.apiRateLimit = exports.authRateLimit = exports.securityHeaders = void 0;
exports.isValidUrl = isValidUrl;
exports.sanitizeFilePath = sanitizeFilePath;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const helmet_1 = __importDefault(require("helmet"));
/**
 * Security headers middleware
 */
exports.securityHeaders = (0, helmet_1.default)({
    contentSecurityPolicy: false, // Disable CSP for API - it's handled by CORS
    crossOriginEmbedderPolicy: false, // Allow file uploads and cross-origin requests
    crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow cross-origin resource sharing
    crossOriginOpenerPolicy: { policy: "unsafe-none" }, // Allow cross-origin requests for API
});
/**
 * Rate limiting for authentication endpoints
 */
exports.authRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 requests per windowMs
    message: 'Too many authentication attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
/**
 * Rate limiting for general API endpoints
 */
exports.apiRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
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
