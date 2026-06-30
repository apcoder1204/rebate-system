import { apiRequest } from "@/src/api/client";

export type RebateOrder = {
  id: string;
  order_number: string;
  order_date: string;
  total_amount: number;
  rebate_amount: number;
  rebate_status: 'unpaid' | 'paid';
  customer_status: string;
  rebate_paid_date?: string;
};

export type RebateContractGroup = {
  contract: {
    id: string;
    contract_number: string;
    start_date: string;
    end_date: string;
    status: string;
    rebate_percentage: number;
  };
  orders: RebateOrder[];
  total_rebate_amount: number;
  unpaid_rebate_amount: number;
};

export type RebateCalculation = {
  customer: { id: string; full_name: string; email: string };
  contracts: RebateContractGroup[];
};

export type RebateRequest = {
  id: string;
  customer_id: string;
  contract_id: string;
  status: 'pending' | 'approved' | 'rejected';
  total_rebate_amount: number;
  requested_at: string;
  processed_by?: string;
  processed_at?: string;
  customer_notes?: string;
  staff_notes?: string;
  // joined fields
  customer_name?: string;
  customer_email?: string;
  contract_number?: string;
  contract_status?: string;
  processed_by_name?: string;
};

export type CustomerRebateSearch = {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  contracts: Array<{
    id: string;
    contract_number: string;
    start_date: string;
    end_date: string;
    status: string;
    rebate_percentage: number;
    unpaid_rebate: number;
    paid_rebate: number;
    order_count: number;
    pending_request_id?: string;
  }>;
};

export const Rebate = {
  async getCalculation(customerId: string, contractId?: string): Promise<RebateCalculation> {
    const params = new URLSearchParams({ customer_id: customerId });
    if (contractId) params.append('contract_id', contractId);
    return apiRequest(`/rebates/calculator?${params.toString()}`);
  },

  async pay(orderIds: string[], paymentNotes?: string): Promise<{ message: string; total_paid: number; order_count: number }> {
    return apiRequest('/rebates/pay', {
      method: 'POST',
      body: JSON.stringify({ order_ids: orderIds, payment_notes: paymentNotes }),
    });
  },

  async getSettings(): Promise<{ default_rebate_percentage: string; auto_lock_days: string }> {
    return apiRequest('/rebates/settings');
  },

  // Customer submits rebate redemption request
  async requestRedemption(contractId: string, notes?: string): Promise<RebateRequest> {
    return apiRequest('/rebates/request', {
      method: 'POST',
      body: JSON.stringify({ contract_id: contractId, customer_notes: notes }),
    });
  },

  // Customer checks their own requests
  async getMyRequests(contractId?: string): Promise<RebateRequest[]> {
    const params = contractId ? `?contract_id=${contractId}` : '';
    return apiRequest(`/rebates/my-requests${params}`);
  },

  // Staff — search customers for rebate calculator
  async searchCustomers(query: string): Promise<CustomerRebateSearch[]> {
    return apiRequest(`/rebates/search?q=${encodeURIComponent(query)}`);
  },

  // Staff — list pending requests
  async listRequests(status: 'pending' | 'approved' | 'rejected' = 'pending'): Promise<RebateRequest[]> {
    return apiRequest(`/rebates/requests?status=${status}`);
  },

  // Staff — approve a request
  async approveRequest(requestId: string, staffNotes?: string): Promise<{ message: string }> {
    return apiRequest(`/rebates/requests/${requestId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ staff_notes: staffNotes }),
    });
  },

  // Staff — reject a request
  async rejectRequest(requestId: string, staffNotes?: string): Promise<{ message: string }> {
    return apiRequest(`/rebates/requests/${requestId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ staff_notes: staffNotes }),
    });
  },
};

export default Rebate;
