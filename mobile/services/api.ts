import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://officelaptop.tail38a9a8.ts.net:3001/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

// Auth Service
export const authService = {
  async login(email: string, password: string) {
    const response = await api.post('/auth/login', { email, password });
    return response.data.data;
  },

  async register(email: string, password: string, name: string) {
    const response = await api.post('/auth/register', { email, password, name });
    return response.data.data;
  },
};

// Dashboard Service
export const dashboardService = {
  async getOverview() {
    const response = await api.get('/dashboard/overview');
    return response.data.data;
  },

  async getTrends(months: number = 6) {
    const response = await api.get(`/dashboard/trends?months=${months}`);
    return response.data.data;
  },

  async getCategoryBreakdown() {
    const response = await api.get('/dashboard/category-breakdown');
    return response.data.data;
  },
};

// Section Service
export const sectionService = {
  async getAll() {
    const response = await api.get('/sections');
    return response.data.data;
  },

  async create(data: {
    name: string;
    label?: string;
    type: string;
    balance?: number;
    uploadEnabled?: boolean;
    parserConfig?: { type: string };
  }) {
    const response = await api.post('/sections', data);
    return response.data.data;
  },

  async update(id: string, data: Partial<{
    name: string;
    label: string;
    type: string;
    balance: number;
    uploadEnabled: boolean;
    parserConfig: { type: string };
  }>) {
    const response = await api.put(`/sections/${id}`, data);
    return response.data.data;
  },

  async delete(id: string) {
    const response = await api.delete(`/sections/${id}`);
    return response.data.data;
  },
};

// Category Service
export const categoryService = {
  async getAll() {
    const response = await api.get('/categories');
    return response.data.data;
  },

  async create(data: { name: string; color?: string }) {
    const response = await api.post('/categories', data);
    return response.data.data;
  },

  async update(id: string, data: { name?: string; color?: string }) {
    const response = await api.put(`/categories/${id}`, data);
    return response.data.data;
  },

  async delete(id: string) {
    const response = await api.delete(`/categories/${id}`);
    return response.data.data;
  },

  async addKeyword(id: string, keyword: string) {
    const response = await api.post(`/categories/${id}/keywords`, { keyword });
    return response.data.data;
  },

  async removeKeyword(id: string, keyword: string) {
    const response = await api.delete(`/categories/${id}/keywords/${encodeURIComponent(keyword)}`);
    return response.data.data;
  },
};

// Transaction Service
export interface TransactionFilters {
  search?: string;
  sectionId?: string;
  categoryId?: string;
  type?: 'credit' | 'debit';
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
  tags?: string[];
  tripId?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const transactionService = {
  async getAll(filters: TransactionFilters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        if (key === 'tags' && Array.isArray(value)) {
          value.forEach((tag: string) => params.append('tags', tag));
        } else {
          params.append(key, String(value));
        }
      }
    });
    const response = await api.get(`/transactions?${params.toString()}`);
    return response.data.data;
  },

  async getRecent(limit: number = 10) {
    const response = await api.get(`/transactions?limit=${limit}&sortBy=transactionDate&sortOrder=desc`);
    return response.data.data;
  },

  async getById(id: string) {
    const response = await api.get(`/transactions/${id}`);
    return response.data.data;
  },

  async create(data: {
    sectionId: string;
    transactionDate: string;
    amount: number;
    type: 'credit' | 'debit';
    description: string;
    categoryId?: string;
    tags?: string[];
  }) {
    const response = await api.post('/transactions', data);
    return response.data.data;
  },

  async update(id: string, data: Partial<{
    transactionDate: string;
    amount: number;
    type: 'credit' | 'debit';
    description: string;
    categoryId: string | null;
    tags: string[];
    sectionId: string;
    tripId: string | null;
    tripSplits: { memberId: string; memberName: string; amount: number }[];
    paidByMemberId: string | null;
    paidByMemberName: string | null;
  }>) {
    const response = await api.put(`/transactions/${id}`, data);
    return response.data.data;
  },

  async delete(id: string) {
    const response = await api.delete(`/transactions/${id}`);
    return response.data.data;
  },

  async bulkUpdate(ids: string[], updates: {
    date?: string;
    categoryId?: string | null;
    tagsAction?: 'add' | 'remove' | 'replace';
    tags?: string[];
  }) {
    const response = await api.put('/transactions/bulk/update', { ids, ...updates });
    return response.data.data;
  },

  async bulkDelete(ids: string[]) {
    const response = await api.delete('/transactions/bulk/delete', { data: { ids } });
    return response.data.data;
  },
};

// Trip Service
export interface TripMember {
  _id?: string;
  name: string;
  email?: string;
  isRegisteredUser?: boolean;
}

export interface TripExpense {
  _id: string;
  tripId: string;
  description: string;
  amount: number;
  currency: string;
  amountInINR: number;
  exchangeRate: number;
  paidByMemberId: string;
  paidByMemberName: string;
  splitType: 'equal' | 'exact';
  splits: {
    memberId: string;
    memberName: string;
    amount: number;
    isPaid?: boolean;
  }[];
  date: string;
  category: string;
  createdAt: string;
}

export interface Trip {
  _id: string;
  name: string;
  description?: string;
  defaultCurrency: string;
  inrRate: number;
  startDate?: string;
  endDate?: string;
  members: TripMember[];
  status: 'active' | 'completed' | 'cancelled';
  createdAt: string;
}

