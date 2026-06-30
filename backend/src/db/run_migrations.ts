import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

function ensurePoolerConfig(connectionString: string): string {
  if (!connectionString) return connectionString;
  const isPoolerUrl = connectionString.includes('-pooler.');
  if (isPoolerUrl && !connectionString.includes('pgbouncer=true')) {
    const separator = connectionString.includes('?') ? '&' : '?';
    connectionString = `${connectionString}${separator}pgbouncer=true`;
  }
  return connectionString;
}

const primaryPool = new Pool({
  connectionString: ensurePoolerConfig(process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || ''),
  ssl: process.env.NEON_DATABASE_URL ? { rejectUnauthorized: false } : undefined,
  connectionTimeoutMillis: 30000,
});

const backupPool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'rebate_system',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  connectionTimeoutMillis: 5000,
});

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

// Run migrations in this order so dependencies are satisfied
const MIGRATION_ORDER = [
  'add_verification_codes.sql',
  'add_audit_settings_active.sql',
  'add_email_verification.sql',
  'add_manager_approval_fields.sql',
  'add_customer_signature_data_url.sql',
  'add_order_locking.sql',
  'add_order_reminder_tracking.sql',
  'add_rebate_payment.sql',
  'add_contract_renewal.sql',
  'add_rebate_requests.sql',
];

async function runMigrationsOnPool(pool: Pool, label: string): Promise<void> {
  console.log(`\n========================================`);
  console.log(`Running migrations on: ${label}`);
  console.log(`========================================`);

  const client = await pool.connect();
  try {
    for (const filename of MIGRATION_ORDER) {
      const filePath = path.join(MIGRATIONS_DIR, filename);
      if (!fs.existsSync(filePath)) {
        console.log(`  SKIP  ${filename} (file not found)`);
        continue;
      }
      const sql = fs.readFileSync(filePath, 'utf8');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');
        console.log(`  OK    ${filename}`);
      } catch (err: any) {
        await client.query('ROLLBACK');
        // These errors mean the migration already ran or conflicts with existing data — safe to skip
        const safeErrors = ['already exists', 'duplicate', 'does not exist'];
        const isSafe = safeErrors.some(e => err.message?.toLowerCase().includes(e));
        if (isSafe) {
          console.log(`  SKIP  ${filename} (${err.message.split('\n')[0]})`);
        } else {
          console.error(`  FAIL  ${filename}: ${err.message}`);
          throw err;
        }
      }
    }
  } finally {
    client.release();
  }
}

async function main() {
  let primaryOk = false;
  let backupOk = false;

  // Primary (Neon)
  try {
    await runMigrationsOnPool(primaryPool, 'PRIMARY (Neon)');
    primaryOk = true;
  } catch (err: any) {
    console.error(`\nPrimary DB migration FAILED: ${err.message}`);
  } finally {
    await primaryPool.end();
  }

  // Backup (local)
  try {
    await runMigrationsOnPool(backupPool, 'BACKUP (localhost)');
    backupOk = true;
  } catch (err: any) {
    console.error(`\nBackup DB migration FAILED: ${err.message}`);
  } finally {
    await backupPool.end();
  }

  console.log('\n========================================');
  console.log(`Primary: ${primaryOk ? 'SUCCESS' : 'FAILED'}`);
  console.log(`Backup:  ${backupOk ? 'SUCCESS' : 'FAILED'}`);
  console.log('========================================\n');

  if (!primaryOk || !backupOk) process.exit(1);
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
