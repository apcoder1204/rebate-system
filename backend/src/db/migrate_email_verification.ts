import { primaryPool, backupPool } from './connection';
import fs from 'fs';
import path from 'path';

async function migrateEmailVerification() {
  console.log('🚀 Running email verification migration...\n');
  
  const migrationSQL = fs.readFileSync(
    path.join(__dirname, 'migrations/add_email_verification.sql'),
    'utf8'
  );
  
  // Run on primary database
  try {
    console.log('📊 Migrating primary database (Neon)...');
    await primaryPool.query(migrationSQL);
    console.log('✅ Primary database migrated successfully\n');
  } catch (error: any) {
    console.error('❌ Primary database migration failed:', error.message);
  }
  
  // Run on backup database
  try {
    console.log('📊 Migrating backup database (localhost)...');
    await backupPool!.query(migrationSQL);
    console.log('✅ Backup database migrated successfully\n');
  } catch (error: any) {
    console.error('❌ Backup database migration failed:', error.message);
  }
  
  console.log('🎉 Email verification migration completed!\n');
  console.log('📧 Don\'t forget to set these environment variables:');
  console.log('   - RESEND_API_KEY=your_resend_api_key');
  console.log('   - RESEND_FROM_EMAIL=noreply@yourdomain.com');
  console.log('   - APP_NAME=RebateFlow (optional)\n');
  
  process.exit(0);
}

migrateEmailVerification();

