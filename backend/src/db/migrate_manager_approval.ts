import fs from 'fs';
import path from 'path';
import pool from './connection';

async function migrateManagerApproval() {
  try {
    console.log('🔄 Running manager approval migration...');
    
    const migrationPath = path.join(__dirname, 'migrations', 'add_manager_approval_fields.sql');
    const migration = fs.readFileSync(migrationPath, 'utf8');
    
    await pool.query(migration);
    console.log('✅ Manager approval migration completed successfully!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrateManagerApproval();
