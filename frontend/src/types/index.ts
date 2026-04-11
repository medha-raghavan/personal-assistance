export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface Category {
  _id: string;
  userId: string;
  name: string;
  icon?: string;
  color?: string;
  keywords: string[];
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Section {
  _id: string;
  userId: string;
  name: string;
  label: string;
  type: 'cash' | 'checking' | 'credit' | 'savings' | 'investment' | 'digital_wallet';
  balance: number;
  uploadEnabled: boolean;
  parserConfig: {
    type: 'hdfc_csv' | 'icici_pdf' | 'generic_xls' | 'manual';
    columnMapping?: Record<string, string>;
  };
  createdAt: string;
  updatedAt: string;
}

export interface TransactionSplit {
  memberId: string;
  memberName: string;
  amount: number;
}

export interface Transaction {
  _id: string;
  sectionId: string | Section;
  userId: string;
  tripId?: string | Trip;
  categoryId?: string | Category;
  tripSplits?: TransactionSplit[];
  paidByMemberId?: string;
  paidByMemberName?: string;
  transactionDate: string;
  valueDate?: string;
  amount: number;
  type: 'credit' | 'debit';
  description: string;
  reference?: string;
  tags: string[];
  currency: string;
  exchangeRate: number;
  compositeKey: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface TripMember {
  _id?: string;
  name: string;
  email?: string;
  isRegisteredUser: boolean;
  userId?: string;
  splitPercentage?: number;
  fixedAmount?: number;
}

export interface Trip {
  _id: string;
  userId: string;
  name: string;
  description?: string;
  defaultCurrency: string;
  inrRate: number;
  startDate?: string;
  endDate?: string;
  status: 'active' | 'completed' | 'cancelled';
  members: TripMember[];
  createdAt: string;
  updatedAt: string;
}

export interface Investment {
  _id: string;
  userId: string;
  category: '80C' | '80D' | '80CCD' | 'NPS' | '80G' | 'HRA' | 'LTA' | 'OTHER';
  subCategory?: string;
  name: string;
  description?: string;
  amount: number;
  financialYear: string;
  startDate?: string;
  maturityDate?: string;
  status: 'active' | 'matured' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

export interface SalarySlip {
  _id: string;
  userId: string;
  financialYear: string;
  month?: string;
  grossIncome: number;
  basicSalary?: number;
  hra?: number;
  lta?: number;
  specialAllowance?: number;
  otherAllowances?: number;
  deductions: {
    pf?: number;
    professionalTax?: number;
    incomeTax?: number;
    other?: number;
  };
  netSalary: number;
  uploadDate: string;
  createdAt: string;
}

export interface DashboardOverview {
  totalBalance: number;
  sections: Array<{
    id: string;
    name: string;
    label: string;
    type: string;
    balance: number;
  }>;
  thisMonth: {
    income: number;
    expense: number;
    net: number;
    transactionCount: number;
    savingsRate: number;
  };
  comparison: {
    expenseChange: number;
    lastMonthExpense: number;
  };
  recentTransactions: Transaction[];
}

export interface TrendData {
  period: string;
  income: number;
  expense: number;
  net: number;
  count: number;
}

export interface CategoryBreakdown {
  totalExpense: number;
  categories: Array<{
    category: string;
    amount: number;
    count: number;
    percentage: number;
  }>;
}

export interface ParsedTransaction {
  transactionDate: string;
  valueDate?: string;
  amount: number;
  type: 'credit' | 'debit';
  description: string;
  reference?: string;
  tags: string[];
  categoryId?: string;
  categoryName?: string;
  compositeKey: string;
  isDuplicate: boolean;
  balance?: number;
}

export interface UploadPreview {
  uploadId: string;
  fileName: string;
  section: Section;
  status: string;
  totalCount: number;
  duplicateCount: number;
  newCount: number;
  transactions: ParsedTransaction[];
}

export interface TaxCalculation {
  financialYear: string;
  grossIncome: number;
  newRegime: {
    standardDeduction: number;
    taxableIncome: number;
    tax: number;
    breakdown: Array<{ slab: string; tax: number }>;
  };
  oldRegime: {
    standardDeduction: number;
    deductions: {
      '80C': number;
      '80D': number;
      '80CCD': number;
      total: number;
    };
    taxableIncome: number;
    tax: number;
    breakdown: Array<{ slab: string; tax: number }>;
  };
  recommendation: 'new' | 'old';
  potentialSavings: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: {
    message: string;
  };
}

export interface PaginatedResponse<T> {
  transactions: T[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
  totals?: {
    totalCredit: number;
    totalDebit: number;
    netTotal: number;
  };
}
