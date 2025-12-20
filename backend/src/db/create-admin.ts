import { primaryPool, backupPool } from './connection';
import bcrypt from 'bcryptjs';

async function createAdmin() {
  const adminEmail = 'apcoder3@gmail.com';
  const adminPassword = '1234';
  const adminName = 'apcoder';
  
  console.log('🔧 Creating admin user...\n');
  
  const hashedPassword = await bcrypt.hash(adminPassword, 10);
  
  // Create on primary database (Neon)
  try {
    const primaryCheck = await primaryPool.query(
      'SELECT id FROM users WHERE email = $1',
      [adminEmail]
    );
    
    if (primaryCheck.rows.length === 0) {
      await primaryPool.query(
        `INSERT INTO users (email, password_hash, full_name, role) 
         VALUES ($1, $2, $3, $4)`,
        [adminEmail, hashedPassword, adminName, 'admin']
      );
      console.log('✅ Admin user created on Primary Database (Neon)');
      console.log('   Email:', adminEmail);
      console.log('   Password:', adminPassword);
    } else {
      // Update password if user exists
      await primaryPool.query(
        'UPDATE users SET password_hash = $1 WHERE email = $2',
        [hashedPassword, adminEmail]
      );
      console.log('✅ Admin user password updated on Primary Database (Neon)');
      console.log('   Email:', adminEmail);
      console.log('   Password:', adminPassword);
    }
  } catch (error: any) {
    console.error('❌ Primary Database (Neon) error:', error.message);
  }
  
  console.log('');
  
  // Create on backup database (localhost)
  try {
    const backupCheck = await backupPool.query(
      'SELECT id FROM users WHERE email = $1',
      [adminEmail]
    );
    
    if (backupCheck.rows.length === 0) {
      await backupPool.query(
        `INSERT INTO users (email, password_hash, full_name, role) 
         VALUES ($1, $2, $3, $4)`,
        [adminEmail, hashedPassword, adminName, 'admin']
      );
      console.log('✅ Admin user created on Backup Database (localhost)');
      console.log('   Email:', adminEmail);
      console.log('   Password:', adminPassword);
    } else {
      // Update password if user exists
      await backupPool.query(
        'UPDATE users SET password_hash = $1 WHERE email = $2',
        [hashedPassword, adminEmail]
      );
      console.log('✅ Admin user password updated on Backup Database (localhost)');
      console.log('   Email:', adminEmail);
      console.log('   Password:', adminPassword);
    }
  } catch (error: any) {
    console.error('⚠️  Backup Database (localhost) error:', error.message);
    console.log('   (This is okay if localhost DB is not available)');
  }
  
  console.log('\n✅ Admin user setup complete!');
  console.log('\n📝 Login Credentials:');
  console.log('   Email: apcoder3@gmail.com');
  console.log('   Password: 1234');
  
  process.exit(0);
}

createAdmin().catch((error) => {
  console.error('❌ Failed to create admin:', error);
  process.exit(1);
});


