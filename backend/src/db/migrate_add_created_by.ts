import pool from './connection';

async function addCreatedByColumn() {
  try {
    console.log('Adding created_by column to orders table...');
    
    // Add created_by column if it doesn't exist
    await pool.query(`
      ALTER TABLE orders 
      ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    `);
    
    // Add index for better query performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_created_by ON orders(created_by);
    `);
    
    console.log('✅ Migration completed successfully! created_by column added to orders table.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

addCreatedByColumn();

