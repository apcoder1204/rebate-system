import { apiUpload } from "@/src/api/client";

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export async function UploadFile(file: File): Promise<{ url: string }> {
  const result = await apiUpload('/upload/contract', file);
  
  // Return full URL for the file
  return {
    url: `${API_BASE_URL}${result.url}`,
  };
}


