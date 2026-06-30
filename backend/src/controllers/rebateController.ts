import { Response } from 'express';
import pool, { writeQuery } from '../db/connection';
import { AuthRequest } from '../middleware/auth';
import { isValidUUID } from '../middleware/validation';
import { AuditService } from '../services/auditService';
import { SystemSettings } from '../services/systemSettings';

export const getRebateCalculation = async (req: AuthRequest, res: Response) => {
  try {
    const { customer_id, contract_id } = req.query;

    if (!customer_id || !isValidUUID(customer_id as string)) {
      return res.status(400).json({ error: 'Valid customer_id is required' });
    }

    // Load customer info
    const customerResult = await pool.query(
      'SELECT id, full_name, email FROM users WHERE id = $1',
      [customer_id]
    );
    if (customerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Build contract filter
    let contractWhere = "c.customer_id = $1 AND c.status IN ('active', 'approved', 'expired')";
    const contractParams: any[] = [customer_id];
    if (contract_id && isValidUUID(contract_id as string)) {
      contractWhere += ' AND c.id = $2';
      contractParams.push(contract_id);
    }

    const contractsResult = await pool.query(
      `SELECT c.id, c.contract_number, c.start_date, c.end_date, c.status, c.rebate_percentage
       FROM contracts c
       WHERE ${contractWhere}
       ORDER BY c.end_date DESC`,
      contractParams
    );

    // For each expired contract fetch all linked orders
    const contracts = await Promise.all(
      contractsResult.rows.map(async (contract: any) => {
        const ordersResult = await pool.query(
          `SELECT id, order_number, order_date, total_amount, rebate_amount,
                  rebate_status, customer_status, rebate_paid_date
           FROM orders
           WHERE contract_id = $1
           ORDER BY order_date ASC`,
          [contract.id]
        );

        const orders = ordersResult.rows;
        const totalRebateAmount = orders.reduce(
          (sum: number, o: any) => sum + parseFloat(o.rebate_amount || 0),
          0
        );
        const unpaidRebateAmount = orders
          .filter((o: any) => o.rebate_status !== 'paid')
          .reduce((sum: number, o: any) => sum + parseFloat(o.rebate_amount || 0), 0);

        return {
          contract,
          orders,
          total_rebate_amount: totalRebateAmount,
          unpaid_rebate_amount: unpaidRebateAmount,
        };
      })
    );

    res.json({
      customer: customerResult.rows[0],
      contracts,
    });
  } catch (error) {
    console.error('Get rebate calculation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const payRebate = async (req: AuthRequest, res: Response) => {
  try {
    const { order_ids, payment_notes } = req.body;

    if (!Array.isArray(order_ids) || order_ids.length === 0) {
      return res.status(400).json({ error: 'order_ids must be a non-empty array' });
    }
    if (order_ids.length > 500) {
      return res.status(400).json({ error: 'Too many orders. Maximum 500 per payment' });
    }
    for (const id of order_ids) {
      if (!isValidUUID(id)) {
        return res.status(400).json({ error: `Invalid order ID: ${id}` });
      }
    }

    // Validate all orders belong to the same customer and are unpaid
    const placeholders = order_ids.map((_: any, i: number) => `$${i + 1}`).join(', ');
    const ordersResult = await pool.query(
      `SELECT id, customer_id, rebate_amount, rebate_status, contract_id
       FROM orders WHERE id IN (${placeholders})`,
      order_ids
    );

    if (ordersResult.rows.length !== order_ids.length) {
      return res.status(400).json({ error: 'One or more order IDs not found' });
    }

    const customerIds = new Set(ordersResult.rows.map((o: any) => o.customer_id));
    if (customerIds.size > 1) {
      return res.status(400).json({ error: 'All orders must belong to the same customer' });
    }

    const alreadyPaid = ordersResult.rows.filter((o: any) => o.rebate_status === 'paid');
    if (alreadyPaid.length > 0) {
      return res.status(400).json({
        error: `Orders already paid: ${alreadyPaid.map((o: any) => o.id).join(', ')}`,
      });
    }

    const totalPaid = ordersResult.rows.reduce(
      (sum: number, o: any) => sum + parseFloat(o.rebate_amount || 0),
      0
    );

    // Mark all as paid — $1=paid_by, $2=notes, then $3...$N+2 = order_ids
    const notes = payment_notes ? String(payment_notes).substring(0, 500) : null;
    const updatePlaceholders = order_ids.map((_: any, i: number) => `$${i + 3}`).join(', ');
    await writeQuery(
      `UPDATE orders
       SET rebate_status = 'paid',
           rebate_paid_date = NOW(),
           rebate_paid_by = $1,
           rebate_payment_notes = $2
       WHERE id IN (${updatePlaceholders})`,
      [req.user!.id, notes, ...order_ids]
    );

    // Expire any contract whose orders are now fully paid (parity with approveRebateRequest)
    const contractIds: string[] = [...new Set<string>(ordersResult.rows.map((o: any) => o.contract_id).filter(Boolean))];
    let expiredContractIds: string[] = [];
    if (contractIds.length > 0) {
      const remainingResult = await pool.query(
        `SELECT DISTINCT contract_id FROM orders
         WHERE contract_id = ANY($1) AND rebate_status != 'paid'`,
        [contractIds]
      );
      const stillUnpaid = new Set(remainingResult.rows.map((r: any) => r.contract_id));
      expiredContractIds = contractIds.filter((id) => !stillUnpaid.has(id));
      if (expiredContractIds.length > 0) {
        await writeQuery(
          `UPDATE contracts SET status = 'expired' WHERE id = ANY($1) AND status != 'expired'`,
          [expiredContractIds]
        );
      }
    }

    await AuditService.log(
      req.user!.id,
      'pay_rebate',
      'order',
      undefined,
      {
        order_ids,
        total_paid: totalPaid,
        customer_id: [...customerIds][0],
        notes,
        expired_contract_ids: expiredContractIds,
      },
      req.ip
    );

    res.json({
      message: `Rebate paid successfully for ${order_ids.length} order(s)`,
      total_paid: totalPaid,
      order_count: order_ids.length,
      expired_contract_ids: expiredContractIds,
    });
  } catch (error) {
    console.error('Pay rebate error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getRebateSettings = async (req: AuthRequest, res: Response) => {
  try {
    const [rebatePercentage, autoLockDays] = await Promise.all([
      SystemSettings.get('default_rebate_percentage', '1.00'),
      SystemSettings.get('auto_lock_days', '3'),
    ]);
    res.json({
      default_rebate_percentage: rebatePercentage,
      auto_lock_days: autoLockDays,
    });
  } catch (error) {
    console.error('Get rebate settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─── Rebate Request / Redemption Workflow ─────────────────────────────────────

// Customer submits a rebate redemption request
export const requestRebate = async (req: AuthRequest, res: Response) => {
  try {
    const { contract_id, customer_notes } = req.body;
    const customerId = req.user!.id;

    if (!contract_id || !isValidUUID(contract_id)) {
      return res.status(400).json({ error: 'Valid contract_id is required' });
    }

    // Verify contract belongs to this customer and is active or expired
    const contractResult = await pool.query(
      `SELECT id, customer_id, status FROM contracts WHERE id = $1`,
      [contract_id]
    );
    if (contractResult.rows.length === 0) {
      return res.status(404).json({ error: 'Contract not found' });
    }
    const contract = contractResult.rows[0];
    if (contract.customer_id !== customerId) {
      return res.status(403).json({ error: 'Not your contract' });
    }
    if (!['active', 'approved', 'expired'].includes(contract.status)) {
      return res.status(400).json({ error: 'Rebate can only be requested for active or expired contracts' });
    }

    // Check for existing pending request on this contract
    const existingReq = await pool.query(
      `SELECT id FROM rebate_requests WHERE contract_id = $1 AND status = 'pending'`,
      [contract_id]
    );
    if (existingReq.rows.length > 0) {
      return res.status(409).json({ error: 'A rebate request for this contract is already pending' });
    }

    // Calculate total unpaid rebate for this contract
    const totalsResult = await pool.query(
      `SELECT COALESCE(SUM(rebate_amount), 0) as total
       FROM orders WHERE contract_id = $1 AND rebate_status != 'paid'`,
      [contract_id]
    );
    const totalRebateAmount = parseFloat(totalsResult.rows[0].total);

    if (totalRebateAmount <= 0) {
      return res.status(400).json({ error: 'No unpaid rebate available for this contract' });
    }

    const requestResult = await writeQuery(
      `INSERT INTO rebate_requests
         (customer_id, contract_id, status, total_rebate_amount, customer_notes)
       VALUES ($1, $2, 'pending', $3, $4)
       RETURNING *`,
      [customerId, contract_id, totalRebateAmount, customer_notes || null]
    );

    await AuditService.log(customerId, 'request_rebate', 'contract', contract_id, {
      total_rebate_amount: totalRebateAmount,
    }, req.ip);

    res.status(201).json(requestResult.rows[0]);
  } catch (error) {
    console.error('Request rebate error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Customer checks their own pending rebate request for a contract
export const getMyRebateRequest = async (req: AuthRequest, res: Response) => {
  try {
    const customerId = req.user!.id;
    const { contract_id } = req.query;

    let whereClause = 'rr.customer_id = $1';
    const params: any[] = [customerId];

    if (contract_id && isValidUUID(contract_id as string)) {
      whereClause += ' AND rr.contract_id = $2';
      params.push(contract_id);
    }

    const result = await pool.query(
      `SELECT rr.*, u.full_name as processed_by_name
       FROM rebate_requests rr
       LEFT JOIN users u ON rr.processed_by = u.id
       WHERE ${whereClause}
       ORDER BY rr.requested_at DESC`,
      params
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get my rebate request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Staff gets all pending rebate requests (with customer + contract details)
export const listRebateRequests = async (req: AuthRequest, res: Response) => {
  try {
    const { status = 'pending' } = req.query;
    const result = await pool.query(
      `SELECT
         rr.*,
         u.full_name  as customer_name,
         u.email      as customer_email,
         u.phone      as customer_phone,
         c.contract_number,
         c.start_date as contract_start,
         c.end_date   as contract_end,
         c.rebate_percentage,
         c.status     as contract_status,
         pu.full_name as processed_by_name
       FROM rebate_requests rr
       JOIN users     u  ON rr.customer_id = u.id
       JOIN contracts c  ON rr.contract_id = c.id
       LEFT JOIN users pu ON rr.processed_by = pu.id
       WHERE rr.status = $1
       ORDER BY rr.requested_at DESC`,
      [status]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('List rebate requests error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Staff approves a rebate request → marks all orders paid → expires the contract
export const approveRebateRequest = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { staff_notes } = req.body;

    if (!isValidUUID(id)) {
      return res.status(400).json({ error: 'Invalid request ID' });
    }

    // Load the request
    const reqResult = await pool.query(
      `SELECT rr.*, c.customer_id as contract_customer_id
       FROM rebate_requests rr
       JOIN contracts c ON rr.contract_id = c.id
       WHERE rr.id = $1`,
      [id]
    );
    if (reqResult.rows.length === 0) {
      return res.status(404).json({ error: 'Rebate request not found' });
    }
    const rebateReq = reqResult.rows[0];
    if (rebateReq.status !== 'pending') {
      return res.status(400).json({ error: `Request is already ${rebateReq.status}` });
    }

    // Mark all unpaid orders under this contract as paid
    await writeQuery(
      `UPDATE orders
       SET rebate_status = 'paid',
           rebate_paid_date = NOW(),
           rebate_paid_by = $1,
           rebate_payment_notes = $2
       WHERE contract_id = $3 AND rebate_status != 'paid'`,
      [req.user!.id, staff_notes || null, rebateReq.contract_id]
    );

    // Expire the contract
    await writeQuery(
      `UPDATE contracts SET status = 'expired' WHERE id = $1`,
      [rebateReq.contract_id]
    );

    // Mark the request as approved
    await writeQuery(
      `UPDATE rebate_requests
       SET status = 'approved', processed_by = $1, processed_at = NOW(), staff_notes = $2
       WHERE id = $3`,
      [req.user!.id, staff_notes || null, id]
    );

    await AuditService.log(req.user!.id, 'approve_rebate', 'contract', rebateReq.contract_id, {
      request_id: id,
      customer_id: rebateReq.customer_id,
      total_rebate_amount: rebateReq.total_rebate_amount,
    }, req.ip);

    res.json({ message: 'Rebate approved and paid. Contract has been expired.' });
  } catch (error) {
    console.error('Approve rebate error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Staff rejects a rebate request
export const rejectRebateRequest = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { staff_notes } = req.body;

    if (!isValidUUID(id)) {
      return res.status(400).json({ error: 'Invalid request ID' });
    }

    const reqResult = await pool.query(
      `SELECT id, status FROM rebate_requests WHERE id = $1`, [id]
    );
    if (reqResult.rows.length === 0) {
      return res.status(404).json({ error: 'Rebate request not found' });
    }
    if (reqResult.rows[0].status !== 'pending') {
      return res.status(400).json({ error: `Request is already ${reqResult.rows[0].status}` });
    }

    await writeQuery(
      `UPDATE rebate_requests
       SET status = 'rejected', processed_by = $1, processed_at = NOW(), staff_notes = $2
       WHERE id = $3`,
      [req.user!.id, staff_notes || null, id]
    );

    res.json({ message: 'Rebate request rejected.' });
  } catch (error) {
    console.error('Reject rebate error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Staff: search customer by name + get their rebate calculation (for manual pay)
export const searchCustomerRebate = async (req: AuthRequest, res: Response) => {
  try {
    const { q } = req.query;
    if (!q || String(q).trim().length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }
    const search = `%${String(q).trim()}%`;

    const customersResult = await pool.query(
      `SELECT id, full_name, email, phone
       FROM users
       WHERE role = 'user' AND is_active = TRUE
         AND (full_name ILIKE $1 OR email ILIKE $1)
       ORDER BY full_name
       LIMIT 10`,
      [search]
    );

    // For each customer, load their contracts + unpaid rebate totals
    const customers = await Promise.all(
      customersResult.rows.map(async (customer: any) => {
        const contractsResult = await pool.query(
          `SELECT c.*,
                  COALESCE(SUM(CASE WHEN o.rebate_status != 'paid' THEN o.rebate_amount ELSE 0 END), 0) as unpaid_rebate,
                  COALESCE(SUM(CASE WHEN o.rebate_status = 'paid'  THEN o.rebate_amount ELSE 0 END), 0) as paid_rebate,
                  COUNT(o.id) as order_count,
                  rr.id as pending_request_id,
                  rr.status as request_status
           FROM contracts c
           LEFT JOIN orders o ON o.contract_id = c.id
           LEFT JOIN rebate_requests rr ON rr.contract_id = c.id AND rr.status = 'pending'
           WHERE c.customer_id = $1
             AND c.status IN ('active', 'approved', 'expired')
           GROUP BY c.id, rr.id, rr.status
           ORDER BY c.created_date DESC`,
          [customer.id]
        );
        return {
          ...customer,
          contracts: contractsResult.rows,
        };
      })
    );

    res.json(customers);
  } catch (error) {
    console.error('Search customer rebate error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
