import fs from 'fs';
import path from 'path';
import { primaryPool, backupPool } from './connection';
import { Pool } from 'pg';

// Function to run all migration files from migrations directory
async function runMigrations(pool: Pool, dbName: string) {
  const migrationsDir = path.join(__dirname, 'migrations');
  
  if (!fs.existsSync(migrationsDir)) {
    console.log(`ℹ️  No migrations directory found at ${migrationsDir}`);
    return;
  }
  
  const files = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort(); // Sort to ensure order
    
  console.log(`📂 Found ${files.length} migration files for ${dbName}`);
  
  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');
    
    try {
      await pool.query(sql);
      console.log(`  ✅ Applied migration: ${file}`);
    } catch (error: any) {
      console.error(`  ❌ Failed to apply migration ${file}:`, error.message);
      // We continue, as some might fail if already applied in a non-idempotent way, 
      // but most of ours are IF NOT EXISTS
    }
  }
}

async function migrate() {
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Migrate primary database (Neon)
    try {
      console.log('🔄 Running base schema migration on Primary (Neon)...');
      await primaryPool.query(schema);
      console.log('✅ Base schema applied to Primary.');
      
      // Run additional migrations
      await runMigrations(primaryPool, 'Primary (Neon)');
    } catch (error: any) {
      console.error('❌ Primary database migration failed:', error.message);
    }
    
    // Migrate backup database (localhost)
    try {
      console.log('🔄 Running base schema migration on Backup (Localhost)...');
      await backupPool.query(schema);
      console.log('✅ Base schema applied to Backup.');
      
      // Run additional migrations
      await runMigrations(backupPool, 'Backup (Localhost)');
    } catch (error: any) {
      console.error('⚠️  Backup database migration failed:', error.message);
    }
    
    // Create default admin user on both databases
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('1234', 10);
    const adminEmail = 'apcoder3@gmail.com';
    
    // Primary database
    try {
      const primaryResult = await primaryPool.query(
        'SELECT id FROM users WHERE email = $1',
        [adminEmail]
      );
      
      if (primaryResult.rows.length === 0) {
        await primaryPool.query(
          `INSERT INTO users (email, password_hash, full_name, role) 
           VALUES ($1, $2, $3, $4)`,
          [adminEmail, hashedPassword, 'apcoder', 'admin']
        );
        console.log('✅ Default admin user created on primary database!');
      }
    } catch (error: any) {
      console.error('⚠️  Primary admin user creation failed:', error.message);
    }
    
    // Backup database
    try {
      const backupResult = await backupPool.query(
        'SELECT id FROM users WHERE email = $1',
        [adminEmail]
      );
      
      if (backupResult.rows.length === 0) {
        await backupPool.query(
          `INSERT INTO users (email, password_hash, full_name, role) 
           VALUES ($1, $2, $3, $4)`,
          [adminEmail, hashedPassword, 'apcoder', 'admin']
        );
        console.log('✅ Default admin user created on backup database!');
      }
    } catch (error: any) {
      console.error('⚠️  Backup admin user creation failed:', error.message);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();

