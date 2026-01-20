"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.filterOrders = exports.deleteOrder = exports.updateOrder = exports.createOrder = exports.getOrder = exports.listOrders = void 0;
const connection_1 = __importDefault(require("../db/connection"));
const validation_1 = require("../middleware/validation");
const systemSettings_1 = require("../services/systemSettings");
const listOrders = async (req, res) => {
    try {
        const sortBy = (0, validation_1.sanitizeSortBy)(req.query.sortBy, ['order_date', 'created_date', 'total_amount'], 'order_date');
        // Get pagination parameters
        const { page, limit, offset } = (0, validation_1.sanitizePagination)(req.query.page, req.query.pageSize);
        // Get auto-lock days from settings
        const autoLockDays = await systemSettings_1.SystemSettings.getNumber('auto_lock_days', 3);
        // Check for auto-locking orders before listing
        // Use dynamic interval based on settings
        await connection_1.default.query(`
      UPDATE orders
      SET is_locked = TRUE, locked_date = NOW()
      WHERE customer_status = 'pending'
        AND order_date < NOW() - ($1 || ' days')::INTERVAL
        AND is_locked = FALSE
        AND manually_unlocked = FALSE
    `, [autoLockDays]);
        // Build base query for counting
        let countQuery = `
      SELECT COUNT(*) as total
      FROM orders o
      LEFT JOIN users u ON o.customer_id = u.id
      LEFT JOIN contracts c ON o.contract_id = c.id
    `;
        // Build data query
        let query = `
      SELECT 
        o.*,
        u.full_name as customer_name,
        u.email as customer_email,
        c.contract_number
      FROM orders o
      LEFT JOIN users u ON o.customer_id = u.id
      LEFT JOIN contracts c ON o.contract_id = c.id
    `;
        const params = [];
        let paramCount = 1;
        // Apply role-based filtering
        if (req.user.role === 'user') {
            query += ` WHERE o.customer_id = $${paramCount}`;
            countQuery += ` WHERE o.customer_id = $${paramCount}`;
            params.push(req.user.id);
            paramCount++;
        }
        // Safe sort by (whitelisted)
        if (sortBy.startsWith('-')) {
            const field = sortBy.substring(1);
            query += ` ORDER BY o.${field} DESC`;
        }
        else {
            query += ` ORDER BY o.${sortBy} ASC`;
        }
        // Add pagination
        query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
        params.push(limit, offset);
        // Get total count
        const countResult = await connection_1.default.query(countQuery, params.slice(0, paramCount - 1));
        const total = parseInt(countResult.rows[0].total, 10);
        // Get paginated results
        const result = await connection_1.default.query(query, params);
        // Fetch order items for each order
        const ordersWithItems = await Promise.all(result.rows.map(async (order) => {
            const itemsResult = await connection_1.default.query('SELECT * FROM order_items WHERE order_id = $1', [order.id]);
            return {
                ...order,
                items: itemsResult.rows,
            };
        }));
        res.json({
            data: ordersWithItems,
            pagination: {
                page,
                pageSize: limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    }
    catch (error) {
        console.error('List orders error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.listOrders = listOrders;
const getOrder = async (req, res) => {
    try {
        const { id } = req.params;
        // Validate ID format to prevent injection
        if (!(0, validation_1.isValidUUID)(id)) {
            return res.status(400).json({ error: 'Invalid order ID format' });
        }
        // Get auto-lock days from settings
        const autoLockDays = await systemSettings_1.SystemSettings.getNumber('auto_lock_days', 3);
        // Check for auto-locking this specific order
        await connection_1.default.query(`
      UPDATE orders
      SET is_locked = TRUE, locked_date = NOW()
      WHERE id = $1
        AND customer_status = 'pending'
        AND order_date < NOW() - ($2 || ' days')::INTERVAL
        AND is_locked = FALSE
        AND manually_unlocked = FALSE
    `, [id, autoLockDays]);
        const result = await connection_1.default.query(`SELECT 
        o.*,
        u.full_name as customer_name,
        u.email as customer_email,
        c.contract_number,
        creator.full_name as creator_name
      FROM orders o
      LEFT JOIN users u ON o.customer_id = u.id
      LEFT JOIN contracts c ON o.contract_id = c.id
      LEFT JOIN users creator ON o.created_by = creator.id
      WHERE o.id = $1`, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }
        const order = result.rows[0];
        // Check permissions - IDOR protection
        if (req.user.role === 'user' && order.customer_id !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }
        // Fetch order items
        const itemsResult = await connection_1.default.query('SELECT * FROM order_items WHERE order_id = $1', [id]);
        res.json({
            ...order,
            items: itemsResult.rows,
        });
    }
    catch (error) {
        console.error('Get order error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getOrder = getOrder;
const createOrder = async (req, res) => {
    try {
        const { customer_id, contract_id, order_date, items, total_amount, rebate_percentage } = req.body;
        if (!customer_id || !order_date || !items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Customer ID, order date, and items are required' });
        }
        // Validate customer_id format
        if (!(0, validation_1.isValidUUID)(customer_id)) {
            return res.status(400).json({ error: 'Invalid customer ID format' });
        }
        // Validate contract_id if provided
        if (contract_id && !(0, validation_1.isValidUUID)(contract_id)) {
            return res.status(400).json({ error: 'Invalid contract ID format' });
        }
        // Validate date format
        if (!(0, validation_1.isValidDate)(order_date)) {
            return res.status(400).json({ error: 'Invalid order date format' });
        }
        // Validate items array
        if (items.length > 100) {
            return res.status(400).json({ error: 'Too many items. Maximum 100 items per order' });
        }
        // Validate and sanitize items
        for (const item of items) {
            if (!item.product_name || typeof item.product_name !== 'string') {
                return res.status(400).json({ error: 'Invalid product name' });
            }
            if (typeof item.quantity !== 'number' || item.quantity <= 0 || item.quantity > 10000) {
                return res.status(400).json({ error: 'Invalid quantity. Must be between 1 and 10000' });
            }
            if (typeof item.unit_price !== 'number' || item.unit_price < 0 || item.unit_price > 20000000) {
                return res.status(400).json({ error: 'Invalid unit price. Must be between 0 and 20000000' });
            }
            item.product_name = (0, validation_1.sanitizeString)(item.product_name).substring(0, 200);
        }
        // Validate total_amount if provided
        if (total_amount !== undefined) {
            const sanitizedTotal = (0, validation_1.sanitizeNumber)(total_amount, 0, 20000000);
            if (sanitizedTotal === null) {
                return res.status(400).json({ error: 'Invalid total amount' });
            }
        }
        // Validate rebate_percentage if provided
        if (rebate_percentage !== undefined) {
            const sanitizedRebate = (0, validation_1.sanitizeNumber)(rebate_percentage, 0, 100);
            if (sanitizedRebate === null) {
                return res.status(400).json({ error: 'Invalid rebate percentage. Must be between 0 and 100' });
            }
        }
        // Check permissions - IDOR protection
        if (req.user.role === 'user' && customer_id !== req.user.id) {
            return res.status(403).json({ error: 'You can only create orders for yourself' });
        }
        const client = await connection_1.default.connect();
        try {
            await client.query('BEGIN');
            // Calculate total amount if not provided
            let calculatedTotal = total_amount ? (0, validation_1.sanitizeNumber)(total_amount, 0, 20000000) : 0;
            if (!total_amount) {
                calculatedTotal = items.reduce((sum, item) => {
                    return sum + (item.quantity * item.unit_price);
                }, 0);
            }
            // Calculate rebate amount (default from settings if contract not specified)
            const defaultRebate = await systemSettings_1.SystemSettings.getNumber('default_rebate_percentage', 1.00);
            const rebatePercent = rebate_percentage ? (0, validation_1.sanitizeNumber)(rebate_percentage, 0, 100) : defaultRebate;
            const rebateAmount = calculatedTotal * (rebatePercent / 100);
            const orderNumber = `ORD-${Date.now()}`;
            // Create order
            const orderResult = await client.query(`INSERT INTO orders 
         (customer_id, contract_id, order_number, order_date, total_amount, rebate_amount, customer_status, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`, [
                customer_id,
                contract_id || null,
                orderNumber,
                order_date,
                calculatedTotal,
                rebateAmount,
                'pending',
                req.user.id,
            ]);
            const order = orderResult.rows[0];
            // Create order items (already validated above)
            for (const item of items) {
                const itemTotal = item.quantity * item.unit_price;
                await client.query(`INSERT INTO order_items (order_id, product_name, quantity, unit_price, total_price)
           VALUES ($1, $2, $3, $4, $5)`, [order.id, (0, validation_1.sanitizeString)(item.product_name).substring(0, 200), item.quantity, item.unit_price, itemTotal]);
            }
            await client.query('COMMIT');
            // Fetch order with items
            const itemsResult = await connection_1.default.query('SELECT * FROM order_items WHERE order_id = $1', [order.id]);
            res.status(201).json({
                ...order,
                items: itemsResult.rows,
            });
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.createOrder = createOrder;
const auditService_1 = require("../services/auditService");
const updateOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const { order_date, items, total_amount, customer_status, customer_comment, is_locked } = req.body;
        // Validate ID format
        if (!(0, validation_1.isValidUUID)(id)) {
            return res.status(400).json({ error: 'Invalid order ID format' });
        }
        // Check if order exists and user has permission
        const orderResult = await connection_1.default.query('SELECT customer_id, customer_status, created_by, is_locked FROM orders WHERE id = $1', [id]);
        if (orderResult.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }
        const existingOrder = orderResult.rows[0];
        // Check permissions - IDOR protection
        if (req.user.role === 'user') {
            if (existingOrder.customer_id !== req.user.id) {
                return res.status(403).json({ error: 'Access denied' });
            }
            // Prevent customers from confirming/disputing locked orders
            if (customer_status !== undefined && existingOrder.is_locked === true) {
                return res.status(403).json({ error: 'This order is locked. Please contact support for assistance.' });
            }
            // Users can only update status/comment
            if (order_date !== undefined || items !== undefined || total_amount !== undefined) {
                return res.status(403).json({ error: 'Users can only update status and comments' });
            }
        }
        else {
            const isOwner = existingOrder.created_by === req.user.id;
            const isDisputed = existingOrder.customer_status === 'disputed';
            const isPrivileged = ['admin', 'manager'].includes(req.user.role);
            const canStaffModify = req.user.role === 'staff' && (isOwner || isDisputed);
            if (!(isPrivileged || canStaffModify)) {
                return res.status(403).json({ error: 'Insufficient permissions to modify this order' });
            }
        }
        // Validate inputs
        if (order_date !== undefined && !(0, validation_1.isValidDate)(order_date)) {
            return res.status(400).json({ error: 'Invalid order date format' });
        }
        if (customer_status !== undefined && !(0, validation_1.isValidOrderStatus)(customer_status)) {
            return res.status(400).json({ error: 'Invalid order status' });
        }
        if (customer_comment !== undefined) {
            if (customer_comment !== null && typeof customer_comment !== 'string') {
                return res.status(400).json({ error: 'Comment must be a string or null' });
            }
            if (customer_comment !== null && customer_comment.length > 1000) {
                return res.status(400).json({ error: 'Comment too long. Maximum 1000 characters' });
            }
        }
        if (total_amount !== undefined) {
            const sanitizedTotal = (0, validation_1.sanitizeNumber)(total_amount, 0, 20000000);
            if (sanitizedTotal === null) {
                return res.status(400).json({ error: 'Invalid total amount' });
            }
        }
        if (items !== undefined) {
            if (!Array.isArray(items)) {
                return res.status(400).json({ error: 'Items must be an array' });
            }
            if (items.length > 100) {
                return res.status(400).json({ error: 'Too many items. Maximum 100 items per order' });
            }
            // Validate items
            for (const item of items) {
                if (!item.product_name || typeof item.product_name !== 'string') {
                    return res.status(400).json({ error: 'Invalid product name' });
                }
                if (typeof item.quantity !== 'number' || item.quantity <= 0 || item.quantity > 10000) {
                    return res.status(400).json({ error: 'Invalid quantity' });
                }
                if (typeof item.unit_price !== 'number' || item.unit_price < 0 || item.unit_price > 20000000) {
                    return res.status(400).json({ error: 'Invalid unit price' });
                }
            }
        }
        // Prevent editing confirmed orders (for admins/managers)
        if (existingOrder.customer_status === 'confirmed' &&
            ['admin', 'manager'].includes(req.user.role) &&
            customer_status !== 'confirmed') {
            return res.status(400).json({ error: 'Cannot edit a confirmed order' });
        }
        const client = await connection_1.default.connect();
        try {
            await client.query('BEGIN');
            // Update order - using whitelisted column names to prevent SQL injection
            const updates = [];
            const values = [];
            let paramCount = 1;
            // Whitelist of allowed column names
            const allowedColumns = ['order_date', 'total_amount', 'rebate_amount', 'customer_status', 'customer_comment', 'customer_confirmed_date', 'is_locked', 'locked_date', 'manually_unlocked'];
            if (order_date !== undefined) {
                updates.push(`order_date = $${paramCount++}`);
                values.push(order_date);
            }
            if (total_amount !== undefined) {
                const sanitizedTotal = (0, validation_1.sanitizeNumber)(total_amount, 0, 20000000);
                updates.push(`total_amount = $${paramCount++}`);
                values.push(sanitizedTotal);
                // Recalculate rebate amount (default from settings)
                const defaultRebate = await systemSettings_1.SystemSettings.getNumber('default_rebate_percentage', 1.00);
                updates.push(`rebate_amount = $${paramCount++}`);
                values.push(sanitizedTotal * (defaultRebate / 100));
            }
            if (customer_status !== undefined) {
                updates.push(`customer_status = $${paramCount++}`);
                values.push(customer_status);
                if (customer_status === 'confirmed' && existingOrder.customer_status !== 'confirmed') {
                    updates.push(`customer_confirmed_date = $${paramCount++}`);
                    values.push(new Date().toISOString());
                }
            }
            // Handle locking/unlocking logic
            if (is_locked !== undefined && ['admin', 'manager'].includes(req.user.role)) {
                updates.push(`is_locked = $${paramCount++}`);
                values.push(is_locked);
                if (is_locked === false) {
                    // If unlocking, clear locked_date and set manually_unlocked to prevent auto-relock
                    updates.push(`locked_date = $${paramCount++}`);
                    values.push(null);
                    updates.push(`manually_unlocked = $${paramCount++}`);
                    values.push(true);
                    // Log unlock action
                    await auditService_1.AuditService.log(req.user.id, 'unlock_order', 'order', id, { previous_locked: true }, req.ip);
                }
                else if (is_locked === true) {
                    // If manually locking
                    updates.push(`locked_date = $${paramCount++}`);
                    values.push(new Date().toISOString());
                    // Log lock action
                    await auditService_1.AuditService.log(req.user.id, 'lock_order', 'order', id, { previous_locked: false }, req.ip);
                }
            }
            if (customer_comment !== undefined) {
                const sanitizedComment = (0, validation_1.sanitizeString)(customer_comment).substring(0, 1000);
                updates.push(`customer_comment = $${paramCount++}`);
                values.push(sanitizedComment);
            }
            if (updates.length > 0) {
                values.push(id);
                await client.query(`UPDATE orders SET ${updates.join(', ')} WHERE id = $${paramCount}`, values);
            }
            // Update items if provided
            if (items && Array.isArray(items)) {
                // Delete existing items
                await client.query('DELETE FROM order_items WHERE order_id = $1', [id]);
                // Insert new items (already validated above)
                for (const item of items) {
                    const itemTotal = item.quantity * item.unit_price;
                    await client.query(`INSERT INTO order_items (order_id, product_name, quantity, unit_price, total_price)
             VALUES ($1, $2, $3, $4, $5)`, [id, (0, validation_1.sanitizeString)(item.product_name).substring(0, 200), item.quantity, item.unit_price, itemTotal]);
                }
                // Recalculate total if items changed
                const itemsTotal = items.reduce((sum, item) => {
                    return sum + (item.quantity * item.unit_price);
                }, 0);
                const defaultRebate = await systemSettings_1.SystemSettings.getNumber('default_rebate_percentage', 1.00);
                await client.query('UPDATE orders SET total_amount = $1, rebate_amount = $2 WHERE id = $3', [itemsTotal, itemsTotal * (defaultRebate / 100), id]);
            }
            await client.query('COMMIT');
            // Fetch updated order with items
            const updatedOrder = await client.query(`SELECT * FROM orders WHERE id = $1`, [id]);
            const itemsResult = await client.query('SELECT * FROM order_items WHERE order_id = $1', [id]);
            res.json({
                ...updatedOrder.rows[0],
                items: itemsResult.rows,
            });
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Update order error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.updateOrder = updateOrder;
const deleteOrder = async (req, res) => {
    try {
        const { id } = req.params;
        // Validate ID format
        if (!(0, validation_1.isValidUUID)(id)) {
            return res.status(400).json({ error: 'Invalid order ID format' });
        }
        // Check permissions (only admin can delete)
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Only admins can delete orders' });
        }
        const result = await connection_1.default.query('DELETE FROM orders WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }
        res.json({ message: 'Order deleted successfully' });
    }
    catch (error) {
        console.error('Delete order error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.deleteOrder = deleteOrder;
const filterOrders = async (req, res) => {
    try {
        const { customer_id, customer_status, start_date, end_date, min_amount, max_amount } = req.query;
        const sortBy = (0, validation_1.sanitizeSortBy)(req.query.sortBy, ['order_date', 'created_date', 'total_amount'], 'order_date');
        // Get pagination parameters
        const { page, limit, offset } = (0, validation_1.sanitizePagination)(req.query.page, req.query.pageSize);
        // Get auto-lock days from settings
        const autoLockDays = await systemSettings_1.SystemSettings.getNumber('auto_lock_days', 3);
        // Check for auto-locking orders before filtering
        await connection_1.default.query(`
      UPDATE orders
      SET is_locked = TRUE, locked_date = NOW()
      WHERE customer_status = 'pending'
        AND order_date < NOW() - ($1 || ' days')::INTERVAL
        AND is_locked = FALSE
        AND manually_unlocked = FALSE
    `, [autoLockDays]);
        // Build base query for counting
        let countQuery = `
      SELECT COUNT(*) as total
      FROM orders o
      LEFT JOIN users u ON o.customer_id = u.id
      LEFT JOIN contracts c ON o.contract_id = c.id
      LEFT JOIN users creator ON o.created_by = creator.id
      WHERE 1=1
    `;
        // Build data query
        let query = `
      SELECT 
        o.*,
        u.full_name as customer_name,
        u.email as customer_email,
        c.contract_number,
        creator.full_name as creator_name
      FROM orders o
      LEFT JOIN users u ON o.customer_id = u.id
      LEFT JOIN contracts c ON o.contract_id = c.id
      LEFT JOIN users creator ON o.created_by = creator.id
      WHERE 1=1
    `;
        const params = [];
        let paramCount = 1;
        // Apply role-based filtering - IDOR protection
        if (req.user.role === 'user') {
            query += ` AND o.customer_id = $${paramCount}`;
            countQuery += ` AND o.customer_id = $${paramCount}`;
            params.push(req.user.id);
            paramCount++;
        }
        else if (req.user.role === 'staff') {
            query += ` AND o.created_by = $${paramCount}`;
            countQuery += ` AND o.created_by = $${paramCount}`;
            params.push(req.user.id);
            paramCount++;
        }
        else if (customer_id) {
            // Validate customer_id format for admin/manager/staff
            if (!(0, validation_1.isValidUUID)(customer_id)) {
                return res.status(400).json({ error: 'Invalid customer ID format' });
            }
            query += ` AND o.customer_id = $${paramCount}`;
            countQuery += ` AND o.customer_id = $${paramCount}`;
            params.push(customer_id);
            paramCount++;
        }
        if (customer_status) {
            // Validate status
            if (!(0, validation_1.isValidOrderStatus)(customer_status)) {
                return res.status(400).json({ error: 'Invalid order status' });
            }
            query += ` AND o.customer_status = $${paramCount}`;
            countQuery += ` AND o.customer_status = $${paramCount}`;
            params.push(customer_status);
            paramCount++;
        }
        // Date range filtering
        if (start_date && (0, validation_1.isValidDate)(start_date)) {
            query += ` AND o.order_date >= $${paramCount}`;
            countQuery += ` AND o.order_date >= $${paramCount}`;
            params.push(start_date);
            paramCount++;
        }
        if (end_date && (0, validation_1.isValidDate)(end_date)) {
            query += ` AND o.order_date <= $${paramCount}`;
            countQuery += ` AND o.order_date <= $${paramCount}`;
            params.push(end_date);
            paramCount++;
        }
        // Amount range filtering
        if (min_amount) {
            const minAmount = (0, validation_1.sanitizeNumber)(min_amount, 0);
            if (minAmount !== null) {
                query += ` AND o.total_amount >= $${paramCount}`;
                countQuery += ` AND o.total_amount >= $${paramCount}`;
                params.push(minAmount);
                paramCount++;
            }
        }
        if (max_amount) {
            const maxAmount = (0, validation_1.sanitizeNumber)(max_amount, 0);
            if (maxAmount !== null) {
                query += ` AND o.total_amount <= $${paramCount}`;
                countQuery += ` AND o.total_amount <= $${paramCount}`;
                params.push(maxAmount);
                paramCount++;
            }
        }
        // Safe sort by (whitelisted)
        if (sortBy.startsWith('-')) {
            const field = sortBy.substring(1);
            query += ` ORDER BY o.${field} DESC`;
        }
        else {
            query += ` ORDER BY o.${sortBy} ASC`;
        }
        // Add pagination
        query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
        params.push(limit, offset);
        // Get total count
        const countResult = await connection_1.default.query(countQuery, params.slice(0, paramCount - 1));
        const total = parseInt(countResult.rows[0].total, 10);
        // Get paginated results
        const result = await connection_1.default.query(query, params);
        // Fetch order items for each order
        const ordersWithItems = await Promise.all(result.rows.map(async (order) => {
            const itemsResult = await connection_1.default.query('SELECT * FROM order_items WHERE order_id = $1', [order.id]);
            return {
                ...order,
                items: itemsResult.rows,
            };
        }));
        res.json({
            data: ordersWithItems,
            pagination: {
                page,
                pageSize: limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    }
    catch (error) {
        console.error('Filter orders error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.filterOrders = filterOrders;
