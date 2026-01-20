import { apiRequest, setToken } from "@/src/api/client";
import { PaginatedResponse } from "./Order";

export type UserType = {
  id: string;
  email: string;
  full_name: string;
  role?: string;
  phone?: string;
  created_date?: string;
  updated_date?: string;
  is_active?: boolean;
};

const LS_KEY = "rebate_user";

export const User = {
  async me(): Promise<UserType> {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) throw new Error("not-auth");
    
    // Try to refresh from API
    try {
      const user = await apiRequest('/users/me');
      const userData = {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        phone: user.phone,
        created_date: user.created_date,
      };
      localStorage.setItem(LS_KEY, JSON.stringify(userData));
      return userData;
    } catch (error) {
      // If API fails, return cached user
      return JSON.parse(raw);
    }
  },
  async list(filters?: { role?: string; is_active?: boolean; search?: string }, page?: number, pageSize?: number): Promise<PaginatedResponse<UserType>> {
    const params = new URLSearchParams();
    if (filters?.role) params.append('role', filters.role);
    if (filters?.is_active !== undefined) params.append('is_active', String(filters.is_active));
    if (filters?.search) params.append('search', filters.search);
    if (page !== undefined) params.append('page', String(page));
    if (pageSize !== undefined) params.append('pageSize', String(pageSize));
    
    const query = params.toString();
    const response = await apiRequest(`/users/list${query ? `?${query}` : ''}`);
    
    // Validate response structure
    if (!response) {
      throw new Error('No response received from server');
    }
    
    // Ensure response has the expected structure - handle both array and object responses
    if (Array.isArray(response)) {
      // If backend returns array directly, wrap it
      return {
        data: response,
        pagination: {
          page: page || 1,
          pageSize: pageSize || 20,
          total: response.length,
          totalPages: 1
        }
      };
    }
    
    if (!response.data || !Array.isArray(response.data)) {
      console.error('Invalid response structure:', response);
      return {
        data: [],
        pagination: {
          page: page || 1,
          pageSize: pageSize || 20,
          total: 0,
          totalPages: 0
        }
      };
    }
    
    // Ensure pagination object exists
    if (!response.pagination) {
      console.warn('Missing pagination in response, using defaults');
      return {
        data: response.data,
        pagination: {
          page: page || 1,
          pageSize: pageSize || 20,
          total: response.data.length,
          totalPages: 1
        }
      };
    }
    
    return response;
  },
  async login(email: string, password: string) {
    const response = await apiRequest('/users/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    
    // Validate response structure
    if (!response) {
      throw new Error('Invalid response from server');
    }
    
    if (!response.token) {
      throw new Error('No authentication token received');
    }
    
    if (!response.user) {
      throw new Error('No user data received');
    }
    
    // Validate required user fields
    if (!response.user.id || !response.user.email || !response.user.full_name) {
      throw new Error('Incomplete user data received');
    }
    
    setToken(response.token);
    
    const userData: UserType = {
      id: response.user.id,
      email: response.user.email,
      full_name: response.user.full_name,
      role: response.user.role || undefined,
      phone: response.user.phone || undefined,
      created_date: response.user.created_date || undefined,
    };
    
    localStorage.setItem(LS_KEY, JSON.stringify(userData));
    
    // Store login timestamp for session management
    sessionStorage.setItem('login_timestamp', Date.now().toString());
    
    return userData;
  },
  async updateProfile(payload: { full_name?: string; phone?: string }) {
    const response = await apiRequest('/users/me', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });

    const user = response.user || response;
    const userData: UserType = {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      phone: user.phone,
      created_date: user.created_date,
      updated_date: user.updated_date,
    };

    localStorage.setItem(LS_KEY, JSON.stringify(userData));
    return { ...userData, message: response.message };
  },
  async changePassword(current_password: string, new_password: string) {
    return apiRequest('/users/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password, new_password }),
    });
  },
  async register(email: string, password: string, full_name: string, phone: string, requested_role?: string, verification_code?: string) {
    const response = await apiRequest('/users/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, full_name, phone, requested_role, verification_code }),
    });
    
    // Do not set token or login automatically
    
    return { role_requested: response.role_requested, message: response.message };
  },
  // Phone-based verification (legacy - Twilio)
  async sendVerificationCode(phone: string, purpose: 'registration' | 'password_reset') {
    return apiRequest('/users/send-verification-code', {
      method: 'POST',
      body: JSON.stringify({ phone, purpose }),
    });
  },
  async verifyCode(phone: string, code: string, purpose: 'registration' | 'password_reset') {
    return apiRequest('/users/verify-code', {
      method: 'POST',
      body: JSON.stringify({ phone, code, purpose }),
    });
  },
  async resetPassword(phone: string, verification_code: string, new_password: string) {
    return apiRequest('/users/reset-password', {
      method: 'POST',
      body: JSON.stringify({ phone, verification_code, new_password }),
    });
  },
  // Email-based verification (Resend)
  async sendEmailVerificationCode(email: string, purpose: 'registration' | 'password_reset') {
    return apiRequest('/users/send-email-code', {
      method: 'POST',
      body: JSON.stringify({ email, purpose }),
    });
  },
  async verifyEmailCode(email: string, code: string, purpose: 'registration' | 'password_reset') {
    return apiRequest('/users/verify-email-code', {
      method: 'POST',
      body: JSON.stringify({ email, code, purpose }),
    });
  },
  async resetPasswordByEmail(email: string, verification_code: string, new_password: string) {
    return apiRequest('/users/reset-password-email', {
      method: 'POST',
      body: JSON.stringify({ email, verification_code, new_password }),
    });
  },
  async logout() {
    localStorage.removeItem(LS_KEY);
    localStorage.removeItem("rebate_token");
    sessionStorage.clear();
    // Clear any other session-related data
    window.history.replaceState(null, "", "/login");
  },
  // Role management methods
  async getRoleRequests(status: string = 'pending') {
    return apiRequest(`/users/role-requests?status=${status}`);
  },
  async reviewRoleRequest(requestId: string, action: 'approve' | 'reject', comment?: string) {
    return apiRequest(`/users/role-requests/${requestId}/review`, {
      method: 'POST',
      body: JSON.stringify({ action, comment }),
    });
  },
  async getMyRoleRequest() {
    return apiRequest('/users/my-role-request');
  },
  async updateUserRole(userId: string, role: string) {
    return apiRequest(`/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    });
  },
  async delete(userId: string) {
    return apiRequest(`/users/${userId}`, {
      method: 'DELETE',
    });
  },
};

export default User;

