import api from './api';
import {
  DashboardOverview,
  TrendData,
  CategoryBreakdown,
  DashboardSummary,
  DashboardSummaryFilters,
  ApiResponse,
} from '../types';

export const dashboardService = {
  async getOverview(): Promise<DashboardOverview> {
    const response = await api.get<ApiResponse<DashboardOverview>>('/dashboard/overview');
    return response.data.data;
  },

  async getTrends(months: number = 6): Promise<TrendData[]> {
    const response = await api.get<ApiResponse<TrendData[]>>(`/dashboard/trends?months=${months}`);
    return response.data.data;
  },

  async getCategoryBreakdown(startDate?: string, endDate?: string): Promise<CategoryBreakdown> {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    
    const response = await api.get<ApiResponse<CategoryBreakdown>>(
      `/dashboard/category-breakdown?${params.toString()}`
    );
    return response.data.data;
  },

  async getCalendarHeatmap(year?: number): Promise<{
    year: number;
    days: Array<{
      date: string;
      expense: number;
      income: number;
      count: number;
      intensity: number;
    }>;
    maxExpense: number;
  }> {
    const params = year ? `?year=${year}` : '';
    const response = await api.get(`/dashboard/calendar-heatmap${params}`);
    return response.data.data;
  },

  async getSummary(filters: DashboardSummaryFilters): Promise<DashboardSummary> {
    const params = new URLSearchParams();
    params.set('period', filters.period);
    if (filters.sectionId) params.set('sectionId', filters.sectionId);
    if (filters.type && filters.type !== 'all') params.set('type', filters.type);
    if (filters.categoryIds && filters.categoryIds.length > 0) {
      params.set('categoryIds', filters.categoryIds.join(','));
    }
    if (filters.period === 'custom') {
      if (filters.startDate) params.set('startDate', filters.startDate);
      if (filters.endDate) params.set('endDate', filters.endDate);
    }

    const response = await api.get<ApiResponse<DashboardSummary>>(
      `/dashboard/summary?${params.toString()}`
    );
    return response.data.data;
  },
};
