import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Primary Database (Neon)
// Helper function to ensure connection string has proper pooler parameters
function ensurePoolerConfig(connectionString: string): string {
  if (!connectionString) return connectionString;
  
  // Check if it's a Neon pooler URL (contains -pooler.)
  const isPoolerUrl = connectionString.includes('-pooler.');
  
  // If using pooler, ensure pgbouncer=true is set for transaction pooling
  if (isPoolerUrl && !connectionString.includes('pgbouncer=true')) {
    const separator = connectionString.includes('?') ? '&' : '?';
    connectionString = `${connectionString}${separator}pgbouncer=true`;
  }
  
  return connectionString;
}

const neonConnectionString = ensurePoolerConfig(
  process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || ''
);

const primaryPool = new Pool({
  connectionString: neonConnectionString,
  max: 20,
  // For persistent connections: very long idle timeout since we actively maintain connections
  // With our health checks and connection warmer, connections stay active
  // Set to 30 minutes to prevent premature closures during long idle periods
  idleTimeoutMillis: 1800000, // 30 minutes (connections are kept alive by health checks)
  // Increase connection timeout for serverless (network latency)
  connectionTimeoutMillis: 30000, // 30 seconds
  // Statement timeout for long-running queries
  statement_timeout: 60000, // 60 seconds
  // Keep connections alive at TCP level
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000, // 10 seconds
  // SSL configuration
  ssl: process.env.NEON_DATABASE_URL ? { rejectUnauthorized: false } : undefined,
  // Don't allow exit on idle - we want persistent connections
  allowExitOnIdle: false,
});

// Backup Database (Localhost)
const backupPool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'rebate_system',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Error handlers with retry logic
primaryPool.on('error', (err) => {
  console.error('❌ Primary database (Neon) error:', err.message);
  // Log connection state for debugging
  console.error('Pool stats:', {
    totalCount: primaryPool.totalCount,
    idleCount: primaryPool.idleCount,
    waitingCount: primaryPool.waitingCount,
  });
  // Don't exit - fallback to backup
  // Prevent unhandled error event
  if (err instanceof Error) {
    // Mark error as handled
    err.name = 'HandledPoolError';
  }
});

// Handle client-level errors before they become unhandled
primaryPool.on('connect', (client) => {
  // Add error handler to each client to prevent unhandled errors
  client.on('error', (err: Error) => {
    console.error('⚠️  Client connection error (handled):', err.message);
    // Mark error as handled to prevent unhandled error event
    if (err.name !== 'HandledClientError') {
      err.name = 'HandledClientError';
    }
    // Client will be automatically removed from pool by pg library
    // Don't let this crash the process
  });
  
  // Handle notice events
  client.on('notice', (msg: any) => {
    // Silently handle notices (they're informational)
  });
});

// Handle connection removal (disconnections)
primaryPool.on('remove', (client) => {
  console.warn('⚠️  Neon connection removed from pool');
});

// Handle connection acquire (when getting a connection)
primaryPool.on('acquire', () => {
  // Connection acquired successfully
});

backupPool.on('error', (err) => {
  console.error('❌ Backup database (localhost) error:', err.message);
  // Prevent unhandled error event
  if (err instanceof Error) {
    err.name = 'HandledPoolError';
  }
});

// Handle client-level errors for backup pool
backupPool.on('connect', (client) => {
  client.on('error', (err: Error) => {
    console.error('⚠️  Backup client connection error (handled):', err.message);
    if (err.name !== 'HandledClientError') {
      err.name = 'HandledClientError';
    }
  });
});

