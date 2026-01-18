import { Response } from 'express';
import pool from '../db/connection';
import { AuthRequest } from '../middleware/auth';
import { isValidDate, sanitizeNumber } from '../middleware/validation';

/**
 * Get revenue report with date range
 */
export const getRevenueReport = async (req: AuthRequest, res: Response) => {
  try {
    const { start_date, end_date } = req.query;

    // Validate dates
    if (start_date && !isValidDate(start_date as string)) {
      return res.status(400).json({ error: 'Invalid start_date format. Use ISO 8601 format' });
    }
    if (end_date && !isValidDate(end_date as string)) {
      return res.status(400).json({ error: 'Invalid end_date format. Use ISO 8601 format' });
    }

    // Check permissions - only admin and manager can view reports
    if (!['admin', 'manager'].includes(req.user!.role)) {
      return res.status(403).json({ error: 'Only admins and managers can view reports' });
    }

    let query = `
      SELECT 
        DATE(o.order_date) as date,
        COUNT(DISTINCT o.id) as order_count,
        COUNT(DISTINCT o.customer_id) as customer_count,
        SUM(o.total_amount) as total_revenue,
        SUM(o.rebate_amount) as total_rebate,
        AVG(o.total_amount) as avg_order_value
      FROM orders o
      WHERE o.customer_status = 'confirmed'
    `;

    const params: any[] = [];
    let paramCount = 1;

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

    query += ` GROUP BY DATE(o.order_date) ORDER BY date DESC`;

    const result = await pool.query(query, params);

    // Calculate totals
    const totals = result.rows.reduce(
      (acc, row) => ({
        totalOrders: acc.totalOrders + parseInt(row.order_count, 10),
        totalCustomers: acc.totalCustomers + parseInt(row.customer_count, 10),
        totalRevenue: acc.totalRevenue + parseFloat(row.total_revenue || 0),
        totalRebate: acc.totalRebate + parseFloat(row.total_rebate || 0),
      }),
      { totalOrders: 0, totalCustomers: 0, totalRevenue: 0, totalRebate: 0 }
    );

    res.json({
      data: result.rows.map((row) => ({
        date: row.date,
        orderCount: parseInt(row.order_count, 10),
        customerCount: parseInt(row.customer_count, 10),
        totalRevenue: parseFloat(row.total_revenue || 0),
        totalRebate: parseFloat(row.total_rebate || 0),
        avgOrderValue: parseFloat(row.avg_order_value || 0),
      })),
      totals,
      period: {
        startDate: start_date || null,
        endDate: end_date || null,
      },
    });
  } catch (error) {
    console.error('Get revenue report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get order trends report
 */
export const getOrderTrends = async (req: AuthRequest, res: Response) => {
  try {
    const { start_date, end_date, group_by = 'day' } = req.query;

    // Validate dates
    if (start_date && !isValidDate(start_date as string)) {
      return res.status(400).json({ error: 'Invalid start_date format' });
    }
    if (end_date && !isValidDate(end_date as string)) {
      return res.status(400).json({ error: 'Invalid end_date format' });
    }

    // Validate group_by
    const validGroupBy = ['day', 'week', 'month'];
    if (!validGroupBy.includes(group_by as string)) {
      return res.status(400).json({ error: 'Invalid group_by. Must be day, week, or month' });
    }

    // Check permissions
    if (!['admin', 'manager'].includes(req.user!.role)) {
      return res.status(403).json({ error: 'Only admins and managers can view reports' });
    }

    let dateGrouping: string;
    switch (group_by) {
      case 'week':
        dateGrouping = `DATE_TRUNC('week', o.order_date)`;
        break;
      case 'month':
        dateGrouping = `DATE_TRUNC('month', o.order_date)`;
        break;
      default:
        dateGrouping = `DATE(o.order_date)`;
    }

    let query = `
      SELECT 
        ${dateGrouping} as period,
        COUNT(*) as order_count,
        COUNT(DISTINCT o.customer_id) as unique_customers,
        SUM(CASE WHEN o.customer_status = 'pending' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN o.customer_status = 'confirmed' THEN 1 ELSE 0 END) as confirmed_count,
        SUM(CASE WHEN o.customer_status = 'disputed' THEN 1 ELSE 0 END) as disputed_count,
        SUM(o.total_amount) as total_amount,
        SUM(o.rebate_amount) as total_rebate
      FROM orders o
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramCount = 1;

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

    query += ` GROUP BY ${dateGrouping} ORDER BY period DESC`;

    const result = await pool.query(query, params);

    res.json({
      data: result.rows.map((row) => ({
        period: row.period,
        orderCount: parseInt(row.order_count, 10),
        uniqueCustomers: parseInt(row.unique_customers, 10),
        pendingCount: parseInt(row.pending_count, 10),
        confirmedCount: parseInt(row.confirmed_count, 10),
        disputedCount: parseInt(row.disputed_count, 10),
        totalAmount: parseFloat(row.total_amount || 0),
        totalRebate: parseFloat(row.total_rebate || 0),
      })),
      groupBy: group_by,
      period: {
        startDate: start_date || null,
        endDate: end_date || null,
      },
    });
  } catch (error) {
    console.error('Get order trends error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get customer statistics report
 */
export const getCustomerStats = async (req: AuthRequest, res: Response) => {
  try {
    const { start_date, end_date } = req.query;

    // Validate dates
    if (start_date && !isValidDate(start_date as string)) {
      return res.status(400).json({ error: 'Invalid start_date format' });
    }
    if (end_date && !isValidDate(end_date as string)) {
      return res.status(400).json({ error: 'Invalid end_date format' });
    }

    // Check permissions
    if (!['admin', 'manager'].includes(req.user!.role)) {
      return res.status(403).json({ error: 'Only admins and managers can view reports' });
    }

    let query = `
      SELECT 
        u.id,
        u.full_name,
        u.email,
        COUNT(o.id) as total_orders,
        SUM(CASE WHEN o.customer_status = 'confirmed' THEN o.total_amount ELSE 0 END) as total_spent,
        SUM(CASE WHEN o.customer_status = 'confirmed' THEN o.rebate_amount ELSE 0 END) as total_rebate,
        AVG(CASE WHEN o.customer_status = 'confirmed' THEN o.total_amount ELSE NULL END) as avg_order_value,
        MAX(o.order_date) as last_order_date
      FROM users u
      LEFT JOIN orders o ON u.id = o.customer_id
      WHERE u.role NOT IN ('admin', 'manager', 'staff')
    `;

    const params: any[] = [];
    let paramCount = 1;

    if (start_date) {
      query += ` AND (o.order_date >= $${paramCount} OR o.order_date IS NULL)`;
      params.push(start_date);
      paramCount++;
    }

    if (end_date) {
      query += ` AND (o.order_date <= $${paramCount} OR o.order_date IS NULL)`;
      params.push(end_date);
      paramCount++;
    }

    query += `
      GROUP BY u.id, u.full_name, u.email
      HAVING COUNT(o.id) > 0
      ORDER BY total_spent DESC NULLS LAST
    `;

    const result = await pool.query(query, params);

    res.json({
      data: result.rows.map((row) => ({
        customerId: row.id,
        customerName: row.full_name,
        customerEmail: row.email,
        totalOrders: parseInt(row.total_orders, 10),
        totalSpent: parseFloat(row.total_spent || 0),
        totalRebate: parseFloat(row.total_rebate || 0),
        avgOrderValue: parseFloat(row.avg_order_value || 0),
        lastOrderDate: row.last_order_date,
      })),
      period: {
        startDate: start_date || null,
        endDate: end_date || null,
      },
    });
  } catch (error) {
    console.error('Get customer stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get summary statistics
 */
export const getSummaryStats = async (req: AuthRequest, res: Response) => {
  try {
    const { start_date, end_date } = req.query;

    // Validate dates
    if (start_date && !isValidDate(start_date as string)) {
      return res.status(400).json({ error: 'Invalid start_date format' });
    }
    if (end_date && !isValidDate(end_date as string)) {
      return res.status(400).json({ error: 'Invalid end_date format' });
    }

    // Check permissions
    if (!['admin', 'manager'].includes(req.user!.role)) {
      return res.status(403).json({ error: 'Only admins and managers can view reports' });
    }

    let dateFilter = '';
    const params: any[] = [];
    let paramCount = 1;

    if (start_date || end_date) {
      dateFilter = 'WHERE ';
      if (start_date) {
        dateFilter += `o.order_date >= $${paramCount}`;
        params.push(start_date);
        paramCount++;
        if (end_date) {
          dateFilter += ` AND `;
        }
      }
      if (end_date) {
        dateFilter += `o.order_date <= $${paramCount}`;
        params.push(end_date);
        paramCount++;
      }
    }

    const query = `
      SELECT 
        COUNT(*) as total_orders,
        COUNT(DISTINCT o.customer_id) as total_customers,
        COUNT(CASE WHEN o.customer_status = 'pending' THEN 1 END) as pending_orders,
        COUNT(CASE WHEN o.customer_status = 'confirmed' THEN 1 END) as confirmed_orders,
        COUNT(CASE WHEN o.customer_status = 'disputed' THEN 1 END) as disputed_orders,
        SUM(CASE WHEN o.customer_status = 'confirmed' THEN o.total_amount ELSE 0 END) as total_revenue,
        SUM(CASE WHEN o.customer_status = 'confirmed' THEN o.rebate_amount ELSE 0 END) as total_rebate,
        AVG(CASE WHEN o.customer_status = 'confirmed' THEN o.total_amount ELSE NULL END) as avg_order_value
      FROM orders o
      ${dateFilter}
    `;

    const result = await pool.query(query, params);
    const stats = result.rows[0];

    res.json({
      totalOrders: parseInt(stats.total_orders, 10),
      totalCustomers: parseInt(stats.total_customers, 10),
      pendingOrders: parseInt(stats.pending_orders, 10),
      confirmedOrders: parseInt(stats.confirmed_orders, 10),
      disputedOrders: parseInt(stats.disputed_orders, 10),
      totalRevenue: parseFloat(stats.total_revenue || 0),
      totalRebate: parseFloat(stats.total_rebate || 0),
      avgOrderValue: parseFloat(stats.avg_order_value || 0),
      period: {
        startDate: start_date || null,
        endDate: end_date || null,
      },
    });
  } catch (error) {
    console.error('Get summary stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
