"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = void 0;
exports.sanitizeString = sanitizeString;
exports.isValidUUID = isValidUUID;
exports.isValidEmail = isValidEmail;
exports.isValidPhone = isValidPhone;
exports.isValidDate = isValidDate;
exports.sanitizeNumber = sanitizeNumber;
exports.isValidRole = isValidRole;
exports.isValidOrderStatus = isValidOrderStatus;
exports.isValidContractStatus = isValidContractStatus;
exports.sanitizeSortBy = sanitizeSortBy;
const express_validator_1 = require("express-validator");
/**
 * Validation middleware to check validation results
 */
const validate = (req, res, next) => {
    const errors = (0, express_validator_1.validationResult)(req);
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
exports.validate = validate;
/**
 * Sanitize string input to prevent XSS and injection
 */
function sanitizeString(input) {
    if (typeof input !== 'string')
        return '';
    return input
        .trim()
        .replace(/[<>]/g, '') // Remove potential HTML tags
        .replace(/['";\\]/g, '') // Remove SQL injection characters
        .substring(0, 1000); // Limit length
}
/**
 * Validate UUID format
 */
function isValidUUID(id) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
}
/**
 * Validate email format
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 255;
}
/**
 * Validate phone number (basic validation)
 */
function isValidPhone(phone) {
    // Allow international format with + or local format
    const phoneRegex = /^(\+?\d{1,4}[\s-]?)?\(?\d{1,4}\)?[\s-]?\d{1,9}[\s-]?\d{1,9}$/;
    return phoneRegex.test(phone) && phone.length >= 10 && phone.length <= 20;
}
/**
 * Validate date string (ISO format)
 */
function isValidDate(dateString) {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
}
/**
 * Sanitize and validate numeric input
 */
function sanitizeNumber(input, min, max) {
    const num = typeof input === 'string' ? parseFloat(input) : Number(input);
    if (isNaN(num))
        return null;
    if (min !== undefined && num < min)
        return null;
    if (max !== undefined && num > max)
        return null;
    return num;
}
/**
 * Validate role value
 */
function isValidRole(role) {
    return ['admin', 'manager', 'staff', 'user'].includes(role);
}
/**
 * Validate order status
 */
function isValidOrderStatus(status) {
    return ['pending', 'confirmed', 'cancelled'].includes(status);
}
/**
 * Validate contract status
 */
function isValidContractStatus(status) {
    return ['pending', 'pending_approval', 'approved', 'active', 'rejected', 'expired'].includes(status);
}
/**
 * Sanitize sortBy parameter to prevent SQL injection
 */
function sanitizeSortBy(sortBy, allowedFields, defaultSort = '') {
    if (!sortBy)
        return defaultSort;
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
