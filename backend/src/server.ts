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

// Prevent caching of API responses
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// CORS configuration
const allowedOrigins = [
  'https://rebate.cctvpoint.org', // Production Frontend
  'http://localhost:5173',        // Local Frontend
  'http://localhost:3000',        // Local Backend/API
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000'
];

if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Check against allowed origins
    const isAllowed = allowedOrigins.indexOf(origin) !== -1 || 
                      process.env.NODE_ENV !== 'production' ||
                      origin.endsWith('.vercel.app') || // Allow all Vercel preview deployments
                      origin.endsWith('.cctvpoint.org'); // Allow all subdomains
                      
    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`⚠️  CORS Warning: Origin ${origin} not explicitly allowed, but allowing for debugging.`);
      // Temporarily allow all for debugging 405 error
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'Cache-Control', 'Pragma'],
  optionsSuccessStatus: 200,
}));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`📝 ${req.method} ${req.path} - Origin: ${req.headers.origin || 'unknown'}`);
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
app.get('/', (req, res) => {
  res.json({ 
    service: 'Rebate System API', 
    status: 'running', 
    timestamp: new Date().toISOString() 
  });
});

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

