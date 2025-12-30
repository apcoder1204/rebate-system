import { apiRequest } from "@/src/api/client";

export type ContractType = {
  id: string;
  customer_id: string;
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
  created_date?: string;
  updated_date?: string;
};

export const Contract = {
  async list(sortBy?: string, options?: { includeAll?: boolean }): Promise<ContractType[]> {
    const params = new URLSearchParams();
    if (sortBy) params.append('sortBy', sortBy);
    if (options?.includeAll) params.append('include_all', 'true');
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiRequest(`/contracts${query}`);
  },
  async create(data: Partial<ContractType>): Promise<ContractType> {
    return apiRequest('/contracts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async filter(filters: Partial<ContractType>, sortBy?: string): Promise<ContractType[]> {
    const params = new URLSearchParams();
    if (filters.customer_id) params.append('customer_id', filters.customer_id);
    if (filters.status) params.append('status', filters.status);
    if (sortBy) params.append('sortBy', sortBy);
    
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
};

export default Contract;

