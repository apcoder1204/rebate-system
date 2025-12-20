"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const connection_1 = __importDefault(require("./connection"));
async function migrate() {
    console.log('Running migration: Add customer_signature_data_url column...');
    try {
        // Check if column already exists
        const columnCheck = await connection_1.default.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='contracts' AND column_name='customer_signature_data_url'
    `);
        if (columnCheck.rows.length > 0) {
            console.log('Column customer_signature_data_url already exists. Skipping migration.');
        }
        else {
            // Add the column
            await connection_1.default.query(`
        ALTER TABLE contracts ADD COLUMN customer_signature_data_url TEXT
      `);
            console.log('Successfully added customer_signature_data_url column to contracts table.');
        }
        console.log('Migration completed successfully!');
    }
    catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
    finally {
        await connection_1.default.end();
    }
}
migrate();
