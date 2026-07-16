import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import cron from 'node-cron';
import routes from './routes';
import { securityHeaders, apiRateLimit } from './middleware/security';
import { sendOrderReminders } from './services/orderReminderService';
import pool, { readQuery } from './db/connection';
import { sendRebateReminderEmail, sendContractRenewalReminderEmail } from './services/emailService';
import { getUserNotifPrefs } from './controllers/notificationController';

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
  
  // Schedule order reminder emails to run every 7 days at 9:00 AM
  // Cron format: minute hour day month day-of-week
  // This runs at 9:00 AM every Sunday
  // Note: To run every 7 days regardless of day, you might want to use a different approach
  // For now, this runs weekly on Sundays. You can change '0' to any day (0=Sunday, 1=Monday, etc.)
  cron.schedule('0 9 * * 0', async () => {
    console.log('📧 Running scheduled order reminder job...');
    try {
      const result = await sendOrderReminders();
      console.log(`📧 Order reminder job completed: ${result.message}`);
    } catch (error) {
      console.error('❌ Error in scheduled order reminder job:', error);
    }
  }, {
    scheduled: true,
    timezone: "Africa/Dar_es_Salaam" // Adjust to your timezone
  });
  
  console.log('📧 Order reminder scheduler initialized (runs every Sunday at 9:00 AM)');

  // Daily job: auto-expire contracts whose end_date has passed
  cron.schedule('0 0 * * *', async () => {
    console.log('📋 Running daily contract expiry check...');
    try {
      const result = await pool.query(
        `UPDATE contracts SET status = 'expired'
         WHERE end_date < CURRENT_DATE AND status IN ('active', 'approved')`
      );
      if ((result.rowCount || 0) > 0) {
        console.log(`📋 Auto-expired ${result.rowCount} contract(s) past their end date.`);
      }
    } catch (error) {
      console.error('❌ Error in daily contract expiry job:', error);
    }
  }, {
    scheduled: true,
    timezone: "Africa/Dar_es_Salaam"
  });

  console.log('📋 Daily contract expiry scheduler initialized (runs at midnight)');

  // Every Monday 9:00 AM EAT — rebate claim reminder for expired contracts with unpaid rebate
  cron.schedule('0 9 * * 1', async () => {
    console.log('💰 Running rebate claim reminder job...');
    try {
      const { rows } = await readQuery(`
        SELECT DISTINCT ON (c.customer_id, c.id)
          c.customer_id, c.contract_number, u.email, u.full_name,
          SUM(o.rebate_amount) FILTER (WHERE o.rebate_status = 'unpaid') AS unpaid_rebate
        FROM contracts c
        JOIN users u ON u.id = c.customer_id
        JOIN orders o ON o.contract_id = c.id
        WHERE c.status = 'expired' AND o.rebate_status = 'unpaid'
        GROUP BY c.customer_id, c.id, c.contract_number, u.email, u.full_name
        HAVING SUM(o.rebate_amount) FILTER (WHERE o.rebate_status = 'unpaid') > 0
      `);
      let sent = 0;
      for (const row of rows) {
        const prefs = await getUserNotifPrefs(row.customer_id);
        if (prefs.email_notifications && prefs.contract_updates) {
          await sendRebateReminderEmail(row.email, row.full_name, row.contract_number, parseFloat(row.unpaid_rebate));
          sent++;
        }
      }
      console.log(`💰 Rebate reminder job: ${sent} email(s) sent`);
    } catch (error) {
      console.error('❌ Error in rebate reminder job:', error);
    }
  }, { scheduled: true, timezone: 'Africa/Dar_es_Salaam' });

  // Every Monday 9:00 AM EAT — contract renewal reminder for contracts expiring within 14 days
  cron.schedule('0 9 * * 1', async () => {
    console.log('📋 Running contract renewal reminder job...');
    try {
      const { rows } = await readQuery(`
        SELECT c.customer_id, c.contract_number, c.end_date, u.email, u.full_name,
               (c.end_date::date - CURRENT_DATE)::int AS days_left
        FROM contracts c
        JOIN users u ON u.id = c.customer_id
        WHERE c.status IN ('active', 'approved')
          AND c.end_date::date BETWEEN CURRENT_DATE AND CURRENT_DATE + 14
      `);
      let sent = 0;
      for (const row of rows) {
        const prefs = await getUserNotifPrefs(row.customer_id);
        if (prefs.email_notifications && prefs.contract_updates) {
          await sendContractRenewalReminderEmail(
            row.email, row.full_name, row.contract_number,
            String(row.end_date), row.days_left
          );
          sent++;
        }
      }
      console.log(`📋 Renewal reminder job: ${sent} email(s) sent`);
    } catch (error) {
      console.error('❌ Error in renewal reminder job:', error);
    }
  }, { scheduled: true, timezone: 'Africa/Dar_es_Salaam' });

  console.log('💰 Notification reminder schedulers initialized (run every Monday at 9:00 AM)');
});