// Test connections with retry logic
async function testConnectionWithRetry(
  pool: Pool,
  name: string,
  maxRetries: number = 3,
  retryDelay: number = 2000
): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await pool.query('SELECT NOW()');
      console.log(`✅ ${name} connected${attempt > 1 ? ` (after ${attempt} attempts)` : ''}`);
      return true;
    } catch (error: any) {
      console.error(`⚠️  ${name} connection attempt ${attempt}/${maxRetries} failed:`, error.message);
      if (attempt < maxRetries) {
        console.log(`Retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }
  return false;
}

async function testConnections() {
  await testConnectionWithRetry(primaryPool, 'Primary database (Neon)', 3, 2000);
  await testConnectionWithRetry(backupPool, 'Backup database (localhost)', 3, 1000);
}

// Persistent connection management for long-term idle periods
// This keeps connections alive even when the system is unused for days
let healthCheckInterval: NodeJS.Timeout | null = null;
let connectionWarmerInterval: NodeJS.Timeout | null = null;
let isShuttingDown = false;

// Aggressive health check - runs every 1 minute to keep connections alive
// This prevents Neon from closing idle connections during long idle periods
function startHealthCheck(intervalSeconds: number = 60) {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
  }
  
  healthCheckInterval = setInterval(async () => {
    if (isShuttingDown) return;
    
    try {
      // Quick health check on primary (Neon) - this keeps the connection alive
      await primaryPool.query('SELECT 1');
      // Connection is healthy - silently maintain it
    } catch (error: any) {
      console.warn('⚠️  Neon health check failed:', error.message);
      // Try to reconnect immediately
      await reconnectPrimary();
    }
  }, intervalSeconds * 1000);
  
  console.log(`🔄 Started persistent connection health check (every ${intervalSeconds} seconds)`);
}

// Connection warmer - maintains at least one active connection in the pool
// This ensures connections are always ready, even after days of inactivity
function startConnectionWarmer(intervalMinutes: number = 2) {
  if (connectionWarmerInterval) {
    clearInterval(connectionWarmerInterval);
  }
  
  connectionWarmerInterval = setInterval(async () => {
    if (isShuttingDown) return;
    
    try {
      // Ensure we have at least one connection in the pool
      // If pool is empty or all connections are stale, this will create a new one
      const client = await primaryPool.connect();
      // Do a quick query to verify the connection is alive
      await client.query('SELECT 1');
      // Release it back to the pool
      client.release();
    } catch (error: any) {
      console.warn('⚠️  Connection warmer failed:', error.message);
      await reconnectPrimary();
    }
  }, intervalMinutes * 60 * 1000);
  
  console.log(`🔥 Started connection warmer (every ${intervalMinutes} minutes)`);
}

// Reconnection logic for primary database
async function reconnectPrimary(maxRetries: number = 3): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await primaryPool.query('SELECT NOW()');
      console.log(`✅ Neon reconnected${attempt > 1 ? ` (after ${attempt} attempts)` : ''}`);
      return true;
    } catch (error: any) {
      console.error(`⚠️  Reconnection attempt ${attempt}/${maxRetries} failed:`, error.message);
      if (attempt < maxRetries) {
        // Exponential backoff: 2s, 4s, 8s
        const delay = Math.min(2000 * Math.pow(2, attempt - 1), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  return false;
}

// Initialize connections
testConnections().then(() => {
  // Start aggressive health check (every 60 seconds) to keep connections alive
  // This prevents disconnections even after days of inactivity
  startHealthCheck(60); // Check every 60 seconds
  
  // Start connection warmer (every 2 minutes) to maintain active connections
  startConnectionWarmer(2); // Warm every 2 minutes
});

// Global error handler for unhandled errors
process.on('uncaughtException', (error) => {
  // Check if it's a database connection error that we should handle gracefully
  if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || 
      error.syscall === 'read' || error.message?.includes('connection')) {
    console.error('⚠️  Unhandled database connection error (suppressed):', error.message);
    // Don't crash - these are recoverable connection errors
    return;
  }
  // For other uncaught exceptions, log and exit
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  // Check if it's a database connection error
  if (reason && typeof reason === 'object' && 'code' in reason) {
    const err = reason as any;
    if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || 
        err.syscall === 'read' || err.message?.includes('connection')) {
      console.error('⚠️  Unhandled database connection rejection (suppressed):', err.message);
      // Don't crash - these are recoverable connection errors
      return;
    }
  }
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Graceful shutdown handler
process.on('SIGINT', () => {
  isShuttingDown = true;
  if (healthCheckInterval) clearInterval(healthCheckInterval);
  if (connectionWarmerInterval) clearInterval(connectionWarmerInterval);
  primaryPool.end().catch(() => {});
  backupPool.end().catch(() => {});
  process.exit(0);
});

process.on('SIGTERM', () => {
  isShuttingDown = true;
  if (healthCheckInterval) clearInterval(healthCheckInterval);
  if (connectionWarmerInterval) clearInterval(connectionWarmerInterval);
  primaryPool.end().catch(() => {});
  backupPool.end().catch(() => {});
  process.exit(0);
});

// Dual database query wrapper
export async function dualQuery(
  queryText: string,
  params?: any[],
  options?: { skipBackup?: boolean; skipPrimary?: boolean }
): Promise<any> {
  const results: { primary?: any; backup?: any; error?: any } = {};

  // Execute on primary (Neon)
  if (!options?.skipPrimary) {
    try {
      const primaryResult = await primaryPool.query(queryText, params);
      results.primary = primaryResult;
    } catch (error: any) {
      // Check if it's a connection error
      const isConnectionError = 
        error.message?.includes('connection') ||
        error.message?.includes('ECONNREFUSED') ||
        error.message?.includes('ETIMEDOUT') ||
        error.message?.includes('Connection terminated') ||
        error.message?.includes('server closed the connection') ||
        error.code === '57P01' ||
        error.code === '57P02' ||
        error.code === '57P03';
      
      if (isConnectionError) {
        console.warn('⚠️  Primary database query failed (connection error), attempting reconnection...');
        // Try to reconnect and retry once
        const reconnected = await reconnectPrimary(2);
        if (reconnected) {
          try {
            // Retry the query after reconnection
            const primaryResult = await primaryPool.query(queryText, params);
            results.primary = primaryResult;
          } catch (retryError: any) {
            console.error('❌ Query failed after reconnection:', retryError.message);
            results.error = retryError;
          }
        } else {
          console.error('❌ Reconnection failed');
          results.error = error;
        }
      } else {
        console.error('❌ Primary database query failed:', error.message);
        results.error = error;
      }
      // Continue to backup even if primary fails
    }
  }

  // Execute on backup (localhost)
  if (!options?.skipBackup) {
    try {
      const backupResult = await backupPool.query(queryText, params);
      results.backup = backupResult;
    } catch (error: any) {
      console.error('⚠️  Backup database query failed:', error.message);
      // Don't throw - backup is optional
    }
  }

  // Return primary result if available, otherwise backup
  if (results.primary) {
    return results.primary;
  } else if (results.backup) {
    console.warn('⚠️  Using backup database result (primary unavailable)');
    return results.backup;
  } else {
    throw results.error || new Error('Both databases failed');
  }
}

// Read-only query (only from primary for performance)
// With automatic reconnection on connection errors
export async function readQuery(queryText: string, params?: any[]): Promise<any> {
  try {
    return await primaryPool.query(queryText, params);
  } catch (error: any) {
    // Check if it's a connection error that might be recoverable
    const isConnectionError = 
      error.message?.includes('connection') ||
      error.message?.includes('ECONNREFUSED') ||
      error.message?.includes('ETIMEDOUT') ||
      error.message?.includes('Connection terminated') ||
      error.message?.includes('server closed the connection') ||
      error.code === '57P01' || // Admin shutdown
      error.code === '57P02' || // Crash shutdown
      error.code === '57P03';   // Cannot connect now
    
    if (isConnectionError) {
      console.warn('⚠️  Primary read query failed (connection error), attempting reconnection...');
      // Try to reconnect and retry once
      const reconnected = await reconnectPrimary(2);
      if (reconnected) {
        try {
          // Retry the query after reconnection
          return await primaryPool.query(queryText, params);
        } catch (retryError: any) {
          console.error('❌ Query failed after reconnection, trying backup:', retryError.message);
        }
      } else {
        console.error('❌ Reconnection failed, trying backup');
      }
    } else {
      console.error('❌ Primary read query failed, trying backup:', error.message);
    }
    
    // Fallback to backup for reads
    return await backupPool.query(queryText, params);
  }
}

// Write query (write to both databases)
export async function writeQuery(queryText: string, params?: any[]): Promise<any> {
  return dualQuery(queryText, params);
}

// Transaction wrapper for dual database
export async function dualTransaction<T>(
  callback: (client: any) => Promise<T>,
  options?: { skipBackup?: boolean }
): Promise<T> {
  const primaryClient = await primaryPool.connect();
  let backupClient: any = null;

  try {
    // Start transaction on primary
    await primaryClient.query('BEGIN');

    // Start transaction on backup (if not skipped)
    if (!options?.skipBackup) {
      try {
        backupClient = await backupPool.connect();
        await backupClient.query('BEGIN');
      } catch (error: any) {
        console.warn('⚠️  Backup transaction start failed:', error.message);
        // Continue with primary only
      }
    }

    // Execute callback
    const result = await callback(primaryClient);

    // Commit primary
    await primaryClient.query('COMMIT');

    // Commit backup (if available)
    if (backupClient) {
      try {
        await backupClient.query('COMMIT');
      } catch (error: any) {
        console.error('⚠️  Backup commit failed:', error.message);
        // Primary already committed, so continue
      }
    }

    return result;
  } catch (error) {
    // Rollback both
    try {
      await primaryClient.query('ROLLBACK');
    } catch (e) {
      console.error('Primary rollback error:', e);
    }

    if (backupClient) {
      try {
        await backupClient.query('ROLLBACK');
      } catch (e) {
        console.error('Backup rollback error:', e);
      }
    }

    throw error;
  } finally {
    primaryClient.release();
    if (backupClient) {
      backupClient.release();
    }
  }
}

// Export pools for direct access if needed
export { primaryPool, backupPool };

// Default export: use primary pool for backward compatibility
// But wrap it to also write to backup
const defaultPool = {
  query: async (text: string, params?: any[]) => {
    // Check if it's a write operation (INSERT, UPDATE, DELETE, etc.)
    const isWriteOperation = /^\s*(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE)/i.test(text.trim());
    
    if (isWriteOperation) {
      // Write operations go to both databases
      return writeQuery(text, params);
    } else {
      // Read operations (SELECT) go to primary (with fallback to backup)
      return readQuery(text, params);
    }
  },
  connect: () => primaryPool.connect(),
  end: async () => {
    await Promise.all([primaryPool.end(), backupPool.end()]);
  },
  on: (event: 'error' | 'connect' | 'acquire' | 'remove' | 'release', callback: (err?: Error, client?: any) => void) => {
    primaryPool.on(event as any, callback as any);
    backupPool.on(event as any, callback as any);
    return defaultPool;
  },
};

export default defaultPool;
