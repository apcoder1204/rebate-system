import { Response } from 'express';
import pool from '../db/connection';
import { AuthRequest } from '../middleware/auth';
import { isValidDate, sanitizeSortBy } from '../middleware/validation';

/**
 * Export orders to CSV
 */
export const exportOrdersCSV = async (req: AuthRequest, res: Response) => {
  try {
    const { start_date, end_date, customer_id, customer_status } = req.query;

    // Check permissions
    if (!['admin', 'manager', 'staff'].includes(req.user!.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Validate dates
    if (start_date && !isValidDate(start_date as string)) {
      return res.status(400).json({ error: 'Invalid start_date format' });
    }
    if (end_date && !isValidDate(end_date as string)) {
      return res.status(400).json({ error: 'Invalid end_date format' });
    }

    let query = `
      SELECT 
        o.order_number,
        o.order_date,
        u.full_name as customer_name,
        u.email as customer_email,
        o.total_amount,
        o.rebate_amount,
        o.customer_status,
        o.customer_confirmed_date,
        o.is_locked,
        c.contract_number
      FROM orders o
      LEFT JOIN users u ON o.customer_id = u.id
      LEFT JOIN contracts c ON o.contract_id = c.id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramCount = 1;

    // Apply role-based filtering
    if (req.user!.role === 'staff') {
      query += ` AND o.created_by = $${paramCount}`;
      params.push(req.user!.id);
      paramCount++;
    }

    if (customer_id) {
      query += ` AND o.customer_id = $${paramCount}`;
      params.push(customer_id);
      paramCount++;
    }

    if (customer_status) {
      query += ` AND o.customer_status = $${paramCount}`;
      params.push(customer_status);
      paramCount++;
    }

    if (start_date) {
      query += ` AND o.order_date >= $${paramCount}`;
      params.push(start_date);
      paramCount++;
    }

    if (end_date) {
      query += ` AND o.order_date <= $${paramCount}`;
      params.push(end_date);
      paramCount++;
    }

    query += ` ORDER BY o.order_date DESC`;

    const result = await pool.query(query, params);

    // Generate CSV
    const headers = [
      'Order Number',
      'Order Date',
      'Customer Name',
      'Customer Email',
      'Total Amount',
      'Rebate Amount',
      'Status',
      'Confirmed Date',
      'Is Locked',
      'Contract Number'
    ];

    const csvRows = [
      headers.join(','),
      ...result.rows.map((row: any) => {
        return [
          `"${row.order_number || ''}"`,
          `"${row.order_date || ''}"`,
          `"${(row.customer_name || '').replace(/"/g, '""')}"`,
          `"${row.customer_email || ''}"`,
          row.total_amount || 0,
          row.rebate_amount || 0,
          `"${row.customer_status || ''}"`,
          `"${row.customer_confirmed_date || ''}"`,
          row.is_locked ? 'Yes' : 'No',
          `"${row.contract_number || ''}"`
        ].join(',');
      })
    ];

    const csv = csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=orders_${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('Export orders CSV error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Export contracts to CSV
 */
export const exportContractsCSV = async (req: AuthRequest, res: Response) => {
  try {
    const { start_date, end_date, customer_id, status } = req.query;

    // Check permissions
    if (!['admin', 'manager', 'staff'].includes(req.user!.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Validate dates
    if (start_date && !isValidDate(start_date as string)) {
      return res.status(400).json({ error: 'Invalid start_date format' });
    }
    if (end_date && !isValidDate(end_date as string)) {
      return res.status(400).json({ error: 'Invalid end_date format' });
    }

    let query = `
      SELECT 
        c.contract_number,
        u.full_name as customer_name,
        u.email as customer_email,
        u.phone as customer_phone,
        c.start_date,
        c.end_date,
        c.rebate_percentage,
        c.status,
        c.created_date,
        c.approved_date
      FROM contracts c
      LEFT JOIN users u ON c.customer_id = u.id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramCount = 1;

    // Apply role-based filtering
    if (req.user!.role === 'staff') {
      query += ` AND (c.status IN ('pending', 'pending_approval') OR c.approved_by = $${paramCount})`;
      params.push(req.user!.id);
      paramCount++;
    }

    if (customer_id) {
      query += ` AND c.customer_id = $${paramCount}`;
      params.push(customer_id);
      paramCount++;
    }

    if (status) {
      query += ` AND c.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (start_date) {
      query += ` AND c.start_date >= $${paramCount}`;
      params.push(start_date);
      paramCount++;
    }

    if (end_date) {
      query += ` AND c.end_date <= $${paramCount}`;
      params.push(end_date);
      paramCount++;
    }

    query += ` ORDER BY c.created_date DESC`;

    const result = await pool.query(query, params);

    // Generate CSV
    const headers = [
      'Contract Number',
      'Customer Name',
      'Customer Email',
      'Customer Phone',
      'Start Date',
      'End Date',
      'Rebate Percentage',
      'Status',
      'Created Date',
      'Approved Date'
    ];

    const csvRows = [
      headers.join(','),
      ...result.rows.map((row: any) => {
        return [
          `"${row.contract_number || ''}"`,
          `"${(row.customer_name || '').replace(/"/g, '""')}"`,
          `"${row.customer_email || ''}"`,
          `"${row.customer_phone || ''}"`,
          `"${row.start_date || ''}"`,
          `"${row.end_date || ''}"`,
          row.rebate_percentage || 0,
          `"${row.status || ''}"`,
          `"${row.created_date || ''}"`,
          `"${row.approved_date || ''}"`
        ].join(',');
      })
    ];

    const csv = csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=contracts_${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('Export contracts CSV error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
