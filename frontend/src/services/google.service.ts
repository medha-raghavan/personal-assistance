import api from './api';
import { ApiResponse, GoogleConnectionStatus, GoogleContact } from '../types';

export const googleService = {
  async getStatus(): Promise<GoogleConnectionStatus> {
    const response = await api.get<ApiResponse<GoogleConnectionStatus>>('/google/status');
    return response.data.data;
  },

  async getAuthUrl(returnTo = '/whatsapp'): Promise<string> {
    const response = await api.get<ApiResponse<{ url: string }>>('/google/auth-url', {
      params: { returnTo },
    });
    return response.data.data.url;
  },

  async disconnect(): Promise<GoogleConnectionStatus> {
    const response = await api.post<ApiResponse<GoogleConnectionStatus>>('/google/disconnect');
    return response.data.data;
  },

  async getContacts(q?: string): Promise<GoogleContact[]> {
    const response = await api.get<ApiResponse<GoogleContact[]>>('/google/contacts', {
      params: q ? { q } : undefined,
    });
    return response.data.data;
  },
};
