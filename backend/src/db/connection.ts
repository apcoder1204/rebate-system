import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Primary Database (Neon)
const primaryPool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL || process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: process.env.NEON_DATABASE_URL ? { rejectUnauthorized: false } : undefined,
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

// Error handlers
primaryPool.on('error', (err) => {
  console.error('❌ Primary database (Neon) error:', err.message);
  // Don't exit - fallback to backup
});

backupPool.on('error', (err) => {
  console.error('❌ Backup database (localhost) error:', err.message);
});

// Test connections
async function testConnections() {
  try {
    await primaryPool.query('SELECT NOW()');
    console.log('✅ Primary database (Neon) connected');
  } catch (error: any) {
    console.error('⚠️  Primary database (Neon) connection failed:', error.message);
  }

  try {
    await backupPool.query('SELECT NOW()');
    console.log('✅ Backup database (localhost) connected');
  } catch (error: any) {
    console.error('⚠️  Backup database (localhost) connection failed:', error.message);
  }
}

// Initialize connections
testConnections();

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
      console.error('❌ Primary database query failed:', error.message);
      results.error = error;
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
export async function readQuery(queryText: string, params?: any[]): Promise<any> {
  try {
    return await primaryPool.query(queryText, params);
  } catch (error: any) {
    console.error('❌ Primary read query failed, trying backup:', error.message);
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
