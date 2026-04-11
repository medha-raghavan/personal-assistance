import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Wallet, TrendingUp, TrendingDown, PiggyBank, Plus, Filter, X,
  CreditCard, Banknote, ArrowUpRight, ArrowDownRight, Calendar,
  ChevronRight, BarChart3, PieChart, RefreshCw,
} from 'lucide-react';
import {
  PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  AreaChart, Area,
} from 'recharts';
import { Card, Button, Input, Select, Badge } from '../components/common';
import { dashboardService } from '../services/dashboard.service';
import { transactionService } from '../services/transaction.service';
import { sectionService } from '../services/section.service';
import { categoryService } from '../services/category.service';
import { formatCurrency, formatCompactNumber } from '../utils/formatters';

const COLORS = ['#0ea5e9', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

const PERIOD_OPTIONS = [
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'last_3_months', label: 'Last 3 Months' },
  { value: 'last_6_months', label: 'Last 6 Months' },
  { value: 'this_year', label: 'This Year' },
  { value: 'custom', label: 'Custom Range' },
];

export function Dashboard() {
  const navigate = useNavigate();
  
  const [selectedPeriod, setSelectedPeriod] = useState('this_month');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [transactionType, setTransactionType] = useState<'all' | 'credit' | 'debit'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [activeView, setActiveView] = useState<'overview' | 'accounts' | 'categories'>('overview');

  const dateRange = useMemo(() => {
    const now = new Date();
    let start: Date;
    let end = new Date();

    switch (selectedPeriod) {
      case 'this_week':
        start = new Date(now);
        start.setDate(now.getDate() - now.getDay());
        break;
      case 'this_month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'last_month':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'last_3_months':
        start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        break;
      case 'last_6_months':
        start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        break;
      case 'this_year':
        start = new Date(now.getFullYear(), 0, 1);
        break;
      case 'custom':
        start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
        end = endDate ? new Date(endDate) : new Date();
        break;
      default:
        start = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    return {
      start: start.toISOString(),
      end: end.toISOString(),
    };
  }, [selectedPeriod, startDate, endDate]);

  const { data: overview, isLoading: overviewLoading, refetch: refetchOverview } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: () => dashboardService.getOverview(),
  });

  const { data: trends = [] } = useQuery({
    queryKey: ['dashboard-trends'],
    queryFn: () => dashboardService.getTrends(6),
  });

  const { data: sections = [] } = useQuery({
    queryKey: ['sections'],
    queryFn: () => sectionService.getAll(),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoryService.getAll(),
  });

  const { data: filteredData, refetch: refetchFiltered } = useQuery({
    queryKey: ['filtered-transactions', dateRange.start, dateRange.end, selectedAccountId, selectedCategoryId, transactionType],
    queryFn: async () => {
      try {
        return await transactionService.getAll({
          startDate: dateRange.start,
          endDate: dateRange.end,
          sectionId: selectedAccountId || undefined,
          categoryId: selectedCategoryId || undefined,
          type: transactionType === 'all' ? undefined : transactionType,
          limit: 1000,
        });
      } catch (error) {
        console.error('Failed to fetch filtered transactions:', error);
        return { transactions: [], pagination: { page: 1, limit: 1000, totalCount: 0, totalPages: 0 } };
      }
    },
  });

  const stats = useMemo(() => {
    const transactions = filteredData?.transactions || [];
    let income = 0;
    let expense = 0;
    const categoryTotals: Record<string, { name: string; amount: number; color: string; count: number }> = {};
    const accountTotals: Record<string, { name: string; income: number; expense: number; type: string }> = {};
    const dailyData: Record<string, { date: string; income: number; expense: number }> = {};

    transactions.forEach((t: any) => {
      const dateKey = new Date(t.transactionDate).toISOString().split('T')[0];
      if (!dailyData[dateKey]) {
        dailyData[dateKey] = { date: dateKey, income: 0, expense: 0 };
      }

      const category = typeof t.categoryId === 'object' ? t.categoryId : null;
      const section = typeof t.sectionId === 'object' ? t.sectionId : null;

      if (t.type === 'credit') {
        income += t.amount;
        dailyData[dateKey].income += t.amount;
      } else {
        expense += t.amount;
        dailyData[dateKey].expense += t.amount;
        
        const catName = category?.name || 'Uncategorized';
        const catColor = category?.color || '#6b7280';
        if (!categoryTotals[catName]) {
          categoryTotals[catName] = { name: catName, amount: 0, color: catColor, count: 0 };
        }
        categoryTotals[catName].amount += t.amount;
        categoryTotals[catName].count += 1;
      }

      const accName = section?.name || 'Unknown';
      const accType = section?.type || 'other';
      if (!accountTotals[accName]) {
        accountTotals[accName] = { name: accName, income: 0, expense: 0, type: accType };
      }
      if (t.type === 'credit') {
        accountTotals[accName].income += t.amount;
      } else {
        accountTotals[accName].expense += t.amount;
      }
    });

    const sortedCategories = Object.values(categoryTotals)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);

    const sortedAccounts = Object.values(accountTotals)
      .sort((a, b) => (b.income + b.expense) - (a.income + a.expense));

    const dailyTrend = Object.values(dailyData)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30);

    return {
      income,
      expense,
      net: income - expense,
      count: transactions.length,
      avgTransaction: transactions.length > 0 ? (income + expense) / transactions.length : 0,
      categoryBreakdown: sortedCategories,
      accountBreakdown: sortedAccounts,
      dailyTrend,
    };
  }, [filteredData]);

  const savingsRate = stats.income > 0 ? ((stats.net / stats.income) * 100) : 0;

  const resetFilters = () => {
    setSelectedPeriod('this_month');
    setSelectedAccountId('');
    setSelectedCategoryId('');
    setTransactionType('all');
    setStartDate('');
    setEndDate('');
  };

  const hasActiveFilters = selectedAccountId || selectedCategoryId || transactionType !== 'all' || selectedPeriod !== 'this_month';

  const getPeriodLabel = () => {
    if (selectedPeriod === 'custom' && startDate && endDate) {
      return `${new Date(startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} - ${new Date(endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
    }
    return PERIOD_OPTIONS.find(p => p.value === selectedPeriod)?.label || 'This Month';
  };

  if (overviewLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header with Filters */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">Financial Dashboard</h1>
            <p className="text-sm text-gray-400 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {getPeriodLabel()}
              {hasActiveFilters && (
                <Badge size="sm" variant="primary">Filtered</Badge>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Filter className="w-4 h-4" />}
              onClick={() => setShowFilters(!showFilters)}
              className={showFilters ? 'ring-2 ring-primary-500' : ''}
            >
              Filters
            </Button>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<RefreshCw className="w-4 h-4" />}
              onClick={() => { refetchOverview(); refetchFiltered(); }}
            >
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => navigate('/transactions')}
              size="sm"
            >
              <span className="hidden sm:inline">Add Transaction</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-white">Filter Transactions</h3>
              {hasActiveFilters && (
                <button onClick={resetFilters} className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1">
                  <X className="w-3 h-3" /> Reset all
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <Select
                label="Period"
                value={selectedPeriod}
                onChange={(value) => setSelectedPeriod(value)}
                options={PERIOD_OPTIONS.map(opt => ({ value: opt.value, label: opt.label }))}
              />

              {selectedPeriod === 'custom' && (
                <>
                  <Input
                    label="Start Date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                  <Input
                    label="End Date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </>
              )}

              <Select
                label="Account"
                value={selectedAccountId}
                onChange={(value) => setSelectedAccountId(value)}
                options={[
                  { value: '', label: 'All Accounts' },
                  ...sections.map((s: any) => ({ value: s._id, label: s.name }))
                ]}
              />

              <Select
                label="Category"
                value={selectedCategoryId}
                onChange={(value) => setSelectedCategoryId(value)}
                options={[
                  { value: '', label: 'All Categories' },
                  ...categories.map((c: any) => ({ value: c._id, label: c.name }))
                ]}
              />

              <Select
                label="Type"
                value={transactionType}
                onChange={(value) => setTransactionType(value as any)}
                options={[
                  { value: 'all', label: 'All Types' },
                  { value: 'credit', label: 'Income Only' },
                  { value: 'debit', label: 'Expense Only' },
                ]}
              />
            </div>
          </Card>
        )}
      </div>

      {/* View Tabs */}
      <div className="flex gap-1 border-b border-gray-700 pb-2">
        {[
          { id: 'overview', label: 'Overview', icon: BarChart3 },
          { id: 'accounts', label: 'Accounts', icon: CreditCard },
          { id: 'categories', label: 'Categories', icon: PieChart },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveView(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              activeView === tab.id
                ? 'bg-primary-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview View */}
      {activeView === 'overview' && (
        <>
          {/* Main Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Card className="p-4 bg-gradient-to-br from-primary-900/50 to-primary-800/30 border-primary-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Total Balance</p>
                  <p className="text-xl sm:text-2xl font-bold text-white">{formatCurrency(overview?.totalBalance || 0)}</p>
                  <p className="text-xs text-gray-500">{sections.length} accounts</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-primary-600/20 flex items-center justify-center">
                  <Wallet className="w-6 h-6 text-primary-400" />
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-green-900/50 to-green-800/30 border-green-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Income</p>
                  <p className="text-xl sm:text-2xl font-bold text-green-400">{formatCurrency(stats.income)}</p>
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <ArrowUpRight className="w-3 h-3 text-green-400" />
                    {stats.count} transactions
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-green-600/20 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-green-400" />
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-red-900/50 to-red-800/30 border-red-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Expenses</p>
                  <p className="text-xl sm:text-2xl font-bold text-red-400">{formatCurrency(stats.expense)}</p>
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <ArrowDownRight className="w-3 h-3 text-red-400" />
                    Avg: {formatCurrency(stats.avgTransaction)}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-red-600/20 flex items-center justify-center">
                  <TrendingDown className="w-6 h-6 text-red-400" />
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-purple-900/50 to-purple-800/30 border-purple-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Net Savings</p>
                  <p className={`text-xl sm:text-2xl font-bold ${stats.net >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {stats.net >= 0 ? '+' : ''}{formatCurrency(stats.net)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {savingsRate >= 0 ? `${savingsRate.toFixed(0)}% savings rate` : `${Math.abs(savingsRate).toFixed(0)}% overspent`}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-purple-600/20 flex items-center justify-center">
                  <PiggyBank className="w-6 h-6 text-purple-400" />
                </div>
              </div>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Daily Trend */}
            <Card className="p-4">
              <h3 className="text-sm font-medium text-white mb-4">Daily Cash Flow</h3>
              <div className="h-[250px]">
                {stats.dailyTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats.dailyTrend}>
                      <defs>
                        <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 10, fill: '#9ca3af' }}
                        tickFormatter={(v) => new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        interval="preserveStartEnd"
                      />
                      <YAxis 
                        tick={{ fontSize: 10, fill: '#9ca3af' }}
                        tickFormatter={(v) => formatCompactNumber(v)}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                        formatter={(value: number, name: string) => [formatCurrency(value), name === 'income' ? 'Income' : 'Expense']}
                        labelFormatter={(v) => new Date(v).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                      />
                      <Area type="monotone" dataKey="income" stroke="#22c55e" fill="url(#incomeGrad)" strokeWidth={2} />
                      <Area type="monotone" dataKey="expense" stroke="#ef4444" fill="url(#expenseGrad)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-500">
                    No data for selected period
                  </div>
                )}
              </div>
            </Card>

            {/* Category Pie Chart */}
            <Card className="p-4">
              <h3 className="text-sm font-medium text-white mb-4">Spending by Category</h3>
              {stats.categoryBreakdown.length > 0 ? (
                <div className="h-[250px] flex">
                  <div className="w-1/2">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPie>
                        <Pie
                          data={stats.categoryBreakdown}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          dataKey="amount"
                          nameKey="name"
                        >
                          {stats.categoryBreakdown.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number) => formatCurrency(value)}
                          contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                        />
                      </RechartsPie>
                    </ResponsiveContainer>
                  </div>
                  <div className="w-1/2 flex flex-col justify-center space-y-1 overflow-y-auto">
                    {stats.categoryBreakdown.slice(0, 6).map((cat, idx) => (
                      <div key={cat.name} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color || COLORS[idx % COLORS.length] }} />
                          <span className="text-gray-300 truncate max-w-[100px]">{cat.name}</span>
                        </div>
                        <span className="text-gray-400 text-xs">{formatCompactNumber(cat.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-gray-500">
                  No expense data for selected period
                </div>
              )}
            </Card>
          </div>

          {/* Monthly Trends */}
          {trends && trends.length > 0 && (
            <Card className="p-4">
              <h3 className="text-sm font-medium text-white mb-4">Monthly Trends (Last 6 Months)</h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trends.map((d: any) => ({
                    ...d,
                    month: new Date(d.period + '-01').toLocaleDateString('en-IN', { month: 'short' }),
                    savings: d.income - d.expense,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9ca3af' }} />
                    <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} tickFormatter={(v) => formatCompactNumber(v)} />
                    <Tooltip
                      formatter={(value: number, name: string) => [formatCurrency(value), name]}
                      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                    />
                    <Legend />
                    <Bar dataKey="income" name="Income" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expense" name="Expense" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {/* Recent Transactions */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-white">Recent Transactions</h3>
              <button onClick={() => navigate('/transactions')} className="text-primary-400 hover:text-primary-300 text-sm flex items-center gap-1">
                View All <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2">
              {(overview?.recentTransactions || []).slice(0, 5).map((txn: any) => (
                <div key={txn._id} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg hover:bg-gray-700/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      txn.type === 'credit' ? 'bg-green-900/50' : 'bg-red-900/50'
                    }`}>
                      {txn.type === 'credit' ? (
                        <ArrowDownRight className="w-5 h-5 text-green-400" />
                      ) : (
                        <ArrowUpRight className="w-5 h-5 text-red-400" />
                      )}
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{txn.description}</p>
                      <p className="text-gray-500 text-xs">
                        {new Date(txn.transactionDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        {typeof txn.categoryId === 'object' && txn.categoryId?.name && ` · ${txn.categoryId.name}`}
                      </p>
                    </div>
                  </div>
                  <span className={`font-semibold ${txn.type === 'credit' ? 'text-green-400' : 'text-red-400'}`}>
                    {txn.type === 'credit' ? '+' : '-'}{formatCurrency(txn.amount)}
                  </span>
                </div>
              ))}
              {(!overview?.recentTransactions || overview.recentTransactions.length === 0) && (
                <div className="text-center text-gray-500 py-4">No recent transactions</div>
              )}
            </div>
          </Card>
        </>
      )}

      {/* Accounts View */}
      {activeView === 'accounts' && (
        <>
          {/* Account Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sections.map((section: any) => {
              const accData = stats.accountBreakdown.find(a => a.name === section.name);
              return (
                <Card
                  key={section._id}
                  className={`p-4 cursor-pointer transition-all hover:ring-2 hover:ring-primary-500 ${
                    selectedAccountId === section._id ? 'ring-2 ring-primary-500' : ''
                  }`}
                  onClick={() => setSelectedAccountId(selectedAccountId === section._id ? '' : section._id)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        section.type === 'credit' ? 'bg-orange-900/50' : 'bg-primary-900/50'
                      }`}>
                        {section.type === 'credit' ? (
                          <CreditCard className="w-5 h-5 text-orange-400" />
                        ) : (
                          <Banknote className="w-5 h-5 text-primary-400" />
                        )}
                      </div>
                      <div>
                        <p className="text-white font-medium">{section.name}</p>
                        <p className="text-gray-500 text-xs capitalize">{section.type?.replace('_', ' ')}</p>
                      </div>
                    </div>
                    <Badge variant={section.type === 'credit' && section.balance > 0 ? 'danger' : 'success'} size="sm">
                      {section.type === 'credit' && section.balance > 0 ? 'Due' : 'Balance'}
                    </Badge>
                  </div>
                  
                  <p className={`text-2xl font-bold mb-3 ${
                    section.type === 'credit' && section.balance > 0 ? 'text-red-400' : 'text-white'
                  }`}>
                    {section.type === 'credit' && section.balance > 0 ? '-' : ''}
                    {formatCurrency(Math.abs(section.balance))}
                  </p>

                  {accData && (
                    <div className="grid grid-cols-2 gap-2 pt-3 border-t border-gray-700">
                      <div>
                        <p className="text-xs text-gray-500">Income</p>
                        <p className="text-sm text-green-400">+{formatCompactNumber(accData.income)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Expense</p>
                        <p className="text-sm text-red-400">-{formatCompactNumber(accData.expense)}</p>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          {/* Account Comparison Chart */}
          {stats.accountBreakdown.length > 0 && (
            <Card className="p-4">
              <h3 className="text-sm font-medium text-white mb-4">Account Activity Comparison</h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.accountBreakdown} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 12, fill: '#9ca3af' }} tickFormatter={(v) => formatCompactNumber(v)} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#9ca3af' }} width={100} />
                    <Tooltip
                      formatter={(value: number, name: string) => [formatCurrency(value), name]}
                      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                    />
                    <Legend />
                    <Bar dataKey="income" name="Income" fill="#22c55e" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="expense" name="Expense" fill="#ef4444" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Categories View */}
      {activeView === 'categories' && (
        <>
          {stats.categoryBreakdown.length === 0 ? (
            <Card className="p-8">
              <div className="text-center text-gray-500">
                <PieChart className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No expense data for the selected period</p>
                <p className="text-sm mt-1">Try changing the filters to see category breakdown</p>
              </div>
            </Card>
          ) : (
            <>
              {/* Category Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {stats.categoryBreakdown.map((cat, idx) => {
                  const percentage = stats.expense > 0 ? (cat.amount / stats.expense) * 100 : 0;
                  const catObj = categories.find((c: any) => c.name === cat.name);
                  return (
                    <Card
                      key={cat.name}
                      className={`p-4 cursor-pointer transition-all hover:ring-2 hover:ring-primary-500 ${
                        catObj && selectedCategoryId === catObj._id ? 'ring-2 ring-primary-500' : ''
                      }`}
                      onClick={() => {
                        if (catObj) {
                          setSelectedCategoryId(selectedCategoryId === catObj._id ? '' : catObj._id);
                        }
                      }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: cat.color || COLORS[idx % COLORS.length] }}
                        />
                        <p className="text-white text-sm font-medium truncate">{cat.name}</p>
                      </div>
                      <p className="text-xl font-bold text-white">{formatCurrency(cat.amount)}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-500">{cat.count} txns</span>
                        <span className="text-xs text-gray-400">{percentage.toFixed(1)}%</span>
                      </div>
                      <div className="mt-2 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${percentage}%`, backgroundColor: cat.color || COLORS[idx % COLORS.length] }}
                        />
                      </div>
                    </Card>
                  );
                })}
              </div>

              {/* Category Bar Chart */}
              <Card className="p-4">
                <h3 className="text-sm font-medium text-white mb-4">Category Spending Distribution</h3>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.categoryBreakdown}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} angle={-45} textAnchor="end" height={80} />
                      <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} tickFormatter={(v) => formatCompactNumber(v)} />
                      <Tooltip
                        formatter={(value: number) => [formatCurrency(value), 'Amount']}
                        contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                      />
                      <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                        {stats.categoryBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
