const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const LS_KEY = "rebate_user";
const TOKEN_KEY = "rebate_token";

function getToken(): string | null {
  const userData = localStorage.getItem(LS_KEY);
  if (userData) {
    try {
      const user = JSON.parse(userData);
      return user.token || localStorage.getItem(TOKEN_KEY);
    } catch {
      return localStorage.getItem(TOKEN_KEY);
    }
  }
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
  const userData = localStorage.getItem(LS_KEY);
  if (userData) {
    try {
      const user = JSON.parse(userData);
      user.token = token;
      localStorage.setItem(LS_KEY, JSON.stringify(user));
    } catch {
      // Ignore
    }
  }
}

export async function apiRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<any> {
  const token = getToken();
  
  const headers: any = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    ...options.headers,
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  // Add cache-busting for GET requests
  let requestUrl = `${API_BASE_URL}${endpoint}`;
  if (!options.method || options.method === 'GET') {
    const separator = endpoint.includes('?') ? '&' : '?';
    requestUrl = `${requestUrl}${separator}_t=${Date.now()}`;
  }
  
  const response = await fetch(requestUrl, {
    ...options,
    headers,
    cache: 'no-store', // Prevent browser caching
  });
  
  // Handle 401 Unauthorized (token expired/invalid)
  if (response.status === 401) {
    const errorData = await response.json().catch(() => ({}));
    
    // If it's a login attempt (invalid credentials), throw specific error without clearing session yet
    // The login page handles this error specifically
    if (endpoint === '/auth/login' || endpoint.includes('/login')) {
      throw new Error(errorData.error || 'Invalid credentials');
    }

    // For other 401s, it likely means the token expired
    // Clear session
    localStorage.removeItem(LS_KEY);
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.clear();
    
    // Redirect to login if not already there
    if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/register')) {
      window.location.href = '/login';
    }
    
    throw new Error('Session expired. Please login again.');
  }

  if (response.status === 429) {
    const errorData = await response.json().catch(() => ({}));
    // Don't clear session or redirect - just show error message
    throw new Error(errorData.error || errorData.message || 'Too many requests. Please wait a moment and try again.');
  }
  
  if (!response.ok) {
    let error;
    try {
      error = await response.json();
    } catch {
      error = { error: `HTTP error! status: ${response.status}` };
    }
    const errorMessage = error.error || error.message || `HTTP error! status: ${response.status}`;
    throw new Error(errorMessage);
  }
  
  return response.json();
}

export async function apiUpload(
  endpoint: string,
  file: File
): Promise<any> {
  const token = getToken();
  
  const formData = new FormData();
  formData.append('file', file);
  
  const headers: HeadersInit = {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers,
    body: formData,
    cache: 'no-store', // Prevent browser caching
  });
  
  // Handle 401 Unauthorized (token expired/invalid)
  if (response.status === 401) {
    const errorData = await response.json().catch(() => ({}));
    
    // If it's a login attempt (invalid credentials), throw specific error without clearing session yet
    // The login page handles this error specifically
    if (endpoint === '/auth/login' || endpoint.includes('/login')) {
      throw new Error(errorData.error || 'Invalid credentials');
    }

    // For other 401s, it likely means the token expired
    // Clear session
    localStorage.removeItem(LS_KEY);
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.clear();
    
    // Redirect to login if not already there
    if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/register')) {
      window.location.href = '/login';
    }
    
    throw new Error('Session expired. Please login again.');
  }
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(error.error || `HTTP error! status: ${response.status}`);
  }
  
  return response.json();
}

export { setToken, getToken };

