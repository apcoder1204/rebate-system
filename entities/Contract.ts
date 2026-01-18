import { apiRequest, getToken } from "@/src/api/client";
import { PaginatedResponse } from "./Order";

export type ContractType = {
  id: string;
  customer_id: string;
  created_by?: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  start_date?: string;
  end_date?: string;
  status?: "pending" | "pending_approval" | "approved" | "active" | "expired" | "cancelled" | "rejected";
  contract_number?: string;
  rebate_percentage?: number;
  signed_contract_url?: string;
  customer_signature_data_url?: string;
  manager_signature_data_url?: string;
  manager_name?: string;
  manager_position?: string;
  approved_by?: string;
  approved_date?: string;
  creator_name?: string;
  approver_name?: string;
  created_date?: string;
  updated_date?: string;
};

export type ContractFilters = {
  customer_id?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
  min_rebate?: number;
  max_rebate?: number;
};

export const Contract = {
  async list(sortBy?: string, options?: { includeAll?: boolean }, page?: number, pageSize?: number): Promise<PaginatedResponse<ContractType>> {
    const params = new URLSearchParams();
    if (sortBy) params.append('sortBy', sortBy);
    if (options?.includeAll) params.append('include_all', 'true');
    if (page) params.append('page', String(page));
    if (pageSize) params.append('pageSize', String(pageSize));
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiRequest(`/contracts${query}`);
  },
  async create(data: Partial<ContractType>): Promise<ContractType> {
    return apiRequest('/contracts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async filter(filters: ContractFilters, sortBy?: string, page?: number, pageSize?: number): Promise<PaginatedResponse<ContractType>> {
    const params = new URLSearchParams();
    if (filters.customer_id) params.append('customer_id', filters.customer_id);
    if (filters.status) params.append('status', filters.status);
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    if (filters.min_rebate !== undefined) params.append('min_rebate', String(filters.min_rebate));
    if (filters.max_rebate !== undefined) params.append('max_rebate', String(filters.max_rebate));
    if (sortBy) params.append('sortBy', sortBy);
    if (page) params.append('page', String(page));
    if (pageSize) params.append('pageSize', String(pageSize));
    
    return apiRequest(`/contracts/filter?${params.toString()}`);
  },
  async update(id: string, data: Partial<ContractType>): Promise<ContractType> {
    return apiRequest(`/contracts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  async delete(id: string): Promise<void> {
    await apiRequest(`/contracts/${id}`, {
      method: 'DELETE',
    });
  },
  async exportCSV(filters?: ContractFilters): Promise<Blob> {
    const params = new URLSearchParams();
    if (filters?.customer_id) params.append('customer_id', filters.customer_id);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.start_date) params.append('start_date', filters.start_date);
    if (filters?.end_date) params.append('end_date', filters.end_date);
    
    const token = getToken();
    if (!token) {
      throw new Error('No authentication token found. Please login again.');
    }
    
    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
    
    const headers: HeadersInit = {
      'Authorization': `Bearer ${token}`,
    };
    
    const response = await fetch(`${API_BASE_URL}/contracts/export/csv?${params.toString()}`, {
      headers,
      credentials: 'include',
    });
    
    if (response.status === 401) {
      throw new Error('Session expired. Please login again.');
    }
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Export failed' }));
      throw new Error(error.error || 'Export failed');
    }
    
    return response.blob();
  },
};

export default Contract;

