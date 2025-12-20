import { apiUpload } from "@/src/api/client";

// Extract base URL without /api suffix for file URLs
const getBaseUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
  // Remove /api if present
  return apiUrl.replace(/\/api\/?$/, '') || 'http://localhost:3000';
};

const API_BASE_URL = getBaseUrl();

export async function UploadFile(file: File): Promise<{ url: string }> {
  const result = await apiUpload('/upload/contract', file);
  
  // Return full URL for the file
  return {
    url: `${API_BASE_URL}${result.url}`,
  };
}


