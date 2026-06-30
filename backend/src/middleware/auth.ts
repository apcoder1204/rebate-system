import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import pool from '../db/connection';
import { CacheService } from '../services/cacheService';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    is_active?: boolean;
  };
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
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
    
    const decoded = jwt.verify(token, jwtSecret) as any;
    
    // Validate decoded token structure
    if (!decoded.id || !decoded.email || !decoded.role) {
      return res.status(401).json({ error: 'Invalid token structure' });
    }

    // Check if user is active — cached in Redis for 60 s to reduce DB load on every request.
    // Cache is invalidated immediately when an admin toggles a user's active status.
    try {
      const cacheKey = `auth:user:${decoded.id}`;
      let userData = await CacheService.get<{ is_active: boolean }>(cacheKey);
      if (!userData) {
        const userResult = await pool.query('SELECT is_active FROM users WHERE id = $1', [decoded.id]);
        if (userResult.rows.length === 0) {
          return res.status(401).json({ error: 'User not found' });
        }
        userData = userResult.rows[0] as { is_active: boolean };
        await CacheService.set(cacheKey, userData, 60);
      }
      if (userData.is_active === false) {
        return res.status(403).json({ error: 'Account is inactive. Please contact support.' });
      }
    } catch (dbError) {
      console.error('Auth DB check failed:', dbError);
      return res.status(500).json({ error: 'Authentication check failed' });
    }
    
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    };
    
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
};

