"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.filterContracts = exports.deleteContract = exports.updateContract = exports.createContract = exports.getContract = exports.listContracts = void 0;
const connection_1 = __importDefault(require("../db/connection"));
const validation_1 = require("../middleware/validation");
const listContracts = async (req, res) => {
    try {
        const sortBy = (0, validation_1.sanitizeSortBy)(req.query.sortBy, ['created_date', 'start_date', 'end_date'], 'created_date');
        // Check if approved_by column exists before using it
        let hasApprovedByColumn = false;
        try {
            const columnCheck = await connection_1.default.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='contracts' AND column_name='approved_by'
      `);
            hasApprovedByColumn = columnCheck.rows.length > 0;
        }
        catch (e) {
            // Column check failed, assume it doesn't exist
        }
        let query = `
      SELECT 
        c.*,
        u.full_name as customer_name,
        u.email as customer_email,
        u.phone as customer_phone
      FROM contracts c
      LEFT JOIN users u ON c.customer_id = u.id
    `;
        // Add approver join only if column exists
        if (hasApprovedByColumn) {
            query = `
        SELECT 
          c.*,
          u.full_name as customer_name,
          u.email as customer_email,
          u.phone as customer_phone,
          approver.full_name as approver_name
        FROM contracts c
        LEFT JOIN users u ON c.customer_id = u.id
        LEFT JOIN users approver ON c.approved_by = approver.id
      `;
        }
        const params = [];
        // Apply role-based filtering
        if (req.user.role === 'user') {
            query += ' WHERE c.customer_id = $1';
            params.push(req.user.id);
        }
        // Safe sort by (whitelisted)
        if (sortBy.startsWith('-')) {
            const field = sortBy.substring(1);
            query += ` ORDER BY c.${field} DESC`;
        }
        else {
            query += ` ORDER BY c.${sortBy} ASC`;
        }
        const result = await connection_1.default.query(query, params);
        res.json(result.rows);
    }
    catch (error) {
        console.error('List contracts error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.listContracts = listContracts;
const getContract = async (req, res) => {
    try {
        const { id } = req.params;
        // Validate ID format
        if (!(0, validation_1.isValidUUID)(id)) {
            return res.status(400).json({ error: 'Invalid contract ID format' });
        }
        // Check if approved_by column exists
        let hasApprovedByColumn = false;
        try {
            const columnCheck = await connection_1.default.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='contracts' AND column_name='approved_by'
      `);
            hasApprovedByColumn = columnCheck.rows.length > 0;
        }
        catch (e) {
            // Column check failed
        }
        let getQuery = `
      SELECT 
        c.*,
        u.full_name as customer_name,
        u.email as customer_email,
        u.phone as customer_phone
      FROM contracts c
      LEFT JOIN users u ON c.customer_id = u.id
      WHERE c.id = $1
    `;
        if (hasApprovedByColumn) {
            getQuery = `
        SELECT 
          c.*,
          u.full_name as customer_name,
          u.email as customer_email,
          u.phone as customer_phone,
          approver.full_name as approver_name
        FROM contracts c
        LEFT JOIN users u ON c.customer_id = u.id
        LEFT JOIN users approver ON c.approved_by = approver.id
        WHERE c.id = $1
      `;
        }
        const result = await connection_1.default.query(getQuery, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Contract not found' });
        }
        // Check permissions - IDOR protection
        if (req.user.role === 'user' && result.rows[0].customer_id !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error('Get contract error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getContract = getContract;
const createContract = async (req, res) => {
    try {
        const { customer_id, start_date, end_date, rebate_percentage, status, signed_contract_url, customer_signature_data_url } = req.body;
        if (!customer_id || !start_date || !end_date) {
            return res.status(400).json({ error: 'Customer ID, start date, and end date are required' });
        }
        // Validate customer_id format
        if (!(0, validation_1.isValidUUID)(customer_id)) {
            return res.status(400).json({ error: 'Invalid customer ID format' });
        }
        // Validate dates
        if (!(0, validation_1.isValidDate)(start_date) || !(0, validation_1.isValidDate)(end_date)) {
            return res.status(400).json({ error: 'Invalid date format. Use ISO 8601 format' });
        }
        // Validate date logic
        const start = new Date(start_date);
        const end = new Date(end_date);
        if (end <= start) {
            return res.status(400).json({ error: 'End date must be after start date' });
        }
        // Validate rebate_percentage if provided
        if (rebate_percentage !== undefined) {
            const sanitizedRebate = (0, validation_1.sanitizeNumber)(rebate_percentage, 0, 100);
            if (sanitizedRebate === null) {
                return res.status(400).json({ error: 'Invalid rebate percentage. Must be between 0 and 100' });
            }
        }
        // Validate status if provided
        if (status !== undefined && !(0, validation_1.isValidContractStatus)(status)) {
            return res.status(400).json({ error: 'Invalid contract status' });
        }
        // Validate URLs if provided (basic validation)
        if (signed_contract_url !== undefined && typeof signed_contract_url !== 'string') {
            return res.status(400).json({ error: 'Invalid signed contract URL format' });
        }
        if (signed_contract_url && signed_contract_url.length > 2048) {
            return res.status(400).json({ error: 'URL too long' });
        }
        // Validate signature data URL if provided
        if (customer_signature_data_url !== undefined && typeof customer_signature_data_url !== 'string') {
            return res.status(400).json({ error: 'Invalid signature data URL format' });
        }
        if (customer_signature_data_url && customer_signature_data_url.length > 100000) {
            return res.status(400).json({ error: 'Signature data URL too long' });
        }
        // Check permissions - IDOR protection
        if (req.user.role === 'user' && customer_id !== req.user.id) {
            return res.status(403).json({ error: 'You can only create contracts for yourself' });
        }
        // Check if user already has a contract (only for regular users)
        if (req.user.role === 'user' || customer_id === req.user.id) {
            const existingContractCheck = await connection_1.default.query('SELECT id FROM contracts WHERE customer_id = $1', [customer_id]);
            if (existingContractCheck.rows.length > 0) {
                return res.status(400).json({
                    error: 'You already have a contract. You can only have one contract at a time. Please manage your existing contract.'
                });
            }
        }
        const contractNumber = `CNT-${Date.now()}`;
        const result = await connection_1.default.query(`INSERT INTO contracts 
       (customer_id, contract_number, start_date, end_date, rebate_percentage, status, signed_contract_url, customer_signature_data_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`, [
            customer_id,
            contractNumber,
            start_date,
            end_date,
            rebate_percentage || 1.00,
            status || 'pending',
            signed_contract_url || null,
            customer_signature_data_url || null,
        ]);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        console.error('Create contract error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.createContract = createContract;
const updateContract = async (req, res) => {
    try {
        const { id } = req.params;
        const { start_date, end_date, rebate_percentage, status, signed_contract_url, customer_signature_data_url, manager_signature_data_url, manager_name, manager_position, approved_by } = req.body;
        // Validate ID format
        if (!(0, validation_1.isValidUUID)(id)) {
            return res.status(400).json({ error: 'Invalid contract ID format' });
        }
        // Get the contract first to check permissions
        const contractResult = await connection_1.default.query('SELECT * FROM contracts WHERE id = $1', [id]);
        if (contractResult.rows.length === 0) {
            return res.status(404).json({ error: 'Contract not found' });
        }
        const contract = contractResult.rows[0];
        // Validate inputs
        if (start_date !== undefined && !(0, validation_1.isValidDate)(start_date)) {
            return res.status(400).json({ error: 'Invalid start date format' });
        }
        if (end_date !== undefined && !(0, validation_1.isValidDate)(end_date)) {
            return res.status(400).json({ error: 'Invalid end date format' });
        }
        // Validate date logic if both are provided
        if (start_date !== undefined && end_date !== undefined) {
            const start = new Date(start_date);
            const end = new Date(end_date);
            if (end <= start) {
                return res.status(400).json({ error: 'End date must be after start date' });
            }
        }
        if (rebate_percentage !== undefined) {
            const sanitizedRebate = (0, validation_1.sanitizeNumber)(rebate_percentage, 0, 100);
            if (sanitizedRebate === null) {
                return res.status(400).json({ error: 'Invalid rebate percentage' });
            }
        }
        if (status !== undefined && !(0, validation_1.isValidContractStatus)(status)) {
            return res.status(400).json({ error: 'Invalid contract status' });
        }
        // Validate URLs
        if (signed_contract_url !== undefined && typeof signed_contract_url === 'string' && signed_contract_url.length > 2048) {
            return res.status(400).json({ error: 'URL too long' });
        }
        if (customer_signature_data_url !== undefined && typeof customer_signature_data_url === 'string' && customer_signature_data_url.length > 100000) {
            return res.status(400).json({ error: 'Signature data URL too long' });
        }
        if (manager_signature_data_url !== undefined && typeof manager_signature_data_url === 'string' && manager_signature_data_url.length > 100000) {
            return res.status(400).json({ error: 'Manager signature data URL too long' });
        }
        // Validate text fields
        if (manager_name !== undefined && typeof manager_name === 'string' && manager_name.length > 200) {
            return res.status(400).json({ error: 'Manager name too long' });
        }
        if (manager_position !== undefined && typeof manager_position === 'string' && manager_position.length > 200) {
            return res.status(400).json({ error: 'Manager position too long' });
        }
        if (approved_by !== undefined && !(0, validation_1.isValidUUID)(approved_by)) {
            return res.status(400).json({ error: 'Invalid approver ID format' });
        }
        // Check permissions
        // Admins can modify anything
        // Managers can only approve contracts (update manager fields and status)
        if (req.user.role !== 'admin') {
            if (req.user.role === 'manager') {
                // Managers can only update approval-related fields
                const allowedFields = ['status', 'manager_signature_data_url', 'manager_name', 'manager_position', 'approved_by'];
                const requestedFields = Object.keys(req.body).filter(key => req.body[key] !== undefined &&
                    !['start_date', 'end_date', 'rebate_percentage', 'signed_contract_url'].includes(key));
                const hasUnauthorizedFields = requestedFields.some(field => !allowedFields.includes(field));
                if (hasUnauthorizedFields) {
                    return res.status(403).json({ error: 'Managers can only approve contracts, not modify other fields' });
                }
                // Only allow approval if contract is pending_approval
                if (status && status !== 'approved' && status !== 'active' && status !== 'rejected') {
                    return res.status(403).json({ error: 'Managers can only approve, activate, or reject contracts' });
                }
                if (contract.status !== 'pending_approval' && status && ['approved', 'active', 'rejected'].includes(status)) {
                    return res.status(403).json({ error: 'Can only approve contracts that are pending approval' });
                }
            }
            else {
                return res.status(403).json({ error: 'Only admins and managers can modify contracts' });
            }
        }
        // Whitelist of allowed column names to prevent SQL injection
        const updates = [];
        const values = [];
        let paramCount = 1;
        if (start_date !== undefined) {
            updates.push(`start_date = $${paramCount++}`);
            values.push(start_date);
        }
        if (end_date !== undefined) {
            updates.push(`end_date = $${paramCount++}`);
            values.push(end_date);
        }
        if (rebate_percentage !== undefined) {
            const sanitizedRebate = (0, validation_1.sanitizeNumber)(rebate_percentage, 0, 100);
            updates.push(`rebate_percentage = $${paramCount++}`);
            values.push(sanitizedRebate);
        }
        if (status !== undefined) {
            updates.push(`status = $${paramCount++}`);
            values.push(status);
        }
        if (signed_contract_url !== undefined) {
            const sanitizedUrl = typeof signed_contract_url === 'string' ? signed_contract_url.substring(0, 2048) : null;
            updates.push(`signed_contract_url = $${paramCount++}`);
            values.push(sanitizedUrl);
        }
        if (customer_signature_data_url !== undefined) {
            const sanitizedSig = typeof customer_signature_data_url === 'string' ? customer_signature_data_url.substring(0, 100000) : null;
            updates.push(`customer_signature_data_url = $${paramCount++}`);
            values.push(sanitizedSig);
        }
        if (manager_signature_data_url !== undefined) {
            const sanitizedMgrSig = typeof manager_signature_data_url === 'string' ? manager_signature_data_url.substring(0, 100000) : null;
            updates.push(`manager_signature_data_url = $${paramCount++}`);
            values.push(sanitizedMgrSig);
        }
        if (manager_name !== undefined) {
            const sanitizedName = manager_name ? (0, validation_1.sanitizeString)(manager_name).substring(0, 200) : null;
            updates.push(`manager_name = $${paramCount++}`);
            values.push(sanitizedName);
        }
        if (manager_position !== undefined) {
            const sanitizedPos = manager_position ? (0, validation_1.sanitizeString)(manager_position).substring(0, 200) : null;
            updates.push(`manager_position = $${paramCount++}`);
            values.push(sanitizedPos);
        }
        if (approved_by !== undefined) {
            updates.push(`approved_by = $${paramCount++}`);
            values.push(approved_by);
            // Set approved_date when approved_by is set
            updates.push(`approved_date = CURRENT_TIMESTAMP`);
        }
        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }
        values.push(id);
        const result = await connection_1.default.query(`UPDATE contracts SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`, values);
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error('Update contract error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.updateContract = updateContract;
const deleteContract = async (req, res) => {
    try {
        const { id } = req.params;
        // Validate ID format
        if (!(0, validation_1.isValidUUID)(id)) {
            return res.status(400).json({ error: 'Invalid contract ID format' });
        }
        // Check permissions
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Only admins can delete contracts' });
        }
        const result = await connection_1.default.query('DELETE FROM contracts WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Contract not found' });
        }
        res.json({ message: 'Contract deleted successfully' });
    }
    catch (error) {
        console.error('Delete contract error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.deleteContract = deleteContract;
const filterContracts = async (req, res) => {
    try {
        const { customer_id, status } = req.query;
        const sortBy = (0, validation_1.sanitizeSortBy)(req.query.sortBy, ['created_date', 'start_date', 'end_date'], 'created_date');
        // Check if approved_by column exists
        let hasApprovedByColumn = false;
        try {
            const columnCheck = await connection_1.default.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='contracts' AND column_name='approved_by'
      `);
            hasApprovedByColumn = columnCheck.rows.length > 0;
        }
        catch (e) {
            // Column check failed
        }
        let query = `
      SELECT 
        c.*,
        u.full_name as customer_name,
        u.email as customer_email,
        u.phone as customer_phone
      FROM contracts c
      LEFT JOIN users u ON c.customer_id = u.id
      WHERE 1=1
    `;
        if (hasApprovedByColumn) {
            query = `
        SELECT 
          c.*,
          u.full_name as customer_name,
          u.email as customer_email,
          u.phone as customer_phone,
          approver.full_name as approver_name
        FROM contracts c
        LEFT JOIN users u ON c.customer_id = u.id
        LEFT JOIN users approver ON c.approved_by = approver.id
        WHERE 1=1
      `;
        }
        const params = [];
        let paramCount = 1;
        // Apply role-based filtering - IDOR protection
        if (req.user.role === 'user') {
            query += ` AND c.customer_id = $${paramCount++}`;
            params.push(req.user.id);
        }
        else if (customer_id) {
            // Validate customer_id format for admin/manager/staff
            if (!(0, validation_1.isValidUUID)(customer_id)) {
                return res.status(400).json({ error: 'Invalid customer ID format' });
            }
            query += ` AND c.customer_id = $${paramCount++}`;
            params.push(customer_id);
        }
        if (status) {
            // Validate status
            if (!(0, validation_1.isValidContractStatus)(status)) {
                return res.status(400).json({ error: 'Invalid contract status' });
            }
            query += ` AND c.status = $${paramCount++}`;
            params.push(status);
        }
        // Safe sort by (whitelisted)
        if (sortBy.startsWith('-')) {
            const field = sortBy.substring(1);
            query += ` ORDER BY c.${field} DESC`;
        }
        else {
            query += ` ORDER BY c.${sortBy} ASC`;
        }
        const result = await connection_1.default.query(query, params);
        res.json(result.rows);
    }
    catch (error) {
        console.error('Filter contracts error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.filterContracts = filterContracts;
