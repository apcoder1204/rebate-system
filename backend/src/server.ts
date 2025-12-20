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

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  optionsSuccessStatus: 200,
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

