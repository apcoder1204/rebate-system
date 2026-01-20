"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorize = exports.authenticate = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const connection_1 = __importDefault(require("../db/connection"));
const authenticate = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        // Ensure JWT_SECRET is set
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret || jwtSecret === 'your-secret-key') {
            console.error('⚠️  WARNING: JWT_SECRET is not properly configured!');
            return res.status(500).json({ error: 'Server configuration error' });
        }
        const decoded = jsonwebtoken_1.default.verify(token, jwtSecret);
        // Validate decoded token structure
        if (!decoded.id || !decoded.email || !decoded.role) {
            return res.status(401).json({ error: 'Invalid token structure' });
        }
        // Check if user is active - DB check for security
        // We cache this check for 1 minute to avoid hammering DB on every request if needed
        // But for now, direct check for immediate deactivation effect
        try {
            const userResult = await connection_1.default.query('SELECT is_active FROM users WHERE id = $1', [decoded.id]);
            if (userResult.rows.length === 0) {
                return res.status(401).json({ error: 'User not found' });
            }
            if (userResult.rows[0].is_active === false) {
                return res.status(403).json({ error: 'Account is inactive. Please contact support.' });
            }
        }
        catch (dbError) {
            console.error('Auth DB check failed:', dbError);
            // Proceed cautiously or fail secure? 
            // Failing secure for authentication critical path
            return res.status(500).json({ error: 'Authentication check failed' });
        }
        req.user = {
            id: decoded.id,
            email: decoded.email,
            role: decoded.role,
        };
        next();
    }
    catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired' });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token' });
        }
        return res.status(401).json({ error: 'Authentication failed' });
    }
};
exports.authenticate = authenticate;
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
};
exports.authorize = authorize;
