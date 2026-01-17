import pool from '../db/connection';
import { sendOrderReminderEmail } from './emailService';

/**
 * Send reminder emails to customers with pending orders
 * Orders must be at least 7 days old and haven't received a reminder in the last 7 days
 */
export async function sendOrderReminders(): Promise<{
  success: boolean;
  emailsSent: number;
  errors: number;
  message: string;
}> {
  try {
    console.log('Starting order reminder job...');

    // Find pending orders that:
    // 1. Are at least 7 days old
    // 2. Haven't been sent a reminder in the last 7 days (or never sent)
    // 3. Are not locked
    const query = `
      SELECT 
        o.id,
        o.order_number,
        o.order_date,
        o.total_amount,
        o.rebate_amount,
        o.last_reminder_sent,
        u.email,
        u.full_name,
        u.is_active
      FROM orders o
      INNER JOIN users u ON o.customer_id = u.id
      WHERE o.customer_status = 'pending'
        AND o.order_date <= CURRENT_DATE - INTERVAL '7 days'
        AND o.is_locked = FALSE
        AND u.is_active = TRUE
        AND u.email IS NOT NULL
        AND (
          o.last_reminder_sent IS NULL 
          OR o.last_reminder_sent <= CURRENT_TIMESTAMP - INTERVAL '7 days'
        )
      ORDER BY o.order_date ASC
    `;

    const result = await pool.query(query);
    const orders = result.rows;

    if (orders.length === 0) {
      console.log('No orders require reminders at this time.');
      return {
        success: true,
        emailsSent: 0,
        errors: 0,
        message: 'No orders require reminders at this time.',
      };
    }

    console.log(`Found ${orders.length} orders requiring reminders.`);

    let emailsSent = 0;
    let errors = 0;
    const errorsList: string[] = [];

    // Process each order
    for (const order of orders) {
      try {
        const emailResult = await sendOrderReminderEmail(
          order.email,
          order.full_name || 'Valued Customer',
          order.order_number,
          order.order_date,
          parseFloat(String(order.total_amount || 0)),
          parseFloat(String(order.rebate_amount || 0))
        );

        if (emailResult.success) {
          // Update last_reminder_sent timestamp
          await pool.query(
            'UPDATE orders SET last_reminder_sent = CURRENT_TIMESTAMP WHERE id = $1',
            [order.id]
          );
          emailsSent++;
          console.log(`✅ Reminder sent for order ${order.order_number} to ${order.email}`);
        } else {
          errors++;
          errorsList.push(`Order ${order.order_number}: ${emailResult.message}`);
          console.error(`❌ Failed to send reminder for order ${order.order_number}: ${emailResult.message}`);
        }
      } catch (error: any) {
        errors++;
        errorsList.push(`Order ${order.order_number}: ${error.message}`);
        console.error(`❌ Error processing order ${order.order_number}:`, error);
      }
    }

    const message = `Order reminder job completed. Sent ${emailsSent} reminders, ${errors} errors.`;
    console.log(message);
    if (errorsList.length > 0) {
      console.log('Errors:', errorsList);
    }

    return {
      success: errors === 0,
      emailsSent,
      errors,
      message,
    };
  } catch (error: any) {
    console.error('Error in order reminder job:', error);
    return {
      success: false,
      emailsSent: 0,
      errors: 1,
      message: `Order reminder job failed: ${error.message}`,
    };
  }
}
