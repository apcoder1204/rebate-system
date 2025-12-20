"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const connection_1 = require("./connection");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
async function migrateEmailVerification() {
    console.log('🚀 Running email verification migration...\n');
    const migrationSQL = fs_1.default.readFileSync(path_1.default.join(__dirname, 'migrations/add_email_verification.sql'), 'utf8');
    // Run on primary database
    try {
        console.log('📊 Migrating primary database (Neon)...');
        await connection_1.primaryPool.query(migrationSQL);
        console.log('✅ Primary database migrated successfully\n');
    }
    catch (error) {
        console.error('❌ Primary database migration failed:', error.message);
    }
    // Run on backup database
    try {
        console.log('📊 Migrating backup database (localhost)...');
        await connection_1.backupPool.query(migrationSQL);
        console.log('✅ Backup database migrated successfully\n');
    }
    catch (error) {
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
