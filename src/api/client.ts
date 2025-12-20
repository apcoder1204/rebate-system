const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Debug: Log API URL in development
if (import.meta.env.DEV) {
  console.log('🔗 API Base URL:', API_BASE_URL);
  console.log('🔗 VITE_API_URL env:', import.meta.env.VITE_API_URL || 'NOT SET');
}

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
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const fullUrl = `${API_BASE_URL}${endpoint}`;
  
  // Validate URL before making request
  try {
    new URL(fullUrl);
  } catch (error) {
    console.error('❌ Invalid API URL:', fullUrl);
    console.error('❌ Please set VITE_API_URL in your .env file');
    throw new Error(`Invalid API URL: ${fullUrl}. Please configure VITE_API_URL environment variable.`);
  }
  
  const response = await fetch(fullUrl, {
    ...options,
    headers,
    credentials: 'include', // Include credentials for CORS
  });
  
  // Handle 401 Unauthorized (token expired/invalid)
  if (response.status === 401) {
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
    // Handle network errors
    if (response.status === 0 || response.type === 'error') {
      console.error('❌ Network Error - Could not reach API');
      console.error('❌ API URL:', fullUrl);
      console.error('❌ Check if VITE_API_URL is correct and backend is running');
      throw new Error(`Cannot connect to API at ${API_BASE_URL}. Please check your backend server and VITE_API_URL configuration.`);
    }
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP error! status: ${response.status}`);
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
  
  const headers: HeadersInit = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers,
    body: formData,
    credentials: 'include', // Include credentials for CORS
  });
  
  // Handle 401 Unauthorized (token expired/invalid)
  if (response.status === 401) {
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

