"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const connection_1 = require("./connection");
// Function to run all migration files from migrations directory
async function runMigrations(pool, dbName) {
    const migrationsDir = path_1.default.join(__dirname, 'migrations');
    if (!fs_1.default.existsSync(migrationsDir)) {
        console.log(`ℹ️  No migrations directory found at ${migrationsDir}`);
        return;
    }
    const files = fs_1.default.readdirSync(migrationsDir)
        .filter(file => file.endsWith('.sql'))
        .sort(); // Sort to ensure order
    console.log(`📂 Found ${files.length} migration files for ${dbName}`);
    for (const file of files) {
        const filePath = path_1.default.join(migrationsDir, file);
        const sql = fs_1.default.readFileSync(filePath, 'utf8');
        try {
            await pool.query(sql);
            console.log(`  ✅ Applied migration: ${file}`);
        }
        catch (error) {
            console.error(`  ❌ Failed to apply migration ${file}:`, error.message);
            // We continue, as some might fail if already applied in a non-idempotent way, 
            // but most of ours are IF NOT EXISTS
        }
    }
}
async function migrate() {
    try {
        const schemaPath = path_1.default.join(__dirname, 'schema.sql');
        const schema = fs_1.default.readFileSync(schemaPath, 'utf8');
        // Migrate primary database (Neon)
        try {
            console.log('🔄 Running base schema migration on Primary (Neon)...');
            await connection_1.primaryPool.query(schema);
            console.log('✅ Base schema applied to Primary.');
            // Run additional migrations
            await runMigrations(connection_1.primaryPool, 'Primary (Neon)');
        }
        catch (error) {
            console.error('❌ Primary database migration failed:', error.message);
        }
        // Migrate backup database (localhost)
        try {
            console.log('🔄 Running base schema migration on Backup (Localhost)...');
            await connection_1.backupPool.query(schema);
            console.log('✅ Base schema applied to Backup.');
            // Run additional migrations
            await runMigrations(connection_1.backupPool, 'Backup (Localhost)');
        }
        catch (error) {
            console.error('⚠️  Backup database migration failed:', error.message);
        }
        // Create default admin user on both databases
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash('1234', 10);
        const adminEmail = 'apcoder3@gmail.com';
        // Primary database
        try {
            const primaryResult = await connection_1.primaryPool.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
            if (primaryResult.rows.length === 0) {
                await connection_1.primaryPool.query(`INSERT INTO users (email, password_hash, full_name, role) 
           VALUES ($1, $2, $3, $4)`, [adminEmail, hashedPassword, 'apcoder', 'admin']);
                console.log('✅ Default admin user created on primary database!');
            }
        }
        catch (error) {
            console.error('⚠️  Primary admin user creation failed:', error.message);
        }
        // Backup database
        try {
            const backupResult = await connection_1.backupPool.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
            if (backupResult.rows.length === 0) {
                await connection_1.backupPool.query(`INSERT INTO users (email, password_hash, full_name, role) 
           VALUES ($1, $2, $3, $4)`, [adminEmail, hashedPassword, 'apcoder', 'admin']);
                console.log('✅ Default admin user created on backup database!');
            }
        }
        catch (error) {
            console.error('⚠️  Backup admin user creation failed:', error.message);
        }
        process.exit(0);
    }
    catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}
migrate();
