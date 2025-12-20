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

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, Postman, or curl)
    if (!origin) {
      return callback(null, true);
    }
    
    // Check if origin is in allowed list (exact match or domain match)
    const isAllowed = allowedOrigins.some(allowed => {
      // Exact match
      if (allowed === origin) return true;
      // Domain match (handle with/without protocol, with/without www)
      try {
        const originUrl = new URL(origin);
        const allowedUrl = new URL(allowed);
        return originUrl.hostname === allowedUrl.hostname;
      } catch {
        return false;
      }
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      // In development, allow all origins for easier testing
      if (process.env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        console.warn(`⚠️  CORS blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
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
}));

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

