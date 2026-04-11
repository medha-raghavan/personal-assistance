import api from './api';
import { Section, ApiResponse } from '../types';

export const sectionService = {
  async getAll(): Promise<Section[]> {
    const response = await api.get<ApiResponse<Section[]>>('/sections');
    return response.data.data;
  },

  async create(data: Partial<Section>): Promise<Section> {
    const response = await api.post<ApiResponse<Section>>('/sections', data);
    return response.data.data;
  },

  async update(id: string, data: Partial<Section>): Promise<Section> {
    const response = await api.put<ApiResponse<Section>>(`/sections/${id}`, data);
    return response.data.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/sections/${id}`);
  },

  async getBalance(id: string): Promise<{
    section: string;
    storedBalance: number;
    calculatedBalance: number;
    totalCredit: number;
    totalDebit: number;
    transactionCount: number;
  }> {
    const response = await api.get(`/sections/${id}/balance`);
    return response.data.data;
  },
};
