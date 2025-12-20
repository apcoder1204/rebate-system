"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const connection_1 = require("./connection");
async function checkAdmin() {
    const adminEmail = 'apcoder3@gmail.com';
    console.log('🔍 Checking admin user in databases...\n');
    // Check primary database (Neon)
    try {
        const primaryResult = await connection_1.primaryPool.query('SELECT id, email, full_name, role, password_hash FROM users WHERE email = $1', [adminEmail]);
        if (primaryResult.rows.length > 0) {
            console.log('✅ Primary Database (Neon):');
            console.log('   Email:', primaryResult.rows[0].email);
            console.log('   Name:', primaryResult.rows[0].full_name);
            console.log('   Role:', primaryResult.rows[0].role);
            console.log('   Password Hash:', primaryResult.rows[0].password_hash?.substring(0, 20) + '...');
        }
        else {
            console.log('❌ Primary Database (Neon): Admin user NOT FOUND');
        }
    }
    catch (error) {
        console.error('❌ Primary Database (Neon) error:', error.message);
    }
    console.log('');
    // Check backup database (localhost)
    try {
        const backupResult = await connection_1.backupPool.query('SELECT id, email, full_name, role, password_hash FROM users WHERE email = $1', [adminEmail]);
        if (backupResult.rows.length > 0) {
            console.log('✅ Backup Database (localhost):');
            console.log('   Email:', backupResult.rows[0].email);
            console.log('   Name:', backupResult.rows[0].full_name);
            console.log('   Role:', backupResult.rows[0].role);
            console.log('   Password Hash:', backupResult.rows[0].password_hash?.substring(0, 20) + '...');
        }
        else {
            console.log('❌ Backup Database (localhost): Admin user NOT FOUND');
        }
    }
    catch (error) {
        console.error('❌ Backup Database (localhost) error:', error.message);
    }
    process.exit(0);
}
checkAdmin();
