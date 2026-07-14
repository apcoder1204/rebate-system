import { Response } from 'express';
import pool from '../db/connection';
import { AuthRequest } from '../middleware/auth';
import { isValidUUID, sanitizeString, sanitizeNumber, sanitizeSortBy, isValidDate, isValidContractStatus, sanitizePagination } from '../middleware/validation';
import { AuditService } from '../services/auditService';
import { AuditFormatter } from '../services/auditFormatter';

export const listContracts = async (req: AuthRequest, res: Response) => {
  try {
    // Auto-expire contracts whose end_date has passed (same pattern as order auto-lock)
    await pool.query(
      `UPDATE contracts SET status = 'expired'
       WHERE end_date < CURRENT_DATE AND status IN ('active', 'approved')`
    );

    const sortBy = sanitizeSortBy(
      req.query.sortBy as string,
      ['created_date', 'start_date', 'end_date'],
      'created_date'
    );

    // Get pagination parameters
    const { page, limit, offset } = sanitizePagination(
      req.query.page as string | number | undefined,
      req.query.pageSize as string | number | undefined
    );
    // Check if approved_by column exists before using it
    let hasApprovedByColumn = false;
    try {
      const columnCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='contracts' AND column_name='approved_by'
      `);
      hasApprovedByColumn = columnCheck.rows.length > 0;
    } catch (e) {
      // Column check failed, assume it doesn't exist
    }
    
    // Check if created_by column exists before using it
    let hasCreatedByColumn = false;
    try {
      const columnCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='contracts' AND column_name='created_by'
      `);
      hasCreatedByColumn = columnCheck.rows.length > 0;
    } catch (e) {
      // Column check failed, assume it doesn't exist
    }
    
    let selectFields = `
      c.*,
      u.full_name as customer_name,
      u.email as customer_email,
      u.phone as customer_phone,
      (
        SELECT CASE
          WHEN COUNT(*) = 0 THEN false
          WHEN COUNT(*) FILTER (WHERE rebate_status = 'unpaid') = 0 THEN true
          ELSE false
        END
        FROM orders WHERE contract_id = c.id
      ) as rebate_fully_paid
    `;
    if (hasApprovedByColumn) {
      selectFields += `,
      approver.full_name as approver_name`;
    }
    if (hasCreatedByColumn) {
      selectFields += `,
      creator.full_name as creator_name`;
    }
    
    // Build count query
    let countQuery = `
      SELECT COUNT(*) as total
      FROM contracts c
      LEFT JOIN users u ON c.customer_id = u.id
    `;
    if (hasApprovedByColumn) {
      countQuery += ` LEFT JOIN users approver ON c.approved_by = approver.id`;
    }
    if (hasCreatedByColumn) {
      countQuery += ` LEFT JOIN users creator ON c.created_by = creator.id`;
    }
    
    // Build data query
    let query = `
      SELECT ${selectFields}
      FROM contracts c
      LEFT JOIN users u ON c.customer_id = u.id
    `;
    if (hasApprovedByColumn) {
      query += ` LEFT JOIN users approver ON c.approved_by = approver.id`;
    }
    if (hasCreatedByColumn) {
      query += ` LEFT JOIN users creator ON c.created_by = creator.id`;
    }
    
    const params: any[] = [];
    let paramCount = 1;
    let hasWhere = false;
    
    // Apply role-based filtering — customers see only their own; staff/admin/manager see all
    if (req.user!.role === 'user') {
      query += ` WHERE c.customer_id = $${paramCount}`;
      countQuery += ` WHERE c.customer_id = $${paramCount}`;
      params.push(req.user!.id);
      paramCount++;
      hasWhere = true;
    }
    
    // Safe sort by (whitelisted)
    if (sortBy.startsWith('-')) {
      const field = sortBy.substring(1);
      query += ` ORDER BY c.${field} DESC`;
    } else {
      query += ` ORDER BY c.${sortBy} ASC`;
    }
    
    // Add pagination
    query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);
    
    // Get total count
    const countResult = await pool.query(countQuery, params.slice(0, paramCount - 1));
    const total = parseInt(countResult.rows[0].total, 10);
    
    // Get paginated results
    const result = await pool.query(query, params);
    
    res.json({
      data: result.rows,
      pagination: {
        page,
        pageSize: limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('List contracts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getContract = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    // Validate ID format
    if (!isValidUUID(id)) {
      return res.status(400).json({ error: 'Invalid contract ID format' });
    }
    
    // Check if approved_by column exists
    let hasApprovedByColumn = false;
    try {
      const columnCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='contracts' AND column_name='approved_by'
      `);
      hasApprovedByColumn = columnCheck.rows.length > 0;
    } catch (e) {
      // Column check failed
    }
    
    // Check if created_by column exists
    let hasCreatedByColumn = false;
    try {
      const columnCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='contracts' AND column_name='created_by'
      `);
      hasCreatedByColumn = columnCheck.rows.length > 0;
    } catch (e) {
      // Column check failed
    }
    
    let getSelect = `
      c.*,
      u.full_name as customer_name,
      u.email as customer_email,
      u.phone as customer_phone
    `;
    if (hasApprovedByColumn) {
      getSelect += `,
      approver.full_name as approver_name`;
    }
    if (hasCreatedByColumn) {
      getSelect += `,
      creator.full_name as creator_name`;
    }
    
    let getQuery = `
      SELECT ${getSelect}
      FROM contracts c
      LEFT JOIN users u ON c.customer_id = u.id
    `;
    if (hasApprovedByColumn) {
      getQuery += ` LEFT JOIN users approver ON c.approved_by = approver.id`;
    }
    if (hasCreatedByColumn) {
      getQuery += ` LEFT JOIN users creator ON c.created_by = creator.id`;
    }
    getQuery += ` WHERE c.id = $1`;
    
    const result = await pool.query(getQuery, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contract not found' });
    }
    
    // Check permissions - IDOR protection
    if (req.user!.role === 'user' && result.rows[0].customer_id !== req.user!.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get contract error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createContract = async (req: AuthRequest, res: Response) => {
  try {
    const { customer_id, start_date, rebate_percentage, status, signed_contract_url, customer_signature_data_url } = req.body;

    if (!customer_id || !start_date) {
      return res.status(400).json({ error: 'Customer ID and start date are required' });
    }

    // Validate customer_id format
    if (!isValidUUID(customer_id)) {
      return res.status(400).json({ error: 'Invalid customer ID format' });
    }

    // Validate start date
    if (!isValidDate(start_date)) {
      return res.status(400).json({ error: 'Invalid date format. Use ISO 8601 format' });
    }

    // Always use the fixed cycle end date — never trust client-provided end_date
    const cycleSettingResult = await pool.query(
      `SELECT value FROM system_settings WHERE key = 'cycle_end_date'`
    );
    if (cycleSettingResult.rows.length === 0) {
      return res.status(500).json({ error: 'cycle_end_date is not configured in system settings' });
    }
    const end_date = cycleSettingResult.rows[0].value as string;

    const start = new Date(start_date);
    const end = new Date(end_date);
    if (end <= start) {
      return res.status(400).json({
        error: `Start date must be before the program cycle end date (${end_date}). Please update the cycle_end_date setting if the cycle has been extended.`,
      });
    }
    
    // Validate rebate_percentage if provided
    if (rebate_percentage !== undefined) {
      const sanitizedRebate = sanitizeNumber(rebate_percentage, 0, 100);
      if (sanitizedRebate === null) {
        return res.status(400).json({ error: 'Invalid rebate percentage. Must be between 0 and 100' });
      }
    }
    
    // Validate status if provided
    if (status !== undefined && !isValidContractStatus(status)) {
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
    if (req.user!.role === 'user' && customer_id !== req.user!.id) {
      return res.status(403).json({ error: 'You can only create contracts for yourself' });
    }
    
    // Block new contract only if an active/pending one already exists (expired ones are fine — renewal creates new)
    if (req.user!.role === 'user' || customer_id === req.user!.id) {
      const existingContractCheck = await pool.query(
        `SELECT id FROM contracts
         WHERE customer_id = $1 AND status NOT IN ('expired', 'cancelled', 'rejected')`,
        [customer_id]
      );

      if (existingContractCheck.rows.length > 0) {
        return res.status(400).json({
          error: 'You already have an active or pending contract. Please wait for it to expire before creating a new one.',
        });
      }
    }
    
    const contractNumber = `CNT-${Date.now()}`;
    
    const result = await pool.query(
      `INSERT INTO contracts 
       (customer_id, contract_number, start_date, end_date, rebate_percentage, status, signed_contract_url, customer_signature_data_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        customer_id,
        contractNumber,
        start_date,
        end_date,
        rebate_percentage || 1.00,
        status || 'pending',
        signed_contract_url || null,
        customer_signature_data_url || null,
      ]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create contract error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateContract = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { 
      start_date, 
      end_date, 
      rebate_percentage, 
      status, 
      signed_contract_url,
      customer_signature_data_url,
      manager_signature_data_url,
      manager_name,
      manager_position,
      approved_by
    } = req.body;
    
    // Validate ID format
    if (!isValidUUID(id)) {
      return res.status(400).json({ error: 'Invalid contract ID format' });
    }
    
    // Get the contract first to check permissions
    const contractResult = await pool.query('SELECT * FROM contracts WHERE id = $1', [id]);
    if (contractResult.rows.length === 0) {
      return res.status(404).json({ error: 'Contract not found' });
    }
    
    const contract = contractResult.rows[0];
    
    // Validate inputs
    if (start_date !== undefined && !isValidDate(start_date)) {
      return res.status(400).json({ error: 'Invalid start date format' });
    }
    
    if (end_date !== undefined && !isValidDate(end_date)) {
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
      const sanitizedRebate = sanitizeNumber(rebate_percentage, 0, 100);
      if (sanitizedRebate === null) {
        return res.status(400).json({ error: 'Invalid rebate percentage' });
      }
    }
    
    if (status !== undefined && !isValidContractStatus(status)) {
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
    
    if (approved_by !== undefined && !isValidUUID(approved_by)) {
      return res.status(400).json({ error: 'Invalid approver ID format' });
    }
    
    // Check permissions: allow admin, manager, and staff to modify contracts
    if (!['admin', 'manager', 'staff'].includes(req.user!.role)) {
      return res.status(403).json({ error: 'Only admins, managers and staff can modify contracts' });
    }
    
    // Whitelist of allowed column names to prevent SQL injection
    const updates: string[] = [];
    const values: any[] = [];
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
      const sanitizedRebate = sanitizeNumber(rebate_percentage, 0, 100)!;
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
      const sanitizedName = manager_name ? sanitizeString(manager_name).substring(0, 200) : null;
      updates.push(`manager_name = $${paramCount++}`);
      values.push(sanitizedName);
    }
    if (manager_position !== undefined) {
      const sanitizedPos = manager_position ? sanitizeString(manager_position).substring(0, 200) : null;
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
    const result = await pool.query(
      `UPDATE contracts SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update contract error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteContract = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    // Validate ID format
    if (!isValidUUID(id)) {
      return res.status(400).json({ error: 'Invalid contract ID format' });
    }
    
    // Check permissions
    if (req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can delete contracts' });
    }
    
    const result = await pool.query('DELETE FROM contracts WHERE id = $1 RETURNING id', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contract not found' });
    }
    
    res.json({ message: 'Contract deleted successfully' });
  } catch (error) {
    console.error('Delete contract error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const filterContracts = async (req: AuthRequest, res: Response) => {
  try {
    const { customer_id, status, start_date, end_date, min_rebate, max_rebate } = req.query;
    const sortBy = sanitizeSortBy(
      req.query.sortBy as string,
      ['created_date', 'start_date', 'end_date'],
      'created_date'
    );
    
    // Get pagination parameters
    const { page, limit, offset } = sanitizePagination(
      req.query.page as string | number | undefined,
      req.query.pageSize as string | number | undefined
    );
    
    // Check if approved_by column exists
    let hasApprovedByColumn = false;
    try {
      const columnCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='contracts' AND column_name='approved_by'
      `);
      hasApprovedByColumn = columnCheck.rows.length > 0;
    } catch (e) {
      // Column check failed
    }
    
    // Check if created_by column exists
    let hasCreatedByColumn = false;
    try {
      const columnCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='contracts' AND column_name='created_by'
      `);
      hasCreatedByColumn = columnCheck.rows.length > 0;
    } catch (e) {
      // Column check failed
    }
    
    let selectFields = `
      c.*,
      u.full_name as customer_name,
      u.email as customer_email,
      u.phone as customer_phone,
      (
        SELECT CASE
          WHEN COUNT(*) = 0 THEN false
          WHEN COUNT(*) FILTER (WHERE rebate_status = 'unpaid') = 0 THEN true
          ELSE false
        END
        FROM orders WHERE contract_id = c.id
      ) as rebate_fully_paid
    `;
    if (hasApprovedByColumn) {
      selectFields += `,
      approver.full_name as approver_name`;
    }
    if (hasCreatedByColumn) {
      selectFields += `,
      creator.full_name as creator_name`;
    }
    
    // Build count query
    let countQuery = `
      SELECT COUNT(*) as total
      FROM contracts c
      LEFT JOIN users u ON c.customer_id = u.id
    `;
    if (hasApprovedByColumn) {
      countQuery += ` LEFT JOIN users approver ON c.approved_by = approver.id`;
    }
    if (hasCreatedByColumn) {
      countQuery += ` LEFT JOIN users creator ON c.created_by = creator.id`;
    }
    countQuery += ` WHERE 1=1`;
    
    // Build data query
    let query = `
      SELECT ${selectFields}
      FROM contracts c
      LEFT JOIN users u ON c.customer_id = u.id
    `;
    if (hasApprovedByColumn) {
      query += ` LEFT JOIN users approver ON c.approved_by = approver.id`;
    }
    if (hasCreatedByColumn) {
      query += ` LEFT JOIN users creator ON c.created_by = creator.id`;
    }
    query += ` WHERE 1=1`;
    
    const params: any[] = [];
    let paramCount = 1;
    
    // Apply role-based filtering - IDOR protection
    // Customers see only their own contracts; staff/admin/manager see all
    if (req.user!.role === 'user') {
      query += ` AND c.customer_id = $${paramCount}`;
      countQuery += ` AND c.customer_id = $${paramCount}`;
      params.push(req.user!.id);
      paramCount++;
    } else if (customer_id) {
      // Validate customer_id format for admin/manager/staff
      if (!isValidUUID(customer_id as string)) {
        return res.status(400).json({ error: 'Invalid customer ID format' });
      }
      query += ` AND c.customer_id = $${paramCount}`;
      countQuery += ` AND c.customer_id = $${paramCount}`;
      params.push(customer_id);
      paramCount++;
    }
    
    if (status) {
      // Validate status
      if (!isValidContractStatus(status as string)) {
        return res.status(400).json({ error: 'Invalid contract status' });
      }
      query += ` AND c.status = $${paramCount}`;
      countQuery += ` AND c.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }
    
    // Date range filtering
    if (start_date && isValidDate(start_date as string)) {
      query += ` AND c.start_date >= $${paramCount}`;
      countQuery += ` AND c.start_date >= $${paramCount}`;
      params.push(start_date);
      paramCount++;
    }
    
    if (end_date && isValidDate(end_date as string)) {
      query += ` AND c.end_date <= $${paramCount}`;
      countQuery += ` AND c.end_date <= $${paramCount}`;
      params.push(end_date);
      paramCount++;
    }
    
    // Rebate percentage range filtering
    if (min_rebate) {
      const minRebate = sanitizeNumber(min_rebate, 0, 100);
      if (minRebate !== null) {
        query += ` AND c.rebate_percentage >= $${paramCount}`;
        countQuery += ` AND c.rebate_percentage >= $${paramCount}`;
        params.push(minRebate);
        paramCount++;
      }
    }
    
    if (max_rebate) {
      const maxRebate = sanitizeNumber(max_rebate, 0, 100);
      if (maxRebate !== null) {
        query += ` AND c.rebate_percentage <= $${paramCount}`;
        countQuery += ` AND c.rebate_percentage <= $${paramCount}`;
        params.push(maxRebate);
        paramCount++;
      }
    }
    
    // Safe sort by (whitelisted)
    if (sortBy.startsWith('-')) {
      const field = sortBy.substring(1);
      query += ` ORDER BY c.${field} DESC`;
    } else {
      query += ` ORDER BY c.${sortBy} ASC`;
    }
    
    // Add pagination
    query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);
    
    // Get total count
    const countResult = await pool.query(countQuery, params.slice(0, paramCount - 1));
    const total = parseInt(countResult.rows[0].total, 10);
    
    // Get paginated results
    const result = await pool.query(query, params);
    
    res.json({
      data: result.rows,
      pagination: {
        page,
        pageSize: limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Filter contracts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const renewContract = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return res.status(400).json({ error: 'Invalid contract ID format' });
    }

    // Load source contract
    const sourceResult = await pool.query(
      'SELECT * FROM contracts WHERE id = $1',
      [id]
    );
    if (sourceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Contract not found' });
    }
    const source = sourceResult.rows[0];

    // Customers can only renew their own contracts
    if (req.user!.role === 'user' && source.customer_id !== req.user!.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Only expired contracts can be renewed
    if (source.status !== 'expired') {
      return res.status(400).json({ error: 'Only expired contracts can be renewed' });
    }

    // Prevent duplicate renewal (if an open renewal already exists)
    const duplicateCheck = await pool.query(
      `SELECT id FROM contracts
       WHERE renewed_from_id = $1
         AND status NOT IN ('expired', 'cancelled', 'rejected')`,
      [id]
    );
    if (duplicateCheck.rows.length > 0) {
      return res.status(400).json({ error: 'A renewal for this contract already exists' });
    }

    // Fetch fixed cycle end date from system_settings
    const cycleSettingResult = await pool.query(
      `SELECT value FROM system_settings WHERE key = 'cycle_end_date'`
    );
    if (cycleSettingResult.rows.length === 0) {
      return res.status(500).json({ error: 'cycle_end_date is not configured in system settings' });
    }
    const cycleEndDateStr = cycleSettingResult.rows[0].value as string;
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    if (cycleEndDateStr <= todayStr) {
      return res.status(400).json({
        error: `The program cycle ended on ${cycleEndDateStr}. Please update the cycle_end_date setting before creating new contracts.`,
      });
    }

    const startDateStr = todayStr;
    const newRenewalCount = (source.renewal_count || 0) + 1;
    const contractNumber = `CNT-${Date.now()}`;

    // Copy all signature data from source contract so no re-signing is required
    const result = await pool.query(
      `INSERT INTO contracts
         (customer_id, contract_number, start_date, end_date, rebate_percentage,
          status, renewed_from_id, renewal_count,
          signed_contract_url, customer_signature_data_url,
          manager_signature_data_url, manager_name, manager_position)
       VALUES ($1, $2, $3, $4, $5, 'pending_approval', $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        source.customer_id,
        contractNumber,
        startDateStr,
        cycleEndDateStr,
        source.rebate_percentage,
        id,
        newRenewalCount,
        source.signed_contract_url || null,
        source.customer_signature_data_url || null,
        source.manager_signature_data_url || null,
        source.manager_name || null,
        source.manager_position || null,
      ]
    );

    const renewActorName = await AuditService.getUserName(req.user!.id);
    const renewCustomerName = await AuditService.getUserName(source.customer_id);
    const renewDesc = AuditFormatter.renewContract(renewActorName, renewCustomerName, source.contract_number, result.rows[0].contract_number, newRenewalCount);
    await AuditService.log(
      req.user!.id,
      'renew_contract',
      'contract',
      result.rows[0].id,
      { source_contract_id: id, renewal_count: newRenewalCount },
      req.ip,
      renewDesc
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Renew contract error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const approveRenewal = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (!isValidUUID(id)) {
      return res.status(400).json({ error: 'Invalid contract ID format' });
    }

    const contractResult = await pool.query(
      `SELECT c.*, u.full_name AS customer_name
       FROM contracts c
       JOIN users u ON c.customer_id = u.id
       WHERE c.id = $1`,
      [id]
    );
    if (contractResult.rows.length === 0) {
      return res.status(404).json({ error: 'Contract not found' });
    }
    const contract = contractResult.rows[0];

    if (!['pending', 'pending_approval'].includes(contract.status)) {
      return res.status(400).json({ error: 'Contract is not pending approval' });
    }
    if (!contract.renewed_from_id) {
      return res.status(400).json({ error: 'This is not a renewal contract. Use the standard approval flow.' });
    }

    const updateResult = await pool.query(
      `UPDATE contracts
       SET status = 'active', approved_by = $1, approved_date = NOW()
       WHERE id = $2
       RETURNING *`,
      [req.user!.id, id]
    );

    const actorName = await AuditService.getUserName(req.user!.id);
    const desc = AuditFormatter.approveRenewal(actorName, contract.customer_name, contract.contract_number);
    await AuditService.log(
      req.user!.id,
      'approve_renewal',
      'contract',
      id,
      { renewed_from_id: contract.renewed_from_id },
      req.ip,
      desc
    );

    res.json(updateResult.rows[0]);
  } catch (error) {
    console.error('Approve renewal error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const bulkExpireContracts = async (req: AuthRequest, res: Response) => {
  try {
    if (!['admin', 'manager'].includes(req.user!.role)) {
      return res.status(403).json({ error: 'Only admins and managers can bulk expire contracts' });
    }

    const result = await pool.query(
      `UPDATE contracts
       SET status = 'expired'
       WHERE status IN ('active', 'approved')
       RETURNING id`
    );

    const count = result.rowCount || 0;
    const actorName = await AuditService.getUserName(req.user!.id);
    const desc = AuditFormatter.bulkExpireContracts(actorName, count);
    await AuditService.log(
      req.user!.id,
      'bulk_expire_contracts',
      'system',
      undefined,
      { expired_count: count },
      req.ip,
      desc
    );

    res.json({ expired_count: count, message: `${count} contract(s) set to expired.` });
  } catch (error) {
    console.error('Bulk expire contracts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

