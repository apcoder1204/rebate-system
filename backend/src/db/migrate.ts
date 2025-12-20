import fs from 'fs';
import path from 'path';
import { primaryPool, backupPool } from './connection';

async function migrate() {
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Migrate primary database (Neon)
    try {
      await primaryPool.query(schema);
      console.log('✅ Primary database (Neon) schema created successfully!');
    } catch (error: any) {
      console.error('❌ Primary database migration failed:', error.message);
    }
    
    // Migrate backup database (localhost)
    try {
      await backupPool.query(schema);
      console.log('✅ Backup database (localhost) schema created successfully!');
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

