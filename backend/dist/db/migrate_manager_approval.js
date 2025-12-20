"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const connection_1 = __importDefault(require("./connection"));
async function migrateManagerApproval() {
    try {
        console.log('🔄 Running manager approval migration...');
        const migrationPath = path_1.default.join(__dirname, 'migrations', 'add_manager_approval_fields.sql');
        const migration = fs_1.default.readFileSync(migrationPath, 'utf8');
        await connection_1.default.query(migration);
        console.log('✅ Manager approval migration completed successfully!');
        process.exit(0);
    }
    catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}
migrateManagerApproval();
