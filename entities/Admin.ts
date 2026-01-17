import { apiRequest } from "@/src/api/client";

export type SystemSetting = {
  id: string;
  key: string;
  value: string;
  description: string;
  updated_at: string;
};

export type AuditLog = {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: any;
  ip_address: string;
  created_at: string;
};

export const Admin = {
  async getSettings(): Promise<SystemSetting[]> {
    return apiRequest('/admin/settings');
  },

  async getSetting(key: string): Promise<string | null> {
    const settings = await this.getSettings();
    const setting = settings.find(s => s.key === key);
    return setting ? setting.value : null;
  },

  async updateSetting(key: string, value: string): Promise<SystemSetting> {
    return apiRequest('/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({ key, value }),
    });
  },

  async getLogs(limit: number = 50, offset: number = 0, entityType?: string): Promise<AuditLog[]> {
    const params = new URLSearchParams();
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());
    if (entityType) params.append('entity_type', entityType);
    
    return apiRequest(`/admin/logs?${params.toString()}`);
  },

  async toggleUserActive(userId: string, isActive: boolean): Promise<any> {
    return apiRequest(`/admin/users/${userId}/active`, {
      method: 'PUT',
      body: JSON.stringify({ is_active: isActive }),
    });
  }
};

