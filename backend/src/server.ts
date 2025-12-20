import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import routes from './routes';
import { securityHeaders, apiRateLimit } from './middleware/security';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware (must be first)
app.use(securityHeaders);

// CORS configuration - Allow all necessary origins and methods
// Normalize URLs: if no protocol specified, add https:// (and also allow http:// for flexibility)
const normalizeOrigins = (urls: string[]): string[] => {
  const normalized: string[] = [];
  urls.forEach(url => {
    url = url.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      // If no protocol, add both http and https versions
      normalized.push(`https://${url}`);
      normalized.push(`http://${url}`);
    } else {
      normalized.push(url);
    }
  });
  return normalized;
};

const defaultOrigins = ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:4173', 'http://127.0.0.1:5173', 'http://127.0.0.1:3000', 'http://127.0.0.1:4173'];
const allowedOrigins = process.env.FRONTEND_URL 
  ? normalizeOrigins(process.env.FRONTEND_URL.split(','))
  : defaultOrigins;

console.log(`🌐 CORS Configuration:`);
console.log(`   Allowed Origins: ${allowedOrigins.join(', ')}`);
console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`   Credentials: enabled`);

// CORS configuration for production (Vercel frontend + Render backend)
app.use(cors({
  origin: (origin, callback) => {
    // Log all CORS requests for debugging
    console.log(`🔍 CORS Request from origin: ${origin || 'no-origin'}`);
    
    // Allow requests with no origin (like mobile apps, Postman, or curl)
    if (!origin) {
      console.log('✅ Allowing request with no origin');
      return callback(null, true);
    }
    
    // Always allow cctvpoint.org subdomains (for production)
    if (origin.includes('cctvpoint.org')) {
      console.log(`✅ Allowing cctvpoint.org subdomain: ${origin}`);
      return callback(null, true);
    }
    
    // Check if origin is in allowed list (from FRONTEND_URL env var)
    const isAllowed = allowedOrigins.some(allowed => {
      // Exact match
      if (allowed === origin) {
        console.log(`✅ Exact match found: ${origin}`);
        return true;
      }
      // Domain match
      try {
        const originUrl = new URL(origin);
        const allowedUrl = new URL(allowed);
        const hostnameMatch = originUrl.hostname === allowedUrl.hostname;
        if (hostnameMatch) {
          console.log(`✅ Hostname match: ${originUrl.hostname} === ${allowedUrl.hostname}`);
        }
        return hostnameMatch;
      } catch (e) {
        return false;
      }
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      // In development, allow all origins for easier testing
      if (process.env.NODE_ENV !== 'production') {
        console.log(`✅ Development mode - allowing origin: ${origin}`);
        callback(null, true);
      } else {
        console.warn(`⚠️  CORS blocked origin: ${origin}`);
        console.warn(`⚠️  Allowed origins: ${allowedOrigins.join(', ')}`);
        // Still allow in production for now to debug - remove this after confirming it works
        console.log(`⚠️  Temporarily allowing for debugging`);
        callback(null, true);
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Allow-Headers',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers'
  ],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  optionsSuccessStatus: 200,
  maxAge: 86400, // 24 hours
  preflightContinue: false, // Let cors handle preflight
}));

// Log CORS headers middleware (for debugging) - must be after CORS
app.use((req, res, next) => {
  if (req.method === 'OPTIONS' || req.headers.origin) {
    console.log(`📡 ${req.method} ${req.path} - Origin: ${req.headers.origin || 'none'}`);
  }
  next();
});

// Body parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting for all API routes
app.use('/api', apiRateLimit);

// Serve uploaded files - serve from uploads root to handle nested paths
// Use process.cwd() to ensure we're using the same base directory as file uploads
const uploadsRoot = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsRoot)) {
  fs.mkdirSync(uploadsRoot, { recursive: true });
}
console.log(`📁 Serving static files from: ${uploadsRoot}`);
app.use('/uploads', express.static(uploadsRoot));

// API routes
app.use('/api', routes);

// Health check endpoints (for Render and monitoring)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// CORS test endpoint
app.get('/api/cors-test', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'CORS is working!',
    origin: req.headers.origin || 'no-origin',
    timestamp: new Date().toISOString() 
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

