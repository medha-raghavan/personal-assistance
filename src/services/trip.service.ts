import api from './api';
import { Trip, TripMember, ApiResponse, Transaction } from '../types';

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
  splitType: 'equal' | 'percentage' | 'exact' | 'shares';
  splits: Array<{
    memberId: string;
    memberName: string;
    amount: number;
    isPaid: boolean;
  }>;
  date: string;
  category?: string;
  createdAt: string;
}

export interface TripBalances {
  trip: { id: string; name: string; currency: string };
  totalExpenses: number;
  expenseCount: number;
  linkedTransactionCount: number;
  memberBalances: Array<{
    memberId: string;
    name: string;
    paid: number;
    owes: number;
    balance: number;
  }>;
  settlements: Array<{
    from: string;
    fromName: string;
    to: string;
    toName: string;
    amount: number;
  }>;
}

export const tripService = {
  async getAll(status?: string): Promise<Trip[]> {
    const params = status ? `?status=${status}` : '';
    const response = await api.get<ApiResponse<Trip[]>>(`/trips${params}`);
    return response.data.data;
  },

  async getById(id: string): Promise<Trip> {
    const response = await api.get<ApiResponse<Trip>>(`/trips/${id}`);
    return response.data.data;
  },

  async create(data: Partial<Trip>): Promise<Trip> {
    const response = await api.post<ApiResponse<Trip>>('/trips', data);
    return response.data.data;
  },

  async update(id: string, data: Partial<Trip>): Promise<Trip> {
    const response = await api.put<ApiResponse<Trip>>(`/trips/${id}`, data);
    return response.data.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/trips/${id}`);
  },

  async addMember(tripId: string, member: Omit<TripMember, '_id'>): Promise<Trip> {
    const response = await api.post<ApiResponse<Trip>>(`/trips/${tripId}/members`, member);
    return response.data.data;
  },

  async updateMember(tripId: string, memberId: string, data: { name?: string; email?: string }): Promise<Trip> {
    const response = await api.put<ApiResponse<Trip>>(`/trips/${tripId}/members/${memberId}`, data);
    return response.data.data;
  },

  async removeMember(tripId: string, memberId: string): Promise<Trip> {
    const response = await api.delete<ApiResponse<Trip>>(`/trips/${tripId}/members/${memberId}`);
    return response.data.data;
  },

  async getExpenses(tripId: string): Promise<TripExpense[]> {
    const response = await api.get<ApiResponse<TripExpense[]>>(`/trips/${tripId}/expenses`);
    return response.data.data;
  },

  async addExpense(tripId: string, data: {
    description: string;
    amount: number;
    currency?: string;
    exchangeRate?: number;
    paidByMemberId: string;
    splitType: 'equal' | 'percentage' | 'exact' | 'shares';
    splits?: Array<{ memberId: string; amount: number }>;
    selectedMemberIds?: string[];
    date: string;
    category?: string;
  }): Promise<TripExpense> {
    const response = await api.post<ApiResponse<TripExpense>>(`/trips/${tripId}/expenses`, data);
    return response.data.data;
  },

  async deleteExpense(tripId: string, expenseId: string): Promise<void> {
    await api.delete(`/trips/${tripId}/expenses/${expenseId}`);
  },

  async updateExpense(tripId: string, expenseId: string, data: Partial<{
    description: string;
    amount: number;
    currency: string;
    paidByMemberId: string;
    splitType: 'equal' | 'exact';
    splits: Array<{ memberId: string; amount: number }>;
    selectedMemberIds: string[];
    date: string;
    category: string;
  }>): Promise<TripExpense> {
    const response = await api.put<ApiResponse<TripExpense>>(`/trips/${tripId}/expenses/${expenseId}`, data);
    return response.data.data;
  },

  async getBalances(tripId: string): Promise<TripBalances> {
    const response = await api.get<ApiResponse<TripBalances>>(`/trips/${tripId}/balances`);
    return response.data.data;
  },

  async getSummary(tripId: string): Promise<{
    trip: { id: string; name: string; currency: string; inrRate: number };
    summary: {
      totalExpense: number;
      totalExpenseInINR: number;
      transactionCount: number;
      memberCount: number;
      equalShare: number;
    };
    categoryBreakdown: Record<string, number>;
    memberSplits: Array<{
      name: string;
      email?: string;
      share: number;
      percentage: number;
    }>;
  }> {
    const response = await api.get(`/trips/${tripId}/summary`);
    return response.data.data;
  },

  async linkTransaction(tripId: string, transactionId: string): Promise<void> {
    await api.post(`/trips/${tripId}/link-transaction/${transactionId}`);
  },

  async unlinkTransaction(tripId: string, transactionId: string): Promise<void> {
    await api.delete(`/trips/${tripId}/unlink-transaction/${transactionId}`);
  },

  async getLinkedTransactions(tripId: string): Promise<Transaction[]> {
    const response = await api.get<ApiResponse<Transaction[]>>(`/trips/${tripId}/linked-transactions`);
    return response.data.data;
  },
};
