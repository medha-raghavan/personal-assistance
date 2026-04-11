import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  Dimensions,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import {
  dashboardService,
  sectionService,
  categoryService,
  transactionService,
} from '../../services/api';
import { useTheme } from '../../components/ThemeProvider';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatShortCurrency(amount: number): string {
  if (amount >= 10000000) {
    return `₹${(amount / 10000000).toFixed(1)}Cr`;
  } else if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(1)}L`;
  } else if (amount >= 1000) {
    return `₹${(amount / 1000).toFixed(1)}K`;
  }
  return `₹${amount.toFixed(0)}`;
}

const SECTION_ICONS: Record<string, string> = {
  checking: 'business-outline',
  savings: 'wallet-outline',
  credit: 'card-outline',
  cash: 'cash-outline',
  investment: 'trending-up-outline',
  digital_wallet: 'phone-portrait-outline',
};

const PERIOD_OPTIONS = [
  { label: 'This Week', value: 'this_week' },
  { label: 'This Month', value: 'this_month' },
  { label: 'Last Month', value: 'last_month' },
  { label: 'Last 3 Months', value: 'last_3_months' },
  { label: 'Last 6 Months', value: 'last_6_months' },
  { label: 'This Year', value: 'this_year' },
  { label: 'Custom Range', value: 'custom' },
];

const CATEGORY_COLORS = [
  '#0ea5e9', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
];

type ViewType = 'overview' | 'accounts' | 'categories';

export default function DashboardScreen() {
  const router = useRouter();
  const { isDark, colors } = useTheme();
  
  const [activeView, setActiveView] = useState<ViewType>('overview');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('this_month');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [transactionType, setTransactionType] = useState<'all' | 'credit' | 'debit'>('all');
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(1);
    return date;
  });
  const [endDate, setEndDate] = useState(new Date());
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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
        start = startDate;
        end = endDate;
        break;
      default:
        start = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    return { start, end };
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

  const { data: filteredTransactions, refetch: refetchFiltered } = useQuery({
    queryKey: ['filtered-transactions', dateRange.start.toISOString(), dateRange.end.toISOString(), selectedAccountId, selectedCategoryId, transactionType],
    queryFn: () => transactionService.getAll({
      startDate: dateRange.start.toISOString(),
      endDate: dateRange.end.toISOString(),
      sectionId: selectedAccountId || undefined,
      categoryId: selectedCategoryId || undefined,
      type: transactionType === 'all' ? undefined : transactionType,
      limit: 1000,
    }),
  });

  const stats = useMemo(() => {
    const transactions = filteredTransactions?.transactions || [];
    let income = 0;
    let expense = 0;
    const categoryTotals: Record<string, { name: string; amount: number; color: string; count: number }> = {};
    const accountTotals: Record<string, { name: string; income: number; expense: number; type: string }> = {};

    transactions.forEach((t: any) => {
      const category = typeof t.categoryId === 'object' ? t.categoryId : null;
      const section = typeof t.sectionId === 'object' ? t.sectionId : null;

      if (t.type === 'credit') {
        income += t.amount;
      } else {
        expense += t.amount;
        
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

    return {
      income,
      expense,
      net: income - expense,
      count: transactions.length,
      categoryBreakdown: sortedCategories,
      accountBreakdown: sortedAccounts,
    };
  }, [filteredTransactions]);

  const savingsRate = stats.income > 0 ? ((stats.net / stats.income) * 100) : 0;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchOverview(), refetchFiltered()]);
    setRefreshing(false);
  }, [refetchOverview, refetchFiltered]);

  const resetFilters = () => {
    setSelectedPeriod('this_month');
    setSelectedAccountId('');
    setSelectedCategoryId('');
    setTransactionType('all');
    setStartDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    setEndDate(new Date());
  };

  const hasActiveFilters = selectedAccountId || selectedCategoryId || transactionType !== 'all' || selectedPeriod !== 'this_month';

  const getPeriodLabel = () => {
    if (selectedPeriod === 'custom') {
      return `${dateRange.start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} - ${dateRange.end.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
    }
    return PERIOD_OPTIONS.find(p => p.value === selectedPeriod)?.label || 'This Month';
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      className="flex-1"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View className="p-4">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-1">
            <Text style={{ color: colors.text }} className="text-2xl font-bold">Dashboard</Text>
            <View className="flex-row items-center mt-1">
              <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted }} className="text-xs ml-1">{getPeriodLabel()}</Text>
              {hasActiveFilters && (
                <View className="ml-2 px-2 py-0.5 rounded-full bg-sky-500/20">
                  <Text className="text-sky-400 text-xs">Filtered</Text>
                </View>
              )}
            </View>
          </View>
          <View className="flex-row gap-2">
            <TouchableOpacity
              className="p-2 rounded-lg"
              style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6' }}
              onPress={() => setShowFilters(true)}
            >
              <Ionicons name="filter" size={20} color={colors.icon} />
            </TouchableOpacity>
            <TouchableOpacity
              className="p-2 rounded-lg bg-sky-500"
              onPress={() => router.push('/(tabs)/transactions')}
            >
              <Ionicons name="add" size={20} color="white" />
            </TouchableOpacity>
          </View>
        </View>

        {/* View Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
          <View className="flex-row gap-2">
            {[
              { id: 'overview', label: 'Overview', icon: 'bar-chart-outline' },
              { id: 'accounts', label: 'Accounts', icon: 'wallet-outline' },
              { id: 'categories', label: 'Categories', icon: 'pie-chart-outline' },
            ].map((tab) => (
              <TouchableOpacity
                key={tab.id}
                className={`flex-row items-center px-4 py-2 rounded-lg ${
                  activeView === tab.id ? 'bg-sky-500' : ''
                }`}
                style={activeView !== tab.id ? { backgroundColor: isDark ? '#374151' : '#f3f4f6' } : {}}
                onPress={() => setActiveView(tab.id as ViewType)}
              >
                <Ionicons 
                  name={tab.icon as any} 
                  size={16} 
                  color={activeView === tab.id ? 'white' : colors.textMuted} 
                />
                <Text 
                  className={`ml-2 font-medium ${activeView === tab.id ? 'text-white' : ''}`}
                  style={activeView !== tab.id ? { color: colors.text } : {}}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Overview View */}
        {activeView === 'overview' && (
          <>
            {/* Main Stats Grid */}
            <View className="flex-row flex-wrap gap-3 mb-4">
              {/* Total Balance */}
              <View 
                className="flex-1 min-w-[45%] rounded-xl p-4"
                style={{ backgroundColor: isDark ? '#0c4a6e' : '#e0f2fe' }}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <Text style={{ color: isDark ? '#7dd3fc' : '#0369a1' }} className="text-xs">Total Balance</Text>
                    <Text style={{ color: isDark ? 'white' : '#0c4a6e' }} className="text-xl font-bold mt-1">
                      {formatShortCurrency(overview?.totalBalance || 0)}
                    </Text>
                    <Text style={{ color: isDark ? '#7dd3fc' : '#0369a1' }} className="text-xs mt-1">
                      {sections.length} accounts
                    </Text>
                  </View>
                  <View className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: isDark ? '#0369a140' : '#0369a120' }}>
                    <Ionicons name="wallet" size={20} color={isDark ? '#7dd3fc' : '#0369a1'} />
                  </View>
                </View>
              </View>

              {/* Income */}
              <View 
                className="flex-1 min-w-[45%] rounded-xl p-4"
                style={{ backgroundColor: isDark ? '#14532d' : '#dcfce7' }}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <Text style={{ color: isDark ? '#86efac' : '#166534' }} className="text-xs">Income</Text>
                    <Text style={{ color: isDark ? '#22c55e' : '#15803d' }} className="text-xl font-bold mt-1">
                      {formatShortCurrency(stats.income)}
                    </Text>
                    <View className="flex-row items-center mt-1">
                      <Ionicons name="arrow-down" size={12} color={isDark ? '#86efac' : '#166534'} />
                      <Text style={{ color: isDark ? '#86efac' : '#166534' }} className="text-xs ml-1">
                        {stats.count} txns
                      </Text>
                    </View>
                  </View>
                  <View className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: isDark ? '#16653440' : '#16653420' }}>
                    <Ionicons name="trending-up" size={20} color={isDark ? '#86efac' : '#166534'} />
                  </View>
                </View>
              </View>

              {/* Expenses */}
              <View 
                className="flex-1 min-w-[45%] rounded-xl p-4"
                style={{ backgroundColor: isDark ? '#7f1d1d' : '#fee2e2' }}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <Text style={{ color: isDark ? '#fca5a5' : '#991b1b' }} className="text-xs">Expenses</Text>
                    <Text style={{ color: isDark ? '#ef4444' : '#dc2626' }} className="text-xl font-bold mt-1">
                      {formatShortCurrency(stats.expense)}
                    </Text>
                    <View className="flex-row items-center mt-1">
                      <Ionicons name="arrow-up" size={12} color={isDark ? '#fca5a5' : '#991b1b'} />
                      <Text style={{ color: isDark ? '#fca5a5' : '#991b1b' }} className="text-xs ml-1">
                        {stats.categoryBreakdown.length} categories
                      </Text>
                    </View>
                  </View>
                  <View className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: isDark ? '#991b1b40' : '#991b1b20' }}>
                    <Ionicons name="trending-down" size={20} color={isDark ? '#fca5a5' : '#991b1b'} />
                  </View>
                </View>
              </View>

              {/* Net Savings */}
              <View 
                className="flex-1 min-w-[45%] rounded-xl p-4"
                style={{ backgroundColor: isDark ? '#581c87' : '#f3e8ff' }}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <Text style={{ color: isDark ? '#d8b4fe' : '#7e22ce' }} className="text-xs">Net Savings</Text>
                    <Text 
                      className="text-xl font-bold mt-1"
                      style={{ color: stats.net >= 0 ? (isDark ? '#22c55e' : '#16a34a') : (isDark ? '#ef4444' : '#dc2626') }}
                    >
                      {stats.net >= 0 ? '+' : ''}{formatShortCurrency(stats.net)}
                    </Text>
                    <Text style={{ color: isDark ? '#d8b4fe' : '#7e22ce' }} className="text-xs mt-1">
                      {savingsRate >= 0 ? `${savingsRate.toFixed(0)}% saved` : `${Math.abs(savingsRate).toFixed(0)}% overspent`}
                    </Text>
                  </View>
                  <View className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: isDark ? '#7e22ce40' : '#7e22ce20' }}>
                    <Ionicons name="save" size={20} color={isDark ? '#d8b4fe' : '#7e22ce'} />
                  </View>
                </View>
              </View>
            </View>

            {/* Category Breakdown */}
            {stats.categoryBreakdown.length > 0 && (
              <View style={{ backgroundColor: colors.card }} className="rounded-xl p-4 mb-4">
                <Text style={{ color: colors.text }} className="font-semibold mb-3">Top Spending Categories</Text>
                {stats.categoryBreakdown.slice(0, 5).map((cat, index) => {
                  const percentage = stats.expense > 0 ? (cat.amount / stats.expense) * 100 : 0;
                  return (
                    <View key={cat.name} className="mb-3">
                      <View className="flex-row items-center justify-between mb-1">
                        <View className="flex-row items-center flex-1">
                          <View
                            className="w-3 h-3 rounded-full mr-2"
                            style={{ backgroundColor: cat.color || CATEGORY_COLORS[index % CATEGORY_COLORS.length] }}
                          />
                          <Text style={{ color: colors.text }} className="text-sm flex-1" numberOfLines={1}>{cat.name}</Text>
                        </View>
                        <Text style={{ color: colors.text }} className="text-sm font-medium ml-2">
                          {formatCurrency(cat.amount)}
                        </Text>
                      </View>
                      <View className="flex-row items-center">
                        <View className="flex-1 h-2 rounded-full overflow-hidden mr-2" style={{ backgroundColor: isDark ? '#374151' : '#e5e7eb' }}>
                          <View
                            className="h-full rounded-full"
                            style={{
                              width: `${percentage}%`,
                              backgroundColor: cat.color || CATEGORY_COLORS[index % CATEGORY_COLORS.length],
                            }}
                          />
                        </View>
                        <Text style={{ color: colors.textMuted }} className="text-xs w-10 text-right">{percentage.toFixed(0)}%</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Monthly Trends */}
            {trends && trends.length > 0 && (
              <View style={{ backgroundColor: colors.card }} className="rounded-xl p-4 mb-4">
                <Text style={{ color: colors.text }} className="font-semibold mb-3">Monthly Overview</Text>
                <View className="flex-row justify-between items-end h-32">
                  {trends.slice(-6).map((month: any, index: number) => {
                    const maxAmount = Math.max(...trends.slice(-6).map((m: any) => Math.max(m.income || 0, m.expense || 0)));
                    const incomeHeight = maxAmount > 0 ? ((month.income || 0) / maxAmount) * 100 : 0;
                    const expenseHeight = maxAmount > 0 ? ((month.expense || 0) / maxAmount) * 100 : 0;
                    const periodDate = month.period ? month.period + '-01' : new Date().toISOString().slice(0, 10);
                    return (
                      <View key={index} className="items-center flex-1">
                        <View className="flex-row items-end h-24 gap-1">
                          <View
                            className="w-3 bg-green-500 rounded-t"
                            style={{ height: `${Math.max(incomeHeight, 4)}%` }}
                          />
                          <View
                            className="w-3 bg-red-500 rounded-t"
                            style={{ height: `${Math.max(expenseHeight, 4)}%` }}
                          />
                        </View>
                        <Text style={{ color: colors.textMuted }} className="text-xs mt-1">
                          {new Date(periodDate).toLocaleDateString('en-IN', { month: 'short' })}
                        </Text>
                      </View>
                    );
                  })}
                </View>
                <View className="flex-row justify-center gap-4 mt-3">
                  <View className="flex-row items-center">
                    <View className="w-3 h-3 bg-green-500 rounded mr-1" />
                    <Text style={{ color: colors.textMuted }} className="text-xs">Income</Text>
                  </View>
                  <View className="flex-row items-center">
                    <View className="w-3 h-3 bg-red-500 rounded mr-1" />
                    <Text style={{ color: colors.textMuted }} className="text-xs">Expense</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Recent Transactions */}
            <View style={{ backgroundColor: colors.card }} className="rounded-xl p-4 mb-4">
              <View className="flex-row items-center justify-between mb-3">
                <Text style={{ color: colors.text }} className="font-semibold">Recent Transactions</Text>
                <TouchableOpacity onPress={() => router.push('/(tabs)/transactions')}>
                  <Text className="text-sky-500 text-sm">View All</Text>
                </TouchableOpacity>
              </View>
              {(overview?.recentTransactions || []).slice(0, 5).map((txn: any) => (
                <View
                  key={txn._id}
                  className="flex-row items-center py-3 border-b"
                  style={{ borderColor: colors.border }}
                >
                  <View 
                    className="w-10 h-10 rounded-full items-center justify-center mr-3"
                    style={{ backgroundColor: txn.type === 'credit' ? '#14532d40' : '#7f1d1d40' }}
                  >
                    <Ionicons 
                      name={txn.type === 'credit' ? 'arrow-down' : 'arrow-up'} 
                      size={18} 
                      color={txn.type === 'credit' ? '#22c55e' : '#ef4444'} 
                    />
                  </View>
                  <View className="flex-1">
                    <Text style={{ color: colors.text }} className="font-medium" numberOfLines={1}>
                      {txn.description}
                    </Text>
                    <Text style={{ color: colors.textMuted }} className="text-xs">
                      {new Date(txn.transactionDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      {typeof txn.categoryId === 'object' && txn.categoryId?.name && ` · ${txn.categoryId.name}`}
                    </Text>
                  </View>
                  <Text className={`font-semibold ${txn.type === 'credit' ? 'text-green-500' : 'text-red-500'}`}>
                    {txn.type === 'credit' ? '+' : '-'}{formatCurrency(txn.amount)}
                  </Text>
                </View>
              ))}
              {(!overview?.recentTransactions || overview.recentTransactions.length === 0) && (
                <Text style={{ color: colors.textMuted }} className="text-center py-4">No recent transactions</Text>
              )}
            </View>
          </>
        )}

        {/* Accounts View */}
        {activeView === 'accounts' && (
          <>
            {sections.length === 0 ? (
              <View style={{ backgroundColor: colors.card }} className="rounded-xl p-8 items-center">
                <Ionicons name="wallet-outline" size={48} color={colors.textMuted} />
                <Text style={{ color: colors.textMuted }} className="mt-3 text-center">
                  No accounts found
                </Text>
              </View>
            ) : (
              sections.map((section: any) => {
                const accData = stats.accountBreakdown.find(a => a.name === section.name);
                const isSelected = selectedAccountId === section._id;
                return (
                  <TouchableOpacity
                    key={section._id}
                    style={{ 
                      backgroundColor: colors.card,
                      borderWidth: isSelected ? 2 : 0,
                      borderColor: '#0ea5e9',
                    }}
                    className="rounded-xl p-4 mb-3"
                    onPress={() => setSelectedAccountId(isSelected ? '' : section._id)}
                  >
                    <View className="flex-row items-start justify-between mb-3">
                      <View className="flex-row items-center">
                        <View 
                          className="w-12 h-12 rounded-full items-center justify-center mr-3"
                          style={{ backgroundColor: section.type === 'credit' ? '#f9731620' : '#0ea5e920' }}
                        >
                          <Ionicons 
                            name={(SECTION_ICONS[section.type] || 'wallet-outline') as any}
                            size={24}
                            color={section.type === 'credit' ? '#f97316' : '#0ea5e9'}
                          />
                        </View>
                        <View>
                          <Text style={{ color: colors.text }} className="font-semibold text-lg">{section.name}</Text>
                          <Text style={{ color: colors.textMuted }} className="text-xs capitalize">
                            {section.type?.replace('_', ' ')}
                          </Text>
                        </View>
                      </View>
                      <View 
                        className="px-2 py-1 rounded-full"
                        style={{ backgroundColor: section.type === 'credit' && section.balance > 0 ? '#7f1d1d40' : '#14532d40' }}
                      >
                        <Text 
                          className="text-xs font-medium"
                          style={{ color: section.type === 'credit' && section.balance > 0 ? '#ef4444' : '#22c55e' }}
                        >
                          {section.type === 'credit' && section.balance > 0 ? 'Due' : 'Balance'}
                        </Text>
                      </View>
                    </View>

                    <Text 
                      className="text-2xl font-bold mb-3"
                      style={{ 
                        color: section.type === 'credit' && section.balance > 0 ? '#ef4444' : colors.text 
                      }}
                    >
                      {section.type === 'credit' && section.balance > 0 ? '-' : ''}
                      {formatCurrency(Math.abs(section.balance || 0))}
                    </Text>

                    {accData && (
                      <View className="flex-row pt-3 border-t" style={{ borderColor: colors.border }}>
                        <View className="flex-1">
                          <Text style={{ color: colors.textMuted }} className="text-xs">Income</Text>
                          <Text className="text-green-500 font-semibold">+{formatShortCurrency(accData.income)}</Text>
                        </View>
                        <View className="flex-1">
                          <Text style={{ color: colors.textMuted }} className="text-xs">Expense</Text>
                          <Text className="text-red-500 font-semibold">-{formatShortCurrency(accData.expense)}</Text>
                        </View>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </>
        )}

        {/* Categories View */}
        {activeView === 'categories' && (
          <>
            {stats.categoryBreakdown.length === 0 ? (
              <View style={{ backgroundColor: colors.card }} className="rounded-xl p-8 items-center">
                <Ionicons name="pie-chart-outline" size={48} color={colors.textMuted} />
                <Text style={{ color: colors.textMuted }} className="mt-3 text-center">
                  No expense data for the selected period
                </Text>
                <Text style={{ color: colors.textMuted }} className="text-xs mt-1 text-center">
                  Try changing the filters
                </Text>
              </View>
            ) : (
              stats.categoryBreakdown.map((cat, idx) => {
                const percentage = stats.expense > 0 ? (cat.amount / stats.expense) * 100 : 0;
                const catObj = categories.find((c: any) => c.name === cat.name);
                const isSelected = catObj && selectedCategoryId === catObj._id;
                return (
                  <TouchableOpacity
                    key={cat.name}
                    style={{ 
                      backgroundColor: colors.card,
                      borderWidth: isSelected ? 2 : 0,
                      borderColor: '#0ea5e9',
                    }}
                    className="rounded-xl p-4 mb-3"
                    onPress={() => {
                      if (catObj) {
                        setSelectedCategoryId(isSelected ? '' : catObj._id);
                      }
                    }}
                  >
                    <View className="flex-row items-center justify-between mb-2">
                      <View className="flex-row items-center flex-1">
                        <View
                          className="w-4 h-4 rounded-full mr-3"
                          style={{ backgroundColor: cat.color || CATEGORY_COLORS[idx % CATEGORY_COLORS.length] }}
                        />
                        <Text style={{ color: colors.text }} className="font-semibold flex-1" numberOfLines={1}>
                          {cat.name}
                        </Text>
                      </View>
                      <Text style={{ color: colors.text }} className="font-bold text-lg">
                        {formatCurrency(cat.amount)}
                      </Text>
                    </View>

                    <View className="flex-row items-center justify-between mb-2">
                      <Text style={{ color: colors.textMuted }} className="text-xs">
                        {cat.count} transactions
                      </Text>
                      <Text style={{ color: colors.textMuted }} className="text-xs">
                        {percentage.toFixed(1)}% of total
                      </Text>
                    </View>

                    <View className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: isDark ? '#374151' : '#e5e7eb' }}>
                      <View
                        className="h-full rounded-full"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: cat.color || CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
                        }}
                      />
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </>
        )}

        {/* Quick Actions */}
        <View className="flex-row gap-3 mb-6 mt-4">
          <TouchableOpacity
            style={{ backgroundColor: colors.card }}
            className="flex-1 rounded-xl p-4 items-center"
            onPress={() => router.push('/(tabs)/transactions')}
          >
            <View className="w-12 h-12 bg-sky-100 rounded-full items-center justify-center mb-2">
              <Ionicons name="add-circle" size={24} color="#0ea5e9" />
            </View>
            <Text style={{ color: colors.text }} className="font-medium">Add</Text>
            <Text style={{ color: colors.textMuted }} className="text-xs">Transaction</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ backgroundColor: colors.card }}
            className="flex-1 rounded-xl p-4 items-center"
            onPress={() => router.push('/(tabs)/trips')}
          >
            <View className="w-12 h-12 bg-purple-100 rounded-full items-center justify-center mb-2">
              <Ionicons name="airplane" size={24} color="#8b5cf6" />
            </View>
            <Text style={{ color: colors.text }} className="font-medium">Trips</Text>
            <Text style={{ color: colors.textMuted }} className="text-xs">Split Expenses</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ backgroundColor: colors.card }}
            className="flex-1 rounded-xl p-4 items-center"
            onPress={() => router.push('/(tabs)/categories')}
          >
            <View className="w-12 h-12 bg-orange-100 rounded-full items-center justify-center mb-2">
              <Ionicons name="pricetags" size={24} color="#f97316" />
            </View>
            <Text style={{ color: colors.text }} className="font-medium">Categories</Text>
            <Text style={{ color: colors.textMuted }} className="text-xs">Manage</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Modal */}
      <Modal visible={showFilters} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <View style={{ backgroundColor: colors.card }} className="rounded-t-3xl max-h-[85%]">
            <View style={{ borderBottomColor: colors.border }} className="flex-row items-center justify-between p-4 border-b">
              <Text style={{ color: colors.text }} className="text-lg font-semibold">Filter Dashboard</Text>
              <View className="flex-row items-center gap-3">
                {hasActiveFilters && (
                  <TouchableOpacity onPress={resetFilters}>
                    <Text className="text-sky-500 text-sm">Reset</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setShowFilters(false)}>
                  <Ionicons name="close" size={24} color={colors.icon} />
                </TouchableOpacity>
              </View>
            </View>
            <ScrollView className="p-4">
              {/* Period Selection */}
              <View className="mb-4">
                <Text style={{ color: colors.text }} className="text-sm font-medium mb-2">Time Period</Text>
                <View className="flex-row flex-wrap gap-2">
                  {PERIOD_OPTIONS.map(option => (
                    <TouchableOpacity
                      key={option.value}
                      className="px-3 py-2 rounded-lg"
                      style={{
                        backgroundColor: selectedPeriod === option.value
                          ? (isDark ? '#0c4a6e' : '#e0f2fe')
                          : (isDark ? '#374151' : '#f3f4f6'),
                        borderWidth: selectedPeriod === option.value ? 1 : 0,
                        borderColor: '#0ea5e9',
                      }}
                      onPress={() => setSelectedPeriod(option.value)}
                    >
                      <Text
                        style={{ color: selectedPeriod === option.value ? '#0ea5e9' : colors.text }}
                        className={selectedPeriod === option.value ? 'font-medium' : ''}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Custom Date Range */}
              {selectedPeriod === 'custom' && (
                <View className="mb-4">
                  <View className="flex-row gap-3">
                    <View className="flex-1">
                      <Text style={{ color: colors.text }} className="text-sm font-medium mb-1">Start Date</Text>
                      <TouchableOpacity
                        className="rounded-lg px-4 py-3 flex-row items-center justify-between"
                        style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6' }}
                        onPress={() => setShowStartDatePicker(true)}
                      >
                        <Text style={{ color: colors.text }}>
                          {startDate.toLocaleDateString('en-IN')}
                        </Text>
                        <Ionicons name="calendar-outline" size={18} color={colors.icon} />
                      </TouchableOpacity>
                    </View>
                    <View className="flex-1">
                      <Text style={{ color: colors.text }} className="text-sm font-medium mb-1">End Date</Text>
                      <TouchableOpacity
                        className="rounded-lg px-4 py-3 flex-row items-center justify-between"
                        style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6' }}
                        onPress={() => setShowEndDatePicker(true)}
                      >
                        <Text style={{ color: colors.text }}>
                          {endDate.toLocaleDateString('en-IN')}
                        </Text>
                        <Ionicons name="calendar-outline" size={18} color={colors.icon} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}

              {showStartDatePicker && (
                <DateTimePicker
                  value={startDate}
                  mode="date"
                  onChange={(event, date) => {
                    setShowStartDatePicker(false);
                    if (date) setStartDate(date);
                  }}
                />
              )}
              {showEndDatePicker && (
                <DateTimePicker
                  value={endDate}
                  mode="date"
                  onChange={(event, date) => {
                    setShowEndDatePicker(false);
                    if (date) setEndDate(date);
                  }}
                />
              )}

              {/* Account Filter */}
              <View className="mb-4">
                <Text style={{ color: colors.text }} className="text-sm font-medium mb-2">Account</Text>
                <View className="rounded-lg overflow-hidden" style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: isDark ? '#374151' : '#f9fafb' }}>
                  <Picker
                    selectedValue={selectedAccountId}
                    onValueChange={(value) => setSelectedAccountId(value)}
                    style={{ color: colors.text }}
                    dropdownIconColor={colors.icon}
                  >
                    <Picker.Item label="All Accounts" value="" color={isDark ? '#9ca3af' : '#6b7280'} />
                    {sections.map((s: any) => (
                      <Picker.Item key={s._id} label={s.name} value={s._id} color="#111827" />
                    ))}
                  </Picker>
                </View>
              </View>

              {/* Category Filter */}
              <View className="mb-4">
                <Text style={{ color: colors.text }} className="text-sm font-medium mb-2">Category</Text>
                <View className="rounded-lg overflow-hidden" style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: isDark ? '#374151' : '#f9fafb' }}>
                  <Picker
                    selectedValue={selectedCategoryId}
                    onValueChange={(value) => setSelectedCategoryId(value)}
                    style={{ color: colors.text }}
                    dropdownIconColor={colors.icon}
                  >
                    <Picker.Item label="All Categories" value="" color={isDark ? '#9ca3af' : '#6b7280'} />
                    {categories.map((c: any) => (
                      <Picker.Item key={c._id} label={c.name} value={c._id} color="#111827" />
                    ))}
                  </Picker>
                </View>
              </View>

              {/* Transaction Type */}
              <View className="mb-4">
                <Text style={{ color: colors.text }} className="text-sm font-medium mb-2">Transaction Type</Text>
                <View className="flex-row gap-2">
                  {[
                    { value: 'all', label: 'All' },
                    { value: 'credit', label: 'Income' },
                    { value: 'debit', label: 'Expense' },
                  ].map(opt => (
                    <TouchableOpacity
                      key={opt.value}
                      className="flex-1 py-3 rounded-lg items-center"
                      style={{
                        backgroundColor: transactionType === opt.value
                          ? (isDark ? '#0c4a6e' : '#e0f2fe')
                          : (isDark ? '#374151' : '#f3f4f6'),
                        borderWidth: transactionType === opt.value ? 1 : 0,
                        borderColor: '#0ea5e9',
                      }}
                      onPress={() => setTransactionType(opt.value as any)}
                    >
                      <Text
                        style={{ color: transactionType === opt.value ? '#0ea5e9' : colors.text }}
                        className={transactionType === opt.value ? 'font-medium' : ''}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Apply Button */}
              <TouchableOpacity
                className="py-4 rounded-xl items-center bg-sky-500 mb-6"
                onPress={() => setShowFilters(false)}
              >
                <Text className="text-white font-semibold text-lg">Apply Filters</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
