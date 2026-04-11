import api from './api';
import { Transaction, ApiResponse, PaginatedResponse } from '../types';

export interface TransactionFilters {
  sectionId?: string;
  categoryId?: string;
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
  type?: 'credit' | 'debit' | 'all';
  tags?: string[];
  keyword?: string;
  tripId?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const transactionService = {
  async getAll(filters: TransactionFilters = {}): Promise<PaginatedResponse<Transaction>> {
    const params = new URLSearchParams();
    
    if (filters.sectionId) params.set('sectionId', filters.sectionId);
    if (filters.categoryId) params.set('categoryId', filters.categoryId);
    if (filters.startDate) params.set('startDate', filters.startDate);
    if (filters.endDate) params.set('endDate', filters.endDate);
    if (filters.minAmount) params.set('minAmount', filters.minAmount.toString());
    if (filters.maxAmount) params.set('maxAmount', filters.maxAmount.toString());
    if (filters.type && filters.type !== 'all') params.set('type', filters.type);
    if (filters.tags?.length) params.set('tags', filters.tags.join(','));
    if (filters.keyword) params.set('keyword', filters.keyword);
    if (filters.tripId) params.set('tripId', filters.tripId);
    if (filters.page) params.set('page', filters.page.toString());
    if (filters.limit) params.set('limit', filters.limit.toString());
    if (filters.sortBy) params.set('sortBy', filters.sortBy);
    if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);
    
    const response = await api.get<ApiResponse<PaginatedResponse<Transaction>>>(
      `/transactions?${params.toString()}`
    );
    return response.data.data;
  },

  async create(data: {
    sectionId: string;
    transactionDate: string;
    amount: number;
    type: 'credit' | 'debit';
    description: string;
    tags?: string[];
    categoryId?: string;
    tripId?: string;
  }): Promise<Transaction> {
    const response = await api.post<ApiResponse<Transaction>>('/transactions', data);
    return response.data.data;
  },

  async update(id: string, data: Partial<Transaction>): Promise<Transaction> {
    const response = await api.put<ApiResponse<Transaction>>(`/transactions/${id}`, data);
    return response.data.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/transactions/${id}`);
  },

  async bulkUpdateTags(
    transactionIds: string[],
    tags: string[],
    action: 'add' | 'remove' | 'replace'
  ): Promise<{ modifiedCount: number }> {
    const response = await api.put<ApiResponse<{ modifiedCount: number }>>(
      '/transactions/bulk/tags',
      { transactionIds, tags, action }
    );
    return response.data.data;
  },

  async bulkUpdate(
    transactionIds: string[],
    updates: {
      transactionDate?: string;
      categoryId?: string | null;
      tags?: string[];
      tagAction?: 'add' | 'remove' | 'replace';
    }
  ): Promise<{ modifiedCount: number }> {
    const response = await api.put<ApiResponse<{ modifiedCount: number }>>(
      '/transactions/bulk/update',
      { transactionIds, updates }
    );
    return response.data.data;
  },

  async getCalendarData(year: number, month: number): Promise<{
    year: number;
    month: number;
    days: Array<{
      day: number;
      credit: number;
      debit: number;
      net: number;
      count: number;
    }>;
  }> {
    const response = await api.get(`/transactions/calendar/${year}/${month}`);
    return response.data.data;
  },

  async getSummary(params: {
    startDate?: string;
    endDate?: string;
    groupBy?: 'day' | 'week' | 'month' | 'year';
  }): Promise<Array<{
    period: string;
    credit: number;
    debit: number;
    net: number;
    count: number;
  }>> {
    const queryParams = new URLSearchParams();
    if (params.startDate) queryParams.set('startDate', params.startDate);
    if (params.endDate) queryParams.set('endDate', params.endDate);
    if (params.groupBy) queryParams.set('groupBy', params.groupBy);
    
    const response = await api.get(`/transactions/summary?${queryParams.toString()}`);
    return response.data.data;
  },
};
