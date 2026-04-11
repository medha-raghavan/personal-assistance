import api from './api';
import { TaxCalculation, SalarySlip, Investment, ApiResponse } from '../types';

export interface ParsedSalaryData {
  basic: number;
  hra: number;
  lta: number;
  specialAllowance: number;
  otherAllowances: number;
  grossIncome: number;
  pf: number;
  professionalTax: number;
  incomeTax: number;
  otherDeductions: number;
  totalDeductions: number;
  netSalary: number;
  message?: string;
  detectedFields?: string[];
}

export const taxService = {
  async calculateTax(fy: string): Promise<TaxCalculation> {
    const response = await api.get<ApiResponse<TaxCalculation>>(`/tax/calculate/${fy}`);
    return response.data.data;
  },

  async getSalarySlips(fy?: string): Promise<SalarySlip[]> {
    const params = fy ? `?fy=${fy}` : '';
    const response = await api.get<ApiResponse<SalarySlip[]>>(`/tax/salary-slips${params}`);
    return response.data.data;
  },

  async addSalarySlip(data: Partial<SalarySlip>): Promise<SalarySlip> {
    const response = await api.post<ApiResponse<SalarySlip>>('/tax/salary-slip', data);
    return response.data.data;
  },

  async parseSalarySlip(file: File): Promise<ParsedSalaryData> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post<ApiResponse<ParsedSalaryData>>('/tax/parse-salary-slip', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data;
  },

  async getTaxSlabs(fy: string): Promise<Array<{
    financialYear: string;
    regime: 'old' | 'new';
    slabs: Array<{ minAmount: number; maxAmount: number | null; rate: number }>;
    standardDeduction: number;
    rebateLimit: number;
    rebateAmount: number;
    cessRate: number;
  }>> {
    const response = await api.get(`/tax/slabs/${fy}`);
    return response.data.data;
  },
};

export const investmentService = {
  async getAll(params?: { fy?: string; category?: string; status?: string }): Promise<Investment[]> {
    const queryParams = new URLSearchParams();
    if (params?.fy) queryParams.set('fy', params.fy);
    if (params?.category) queryParams.set('category', params.category);
    if (params?.status) queryParams.set('status', params.status);
    
    const response = await api.get<ApiResponse<Investment[]>>(`/investments?${queryParams.toString()}`);
    return response.data.data;
  },

  async create(data: Partial<Investment>): Promise<Investment> {
    const response = await api.post<ApiResponse<Investment>>('/investments', data);
    return response.data.data;
  },

  async update(id: string, data: Partial<Investment>): Promise<Investment> {
    const response = await api.put<ApiResponse<Investment>>(`/investments/${id}`, data);
    return response.data.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/investments/${id}`);
  },

  async getSummary(fy: string): Promise<{
    financialYear: string;
    totalDeductions: number;
    categories: Array<{
      category: string;
      total: number;
      limit: number;
      utilized: number;
      remaining: number;
      utilizationPercent: number;
      investments: Array<{ id: string; name: string; amount: number; subCategory?: string }>;
    }>;
  }> {
    const response = await api.get(`/investments/summary/${fy}`);
    return response.data.data;
  },
};
