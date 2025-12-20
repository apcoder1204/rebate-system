import { apiRequest } from "@/src/api/client";

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
  created_date?: string;
  updated_date?: string;
  is_locked?: boolean;
  locked_date?: string;
};

export const Order = {
  async list(sortBy?: string): Promise<OrderType[]> {
    const query = sortBy ? `?sortBy=${sortBy}` : '';
    return apiRequest(`/orders${query}`);
  },
  async filter(filters: Partial<OrderType>, sortBy?: string): Promise<OrderType[]> {
    const params = new URLSearchParams();
    if (filters.customer_id) params.append('customer_id', filters.customer_id);
    if (filters.customer_status) params.append('customer_status', filters.customer_status);
    if (sortBy) params.append('sortBy', sortBy);
    
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
};

export default Order;

