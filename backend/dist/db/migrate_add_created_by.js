"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const connection_1 = __importDefault(require("./connection"));
async function addCreatedByColumn() {
    try {
        console.log('Adding created_by column to orders table...');
        // Add created_by column if it doesn't exist
        await connection_1.default.query(`
      ALTER TABLE orders 
      ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    `);
        // Add index for better query performance
        await connection_1.default.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_created_by ON orders(created_by);
    `);
        console.log('✅ Migration completed successfully! created_by column added to orders table.');
        process.exit(0);
    }
    catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}
addCreatedByColumn();
