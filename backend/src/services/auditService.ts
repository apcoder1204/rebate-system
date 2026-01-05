import pool from '../db/connection';

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  entity_type: 'order' | 'contract' | 'user' | 'system';
  entity_id?: string;
  details?: any;
  ip_address?: string;
  created_at: string;
}

export const AuditService = {
  async log(
    userId: string,
    action: string,
    entityType: 'order' | 'contract' | 'user' | 'system',
    entityId?: string,
    details?: any,
    ipAddress?: string
  ): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO audit_logs 
         (user_id, action, entity_type, entity_id, details, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, action, entityType, entityId, details ? JSON.stringify(details) : null, ipAddress]
      );
    } catch (error) {
      console.error('Failed to create audit log:', error);
      // Fail silently to not disrupt the main flow
    }
  },

  async getLogs(limit: number = 100, offset: number = 0, entityType?: string): Promise<any[]> {
    let query = `
      SELECT al.*, u.full_name as user_name, u.email as user_email
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
    `;
    
    const params: any[] = [];
    
    if (entityType) {
      query += ` WHERE al.entity_type = $1`;
      params.push(entityType);
    }
    
    query += ` ORDER BY al.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    return result.rows;
  }
};

