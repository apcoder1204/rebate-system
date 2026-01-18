import { apiRequest, getToken } from "@/src/api/client";

export type OrderItem = {
  id?: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
};

export type OrderType = {
  id: string;
  customer_id: string;
  created_by?: string;
  contract_id?: string;
  order_number: string;
  order_date: string;
  items: OrderItem[];
  total_amount: number;
  rebate_amount: number;
  customer_status: "pending" | "confirmed" | "disputed";
  customer_comment?: string | null;
  customer_confirmed_date?: string;
  customer_name?: string;
  customer_email?: string;
  contract_number?: string;
  creator_name?: string;
  created_date?: string;
  updated_date?: string;
  is_locked?: boolean;
  locked_date?: string;
  manually_unlocked?: boolean;
};

export type PaginatedResponse<T> = {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type OrderFilters = {
  customer_id?: string;
  customer_status?: string;
  start_date?: string;
  end_date?: string;
  min_amount?: number;
  max_amount?: number;
};

export const Order = {
  async list(sortBy?: string, page?: number, pageSize?: number): Promise<PaginatedResponse<OrderType>> {
    const params = new URLSearchParams();
    if (sortBy) params.append('sortBy', sortBy);
    if (page) params.append('page', String(page));
    if (pageSize) params.append('pageSize', String(pageSize));
    
    const query = params.toString();
    return apiRequest(`/orders${query ? `?${query}` : ''}`);
  },
  async filter(filters: OrderFilters, sortBy?: string, page?: number, pageSize?: number): Promise<PaginatedResponse<OrderType>> {
    const params = new URLSearchParams();
    if (filters.customer_id) params.append('customer_id', filters.customer_id);
    if (filters.customer_status) params.append('customer_status', filters.customer_status);
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    if (filters.min_amount !== undefined) params.append('min_amount', String(filters.min_amount));
    if (filters.max_amount !== undefined) params.append('max_amount', String(filters.max_amount));
    if (sortBy) params.append('sortBy', sortBy);
    if (page) params.append('page', String(page));
    if (pageSize) params.append('pageSize', String(pageSize));
    
    return apiRequest(`/orders/filter?${params.toString()}`);
  },
  async create(data: Partial<OrderType>): Promise<OrderType> {
    return apiRequest('/orders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async update(id: string, data: Partial<OrderType>): Promise<OrderType> {
    return apiRequest(`/orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  async delete(id: string): Promise<void> {
    await apiRequest(`/orders/${id}`, {
      method: 'DELETE',
    });
  },
  async exportCSV(filters?: OrderFilters): Promise<Blob> {
    const params = new URLSearchParams();
    if (filters?.customer_id) params.append('customer_id', filters.customer_id);
    if (filters?.customer_status) params.append('customer_status', filters.customer_status);
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
    
    const response = await fetch(`${API_BASE_URL}/orders/export/csv?${params.toString()}`, {
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

export default Order;

