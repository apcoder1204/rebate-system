import pool from './connection';

async function migrate() {
  console.log('Running migration: Add order reminder tracking...');
  
  try {
    // Read and execute the migration SQL
    const fs = require('fs');
    const path = require('path');
    const sqlPath = path.join(__dirname, 'migrations', 'add_order_reminder_tracking.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    await pool.query(sql);
    
    console.log('✅ Migration completed successfully! Order reminder tracking added.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