export const tripService = {
  async getAll() {
    const response = await api.get('/trips');
    return response.data.data as Trip[];
  },

  async getById(id: string) {
    const response = await api.get(`/trips/${id}`);
    return response.data.data as Trip;
  },

  async create(data: {
    name: string;
    description?: string;
    defaultCurrency?: string;
    inrRate?: number;
    startDate?: string;
    endDate?: string;
  }) {
    const response = await api.post('/trips', data);
    return response.data.data;
  },

  async update(id: string, data: Partial<Trip>) {
    const response = await api.put(`/trips/${id}`, data);
    return response.data.data;
  },

  async delete(id: string) {
    const response = await api.delete(`/trips/${id}`);
    return response.data.data;
  },

  async addMember(tripId: string, member: TripMember) {
    const response = await api.post(`/trips/${tripId}/members`, member);
    return response.data.data;
  },

  async removeMember(tripId: string, memberId: string) {
    const response = await api.delete(`/trips/${tripId}/members/${memberId}`);
    return response.data.data;
  },

  async getExpenses(tripId: string) {
    const response = await api.get(`/trips/${tripId}/expenses`);
    return response.data.data as TripExpense[];
  },

  async addExpense(tripId: string, data: {
    description: string;
    amount: number;
    currency?: string;
    paidByMemberId: string;
    splitType: 'equal' | 'exact';
    splits: { memberId: string; memberName: string; amount: number }[];
    date: string;
    category?: string;
  }) {
    const response = await api.post(`/trips/${tripId}/expenses`, data);
    return response.data.data;
  },

  async updateExpense(tripId: string, expenseId: string, data: Partial<{
    description: string;
    amount: number;
    currency: string;
    paidByMemberId: string;
    splitType: 'equal' | 'exact';
    splits: { memberId: string; amount: number }[];
    selectedMemberIds: string[];
    date: string;
    category: string;
  }>) {
    const response = await api.put(`/trips/${tripId}/expenses/${expenseId}`, data);
    return response.data.data;
  },

  async deleteExpense(tripId: string, expenseId: string) {
    const response = await api.delete(`/trips/${tripId}/expenses/${expenseId}`);
    return response.data.data;
  },

  async getBalances(tripId: string) {
    const response = await api.get(`/trips/${tripId}/balances`);
    return response.data.data;
  },

  async getLinkedTransactions(tripId: string) {
    const response = await api.get(`/trips/${tripId}/linked-transactions`);
    return response.data.data;
  },
};

// Tax Service
export const taxService = {
  async getSalarySlips(fy?: string) {
    const params = fy ? `?fy=${fy}` : '';
    const response = await api.get(`/tax/salary-slips${params}`);
    return response.data.data;
  },

  async addSalarySlip(data: {
    financialYear: string;
    month: string;
    basicSalary: number;
    hra: number;
    lta: number;
    specialAllowance: number;
    otherAllowances: number;
    deductions: {
      pf: number;
      professionalTax: number;
      incomeTax: number;
      other: number;
    };
  }) {
    const response = await api.post('/tax/salary-slip', data);
    return response.data.data;
  },

  async calculate(fy: string) {
    const response = await api.get(`/tax/calculate/${fy}`);
    return response.data.data;
  },

  async getSlabs(fy: string) {
    const response = await api.get(`/tax/slabs/${fy}`);
    return response.data.data;
  },
};

// Investment Service
export const investmentService = {
  async getAll(fy?: string) {
    const params = fy ? `?fy=${fy}` : '';
    const response = await api.get(`/investments${params}`);
    return response.data.data;
  },

  async create(data: {
    financialYear: string;
    category: string;
    subCategory?: string;
    name: string;
    amount: number;
    description?: string;
  }) {
    const response = await api.post('/investments', data);
    return response.data.data;
  },

  async update(id: string, data: Partial<{
    amount: number;
    description: string;
    status: string;
  }>) {
    const response = await api.put(`/investments/${id}`, data);
    return response.data.data;
  },

  async delete(id: string) {
    const response = await api.delete(`/investments/${id}`);
    return response.data.data;
  },

  async getSummary(fy: string) {
    const response = await api.get(`/investments/summary/${fy}`);
    return response.data.data;
  },
};

// Upload Service
export interface UploadPreview {
  uploadId: string;
  sectionName: string;
  totalCount: number;
  duplicateCount: number;
  newCount: number;
  transactions: {
    transactionDate: string;
    description: string;
    amount: number;
    type: 'credit' | 'debit';
    isDuplicate: boolean;
  }[];
}

export const uploadService = {
  async uploadStatement(sectionId: string, file: { uri: string; name: string; type: string }) {
    const formData = new FormData();
    formData.append('sectionId', sectionId);
    formData.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.type,
    } as any);

    const response = await api.post('/upload/statement', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data as UploadPreview;
  },

  async getPreview(uploadId: string) {
    const response = await api.get(`/upload/preview/${uploadId}`);
    return response.data.data as UploadPreview;
  },

  async confirmUpload(uploadId: string, selectedIndices?: number[]) {
    const response = await api.post(`/upload/confirm/${uploadId}`, {
      selectedIndices,
    });
    return response.data.data;
  },

  async cancelUpload(uploadId: string) {
    const response = await api.delete(`/upload/cancel/${uploadId}`);
    return response.data.data;
  },
};

export default api;
