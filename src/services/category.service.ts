import api from './api';
import { Category, ApiResponse } from '../types';

export const categoryService = {
  async getAll(): Promise<Category[]> {
    const response = await api.get<ApiResponse<Category[]>>('/categories');
    return response.data.data;
  },

  async create(data: {
    name: string;
    icon?: string;
    color?: string;
    keywords?: string[];
  }): Promise<Category> {
    const response = await api.post<ApiResponse<Category>>('/categories', data);
    return response.data.data;
  },

  async update(id: string, data: Partial<Category>): Promise<Category> {
    const response = await api.put<ApiResponse<Category>>(`/categories/${id}`, data);
    return response.data.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/categories/${id}`);
  },

  async addKeyword(id: string, keyword: string): Promise<Category> {
    const response = await api.post<ApiResponse<Category>>(`/categories/${id}/keywords`, { keyword });
    return response.data.data;
  },

  async removeKeyword(id: string, keyword: string): Promise<Category> {
    const response = await api.delete<ApiResponse<Category>>(`/categories/${id}/keywords`, {
      data: { keyword },
    });
    return response.data.data;
  },

  async matchCategory(description: string): Promise<{
    categoryId: string | null;
    categoryName: string;
    matchedKeyword: string | null;
  }> {
    const response = await api.post('/categories/match', { description });
    return response.data.data;
  },
};
