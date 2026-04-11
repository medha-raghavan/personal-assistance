import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Alert,
  Modal,
  FlatList,
  Share,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { tripService, Trip, TripMember, TripExpense } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../components/ThemeProvider';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

type TabType = 'expenses' | 'breakdown' | 'members' | 'balances';

export default function TripDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { isDark, colors } = useTheme();
  const [activeTab, setActiveTab] = useState<TabType>('expenses');
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [newMemberNames, setNewMemberNames] = useState('');
  const [isAddingMembers, setIsAddingMembers] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    description: '',
    amount: '',
    paidByMemberId: '',
    splitType: 'equal' as 'equal' | 'exact',
    selectedMembers: [] as string[],
    customSplits: {} as Record<string, string>,
    category: '',
  });
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showEditExpense, setShowEditExpense] = useState(false);
  const [editingExpense, setEditingExpense] = useState<TripExpense | null>(null);
  const [editExpenseForm, setEditExpenseForm] = useState({
    description: '',
    amount: '',
    paidByMemberId: '',
    splitType: 'equal' as 'equal' | 'exact',
    selectedMembers: [] as string[],
    customSplits: {} as Record<string, string>,
    category: '',
    date: new Date(),
  });
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);

  const { data: trip, isLoading: tripLoading, refetch: refetchTrip } = useQuery({
    queryKey: ['trip', id],
    queryFn: () => tripService.getById(id!),
    enabled: !!id,
  });

  const { data: expenses = [], refetch: refetchExpenses } = useQuery({
    queryKey: ['trip-expenses', id],
    queryFn: () => tripService.getExpenses(id!),
    enabled: !!id,
  });

  const { data: linkedTransactions = [], refetch: refetchLinkedTransactions } = useQuery({
    queryKey: ['trip-linked-transactions', id],
    queryFn: () => tripService.getLinkedTransactions(id!),
    enabled: !!id,
  });

  const { data: balances, refetch: refetchBalances } = useQuery({
    queryKey: ['trip-balances', id],
    queryFn: () => tripService.getBalances(id!),
    enabled: !!id,
  });

  const addMemberMutation = useMutation({
    mutationFn: (member: { name: string; email?: string }) =>
      tripService.addMember(id!, { ...member, isRegisteredUser: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trip', id] });
      queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to add member');
    },
  });

  const handleAddMultipleMembers = async () => {
    const names = newMemberNames
      .split(/[,\n]/)
      .map(name => name.trim())
      .filter(name => name.length > 0);

    if (names.length === 0) {
      Alert.alert('Error', 'Please enter at least one name');
      return;
    }

    setIsAddingMembers(true);
    try {
      for (const name of names) {
        await tripService.addMember(id!, { name, isRegisteredUser: false });
      }
      queryClient.invalidateQueries({ queryKey: ['trip', id] });
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      setShowAddMember(false);
      setNewMemberNames('');
      Alert.alert('Success', `Added ${names.length} member${names.length > 1 ? 's' : ''}`);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to add members');
    } finally {
      setIsAddingMembers(false);
    }
  };

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) => tripService.removeMember(id!, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trip', id] });
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      Alert.alert('Success', 'Member removed');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to remove member');
    },
  });

  const addExpenseMutation = useMutation({
    mutationFn: (data: any) => tripService.addExpense(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trip-expenses', id] });
      queryClient.invalidateQueries({ queryKey: ['trip-balances', id] });
      setShowAddExpense(false);
      resetExpenseForm();
      Alert.alert('Success', 'Expense added');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to add expense');
    },
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: (expenseId: string) => tripService.deleteExpense(id!, expenseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trip-expenses', id] });
      queryClient.invalidateQueries({ queryKey: ['trip-balances', id] });
      Alert.alert('Success', 'Expense deleted');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to delete expense');
    },
  });

  const updateExpenseMutation = useMutation({
    mutationFn: ({ expenseId, data }: { expenseId: string; data: any }) =>
      tripService.updateExpense(id!, expenseId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trip-expenses', id] });
      queryClient.invalidateQueries({ queryKey: ['trip-balances', id] });
      setShowEditExpense(false);
      setEditingExpense(null);
      Alert.alert('Success', 'Expense updated');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to update expense');
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: (status: 'active' | 'completed' | 'cancelled') =>
      tripService.update(id!, { status }),
    onSuccess: (_, status) => {
      queryClient.invalidateQueries({ queryKey: ['trip', id] });
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      Alert.alert('Success', `Trip marked as ${status}`);
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to update trip status');
    },
  });

  const handleStatusChange = (newStatus: 'active' | 'completed' | 'cancelled') => {
    const statusLabels = {
      active: 'Active',
      completed: 'Completed',
      cancelled: 'Cancelled',
    };
    Alert.alert(
      'Change Trip Status',
      `Are you sure you want to mark this trip as "${statusLabels[newStatus]}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => updateStatusMutation.mutate(newStatus),
        },
      ]
    );
  };

  const resetExpenseForm = () => {
    setExpenseForm({
      description: '',
      amount: '',
      paidByMemberId: '',
      splitType: 'equal',
      selectedMembers: [],
      customSplits: {},
      category: '',
    });
  };

  const isCurrentUser = (member: TripMember): boolean => {
    if (!user) return false;
    const userName = user.name.toLowerCase();
    const userEmail = user.email.toLowerCase();
    const memberName = member.name.toLowerCase();
    const memberEmail = member.email?.toLowerCase() || '';
    return memberName === userName || memberEmail === userEmail;
  };

  // Helper function to get member name by ID
  const getMemberName = (memberId: string): string => {
    if (!trip?.members) return 'Unknown';
    const member = trip.members.find((m: TripMember) => m._id === memberId);
    return member?.name || 'Unknown';
  };

  const handleAddExpense = () => {
    if (!expenseForm.description.trim()) {
      Alert.alert('Error', 'Please enter a description');
      return;
    }
    if (!expenseForm.amount || parseFloat(expenseForm.amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    if (!expenseForm.paidByMemberId) {
      Alert.alert('Error', 'Please select who paid');
      return;
    }
    if (expenseForm.selectedMembers.length === 0) {
      Alert.alert('Error', 'Please select members to split with');
      return;
    }

    const amount = parseFloat(expenseForm.amount);

    if (expenseForm.splitType === 'exact') {
      const customSplitsTotal = expenseForm.selectedMembers.reduce(
        (sum, memberId) => sum + (parseFloat(expenseForm.customSplits[memberId] || '0')),
        0
      );
      if (Math.abs(customSplitsTotal - amount) > 0.01) {
        Alert.alert('Error', `Split total (₹${customSplitsTotal.toFixed(2)}) must equal expense amount (₹${amount.toFixed(2)})`);
        return;
      }
    }

    let splits;
    
    if (expenseForm.splitType === 'equal') {
      const splitAmount = amount / expenseForm.selectedMembers.length;
      splits = expenseForm.selectedMembers.map((memberId) => {
        const member = trip?.members.find((m) => m._id === memberId);
        return {
          memberId,
          memberName: member?.name || '',
          amount: splitAmount,
        };
      });
    } else {
      splits = expenseForm.selectedMembers.map((memberId) => {
        const member = trip?.members.find((m) => m._id === memberId);
        return {
          memberId,
          memberName: member?.name || '',
          amount: parseFloat(expenseForm.customSplits[memberId] || '0'),
        };
      });
    }

    addExpenseMutation.mutate({
      description: expenseForm.description,
      amount,
      paidByMemberId: expenseForm.paidByMemberId,
      splitType: expenseForm.splitType,
      splits,
      date: new Date().toISOString(),
      category: expenseForm.category || 'Other',
    });
  };

  const handleDeleteExpense = (expense: TripExpense) => {
    Alert.alert('Delete Expense', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteExpenseMutation.mutate(expense._id),
      },
    ]);
  };

  const handleEditExpense = (expense: TripExpense) => {
    setEditingExpense(expense);
    const customSplits: Record<string, string> = {};
    expense.splits.forEach(s => {
      customSplits[s.memberId.toString()] = s.amount.toString();
    });
    setEditExpenseForm({
      description: expense.description,
      amount: expense.amount.toString(),
      paidByMemberId: expense.paidByMemberId?.toString() || '',
      splitType: expense.splitType,
      selectedMembers: expense.splits.map(s => s.memberId.toString()),
      customSplits,
      category: expense.category || '',
      date: new Date(expense.date),
    });
    setShowEditExpense(true);
  };

  const handleSaveEditExpense = () => {
    if (!editingExpense || !trip) return;

    const amount = parseFloat(editExpenseForm.amount);
    if (!editExpenseForm.description.trim() || isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Please enter valid description and amount');
      return;
    }
    if (!editExpenseForm.paidByMemberId) {
      Alert.alert('Error', 'Please select who paid');
      return;
    }
    if (editExpenseForm.selectedMembers.length === 0) {
      Alert.alert('Error', 'Please select at least one member to split with');
      return;
    }

    if (editExpenseForm.splitType === 'exact') {
      const customSplitsTotal = editExpenseForm.selectedMembers.reduce(
        (sum, memberId) => sum + (parseFloat(editExpenseForm.customSplits[memberId] || '0')),
        0
      );
      if (Math.abs(customSplitsTotal - amount) > 0.01) {
        Alert.alert('Error', `Split total (₹${customSplitsTotal.toFixed(2)}) must equal expense amount (₹${amount.toFixed(2)})`);
        return;
      }
    }

    let splits;
    if (editExpenseForm.splitType === 'equal') {
      const splitAmount = amount / editExpenseForm.selectedMembers.length;
      splits = editExpenseForm.selectedMembers.map(memberId => {
        const member = trip.members.find(m => m._id === memberId);
        return {
          memberId,
          memberName: member?.name || '',
          amount: splitAmount,
        };
      });
    } else {
      splits = editExpenseForm.selectedMembers.map(memberId => {
        const member = trip.members.find(m => m._id === memberId);
        return {
          memberId,
          memberName: member?.name || '',
          amount: parseFloat(editExpenseForm.customSplits[memberId] || '0'),
        };
      });
    }

    updateExpenseMutation.mutate({
      expenseId: editingExpense._id,
      data: {
        description: editExpenseForm.description,
        amount,
        paidByMemberId: editExpenseForm.paidByMemberId,
        splitType: editExpenseForm.splitType,
        splits,
        selectedMemberIds: editExpenseForm.selectedMembers,
        date: editExpenseForm.date.toISOString(),
        category: editExpenseForm.category,
      },
    });
  };

  const handleRemoveMember = (member: TripMember) => {
    Alert.alert('Remove Member', `Remove ${member.name} from this trip?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => removeMemberMutation.mutate(member._id!),
      },
    ]);
  };

  const refetchAll = () => {
    refetchTrip();
    refetchExpenses();
    refetchLinkedTransactions();
    refetchBalances();
  };

  // Export trip data to CSV
  const exportToCSV = async () => {
    if (!trip) return;

    try {
      const memberNames = trip.members.map(m => m.name);
      const headers = ['Date', 'Description', 'Category', 'Cost', 'Currency', ...memberNames];
      const rows: string[][] = [];

      // Format date as YYYY-MM-DD
      const formatDateForExport = (dateStr: string): string => {
        const date = new Date(dateStr);
        return date.toISOString().split('T')[0];
      };

      // Track totals for each member
      const memberTotals: Record<string, number> = {};
      trip.members.forEach(m => { memberTotals[m._id!] = 0; });

      // Combine expenses and linked transactions for export
      const allItems = [
        ...expenses.map(e => ({
          type: 'expense' as const,
          date: e.date,
          description: e.description,
          category: e.category || '',
          amount: e.amount,
          currency: e.currency || trip.defaultCurrency,
          paidByMemberId: e.paidByMemberId,
          splits: e.splits,
        })),
        ...linkedTransactions.map((t: any) => ({
          type: 'linked' as const,
          date: t.transactionDate,
          description: t.description,
          category: 'Linked',
          amount: t.amount,
          currency: trip.defaultCurrency,
          paidByMemberId: t.paidByMemberId,
          splits: t.tripSplits,
        })),
      ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Add expense rows
      allItems.forEach(item => {
        const getMemberSplit = (memberId: string): number => {
          if (!item.splits) return 0;
          const split = item.splits.find((s: any) => s.memberId === memberId);
          return split ? split.amount : 0;
        };

        const memberValues = trip.members.map(member => {
          const memberShare = getMemberSplit(member._id!);
          const isPayer = member._id === item.paidByMemberId;
          const netAmount = isPayer ? item.amount - memberShare : -memberShare;
          memberTotals[member._id!] += netAmount;
          return netAmount.toFixed(2);
        });

        rows.push([
          formatDateForExport(item.date),
          item.description,
          item.category,
          item.amount.toFixed(2),
          item.currency,
          ...memberValues,
        ]);
      });

      // Add empty row before total
      rows.push([]);

      // Add total balance row with today's date
      const today = new Date().toISOString().split('T')[0];
      const totalRow = [
        today,
        'Total balance',
        '',
        '',
        trip.defaultCurrency,
        ...trip.members.map(m => memberTotals[m._id!].toFixed(2)),
      ];
      rows.push(totalRow);

      // Add empty row at end
      rows.push([]);

      // Build CSV content
      const csvContent = [
        headers.join(','),
        '',
        ...rows.map(r => r.join(',')),
      ].join('\n');

      // Create file and share
      const fileName = `${trip.name.replace(/\s+/g, '_')}_breakdown.csv`;
      const filePath = `${FileSystem.cacheDirectory}${fileName}`;
      
      await FileSystem.writeAsStringAsync(filePath, csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filePath, {
          mimeType: 'text/csv',
          dialogTitle: `Export ${trip.name}`,
        });
      } else {
        // Fallback for platforms without sharing
        Alert.alert('Export', 'File saved. Sharing is not available on this device.');
      }
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Error', 'Failed to export trip data');
    }
  };

  if (tripLoading) {
    return (
      <View style={{ backgroundColor: colors.background }} className="flex-1 items-center justify-center">
        <Text style={{ color: colors.textMuted }}>Loading...</Text>
      </View>
    );
  }

  if (!trip) {
    return (
      <View style={{ backgroundColor: colors.background }} className="flex-1 items-center justify-center p-4">
        <Ionicons name="alert-circle-outline" size={48} color={colors.textMuted} />
        <Text style={{ color: colors.textMuted }} className="mt-4">Trip not found</Text>
        <TouchableOpacity
          className="mt-4 bg-sky-500 px-6 py-3 rounded-lg"
          onPress={() => router.back()}
        >
          <Text className="text-white font-medium">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Calculate totals including linked transactions
  const expenseTotal = expenses.reduce((sum, e) => sum + e.amount, 0);
  const linkedTotal = linkedTransactions.reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
  const totalExpenses = expenseTotal + linkedTotal;

  // Combine expenses and linked transactions for display
  type ExpenseItem = {
    type: 'expense' | 'linked';
    id: string;
    description: string;
    amount: number;
    paidByMemberName: string;
    date: string;
    category: string;
    splits?: { memberId: string; memberName: string; amount: number }[];
    original: any;
  };

  const allExpenseItems: ExpenseItem[] = [
    ...expenses.map(e => ({
      type: 'expense' as const,
      id: e._id,
      description: e.description,
      amount: e.amount,
      paidByMemberName: e.paidByMemberName,
      date: e.date,
      category: e.category || '',
      splits: e.splits,
      original: e,
    })),
    ...linkedTransactions.map((t: any) => ({
      type: 'linked' as const,
      id: t._id,
      description: t.description,
      amount: t.amount,
      paidByMemberName: t.paidByMemberName || 'Unknown',
      date: t.transactionDate,
      category: 'Linked Transaction',
      splits: t.tripSplits,
      original: t,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Helper for status colors
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'active':
        return { bg: isDark ? '#166534' : '#dcfce7', text: '#22c55e', label: 'Active' };
      case 'completed':
        return { bg: isDark ? '#1e40af' : '#dbeafe', text: '#3b82f6', label: 'Completed' };
      case 'cancelled':
        return { bg: isDark ? '#7f1d1d' : '#fee2e2', text: '#ef4444', label: 'Cancelled' };
      default:
        return { bg: isDark ? '#374151' : '#f3f4f6', text: '#6b7280', label: status };
    }
  };

  const statusStyle = getStatusStyle(trip.status);

  return (
    <View style={{ backgroundColor: colors.background }} className="flex-1">
      <Stack.Screen
        options={{
          title: trip.name,
          headerBackTitle: 'Trips',
          headerStyle: { backgroundColor: isDark ? '#1f2937' : 'white' },
          headerTintColor: colors.text,
          headerRight: () => (
            <TouchableOpacity
              className="mr-4"
              onPress={() => setShowStatusMenu(true)}
            >
              <Ionicons name="ellipsis-vertical" size={22} color={colors.text} />
            </TouchableOpacity>
          ),
        }}
      />

      {/* Summary Header */}
      <View style={{ backgroundColor: colors.card, borderBottomColor: colors.border }} className="p-4 border-b">
        {/* Status Badge */}
        <View className="flex-row items-center justify-between mb-3">
          <TouchableOpacity
            className="flex-row items-center px-3 py-1.5 rounded-full"
            style={{ backgroundColor: statusStyle.bg }}
            onPress={() => setShowStatusMenu(true)}
          >
            <View className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: statusStyle.text }} />
            <Text style={{ color: statusStyle.text }} className="text-sm font-medium">{statusStyle.label}</Text>
            <Ionicons name="chevron-down" size={14} color={statusStyle.text} style={{ marginLeft: 4 }} />
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-row items-center px-3 py-2 rounded-lg"
            style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6' }}
            onPress={exportToCSV}
          >
            <Ionicons name="download-outline" size={18} color={colors.icon} />
            <Text style={{ color: colors.text }} className="ml-1 text-sm font-medium">Export</Text>
          </TouchableOpacity>
        </View>
        
        <View className="flex-row justify-between items-center">
          <View>
            <Text style={{ color: colors.textMuted }} className="text-sm">Total Expenses</Text>
            <Text style={{ color: colors.text }} className="text-2xl font-bold">
              {formatCurrency(totalExpenses)}
            </Text>
          </View>
          <View className="items-end">
            <Text style={{ color: colors.textMuted }} className="text-sm">{trip.members.length} members</Text>
            <Text style={{ color: colors.textMuted }} className="text-xs">
              {expenses.length} expense{expenses.length !== 1 ? 's' : ''} + {linkedTransactions.length} linked
            </Text>
            {trip.endDate && (
              <Text style={{ color: colors.textMuted }} className="text-xs mt-1">
                Ends: {formatDate(trip.endDate)}
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={{ backgroundColor: colors.card, borderBottomColor: colors.border }} className="flex-row border-b">
        {(['expenses', 'breakdown', 'members', 'balances'] as TabType[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            className={`flex-1 py-3 items-center ${
              activeTab === tab ? 'border-b-2 border-sky-500' : ''
            }`}
            onPress={() => setActiveTab(tab)}
          >
            <Text
              className={`font-medium capitalize ${
                activeTab === tab ? 'text-sky-600' : ''
              }`}
              style={activeTab !== tab ? { color: colors.textMuted } : {}}
            >
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        className="flex-1"
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetchAll} />}
      >
        {activeTab === 'expenses' && (
          <View className="p-4">
            {allExpenseItems.length === 0 ? (
              <View className="items-center py-12">
                <Ionicons name="receipt-outline" size={48} color={colors.textMuted} />
                <Text style={{ color: colors.textMuted }} className="mt-4">No expenses yet</Text>
              </View>
            ) : (
              allExpenseItems.map((item) => (
                <View key={item.id} style={{ backgroundColor: colors.card }} className="rounded-xl p-4 mb-3 shadow-sm">
                  <View className="flex-row justify-between items-start">
                    <View className="flex-1">
                      <View className="flex-row items-center">
                        <Text style={{ color: colors.text }} className="font-medium">{item.description}</Text>
                        {item.type === 'linked' && (
                          <View className="ml-2 px-2 py-0.5 rounded" style={{ backgroundColor: isDark ? '#0c4a6e' : '#e0f2fe' }}>
                            <Text className="text-xs text-sky-600">Linked</Text>
                          </View>
                        )}
                      </View>
                      <Text style={{ color: colors.textMuted }} className="text-sm mt-1">
                        Paid by {item.paidByMemberName}
                      </Text>
                      <Text style={{ color: colors.textMuted }} className="text-xs mt-1">
                        {formatDate(item.date)} • {item.category}
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text style={{ color: colors.text }} className="font-bold text-lg">
                        {formatCurrency(item.amount)}
                      </Text>
                      {item.type === 'expense' && (
                        <View className="flex-row mt-2 gap-2">
                          <TouchableOpacity
                            className="p-1"
                            onPress={() => handleEditExpense(item.original)}
                          >
                            <Ionicons name="pencil-outline" size={18} color={colors.icon} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            className="p-1"
                            onPress={() => handleDeleteExpense(item.original)}
                          >
                            <Ionicons name="trash-outline" size={18} color="#ef4444" />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </View>
                  {item.splits && item.splits.length > 0 && (
                    <View className="mt-3 pt-3 border-t" style={{ borderTopColor: colors.border }}>
                      <Text style={{ color: colors.textMuted }} className="text-xs mb-2">Split between:</Text>
                      <View className="flex-row flex-wrap gap-2">
                        {item.splits.map((split) => (
                          <View
                            key={split.memberId}
                            className="rounded-full px-2 py-1"
                            style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6' }}
                          >
                            <Text style={{ color: colors.textSecondary }} className="text-xs">
                              {split.memberName}: {formatCurrency(split.amount)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              ))
            )}
          </View>
        )}

        {activeTab === 'breakdown' && (
          <View className="p-4">
            <View style={{ backgroundColor: colors.card }} className="rounded-xl shadow-sm overflow-hidden">
              <View className="p-4 border-b" style={{ borderBottomColor: colors.border }}>
                <Text style={{ color: colors.text }} className="font-semibold text-lg">Expense Breakdown</Text>
                <Text style={{ color: colors.textMuted }} className="text-sm">
                  What each member owes for each expense
                </Text>
              </View>

              {allExpenseItems.length === 0 ? (
                <View className="items-center py-12">
                  <Ionicons name="receipt-outline" size={48} color={colors.textMuted} />
                  <Text style={{ color: colors.textMuted }} className="mt-4">No expenses yet</Text>
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator>
                  <View>
                    {/* Table Header */}
                    <View className="flex-row" style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6' }}>
                      <View className="w-24 px-3 py-3 border-r" style={{ borderRightColor: colors.border }}>
                        <Text style={{ color: colors.textMuted }} className="text-xs font-medium">DATE</Text>
                      </View>
                      <View className="w-40 px-3 py-3 border-r" style={{ borderRightColor: colors.border }}>
                        <Text style={{ color: colors.textMuted }} className="text-xs font-medium">DESCRIPTION</Text>
                      </View>
                      <View className="w-24 px-3 py-3 border-r" style={{ borderRightColor: colors.border }}>
                        <Text style={{ color: colors.textMuted }} className="text-xs font-medium">CATEGORY</Text>
                      </View>
                      <View className="w-24 px-3 py-3 border-r" style={{ borderRightColor: colors.border }}>
                        <Text style={{ color: colors.textMuted }} className="text-xs font-medium text-right">COST</Text>
                      </View>
                      {trip.members.map((member) => (
                        <View
                          key={member._id}
                          className="w-28 px-3 py-3 border-r"
                          style={{
                            borderRightColor: colors.border,
                            backgroundColor: isCurrentUser(member) ? (isDark ? '#0c4a6e40' : '#e0f2fe') : undefined,
                          }}
                        >
                          <Text
                            style={{ color: isCurrentUser(member) ? '#0ea5e9' : colors.textMuted }}
                            className="text-xs font-medium text-right"
                            numberOfLines={1}
                          >
                            {member.name}
                          </Text>
                        </View>
                      ))}
                    </View>

                    {/* Table Body */}
                    {allExpenseItems.map((item) => {
                      const getMemberSplit = (memberId: string): number => {
                        if (!item.splits) return 0;
                        const split = item.splits.find(s => s.memberId === memberId);
                        return split ? split.amount : 0;
                      };

                      const paidByMemberId = item.type === 'expense'
                        ? item.original.paidByMemberId
                        : item.original.paidByMemberId;

                      return (
                        <View
                          key={item.id}
                          className="flex-row border-b"
                          style={{ borderBottomColor: colors.border }}
                        >
                          <View className="w-24 px-3 py-3 border-r justify-center" style={{ borderRightColor: colors.border }}>
                            <Text style={{ color: colors.text }} className="text-xs">
                              {new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            </Text>
                          </View>
                          <View className="w-40 px-3 py-3 border-r justify-center" style={{ borderRightColor: colors.border }}>
                            <Text style={{ color: colors.text }} className="text-xs" numberOfLines={2}>
                              {item.description}
                            </Text>
                            <Text style={{ color: colors.textMuted }} className="text-xs mt-0.5">
                              Paid by: {item.paidByMemberName}
                            </Text>
                          </View>
                          <View className="w-24 px-3 py-3 border-r justify-center" style={{ borderRightColor: colors.border }}>
                            <Text style={{ color: colors.textMuted }} className="text-xs" numberOfLines={1}>
                              {item.category || '-'}
                            </Text>
                          </View>
                          <View className="w-24 px-3 py-3 border-r justify-center" style={{ borderRightColor: colors.border }}>
                            <Text style={{ color: colors.text }} className="text-xs font-medium text-right">
                              {item.amount.toLocaleString()}
                            </Text>
                          </View>
                          {trip.members.map((member) => {
                            const memberShare = getMemberSplit(member._id!);
                            const isPayer = member._id === paidByMemberId;
                            const netAmount = isPayer ? item.amount - memberShare : -memberShare;

                            return (
                              <View
                                key={member._id}
                                className="w-28 px-3 py-3 border-r justify-center"
                                style={{
                                  borderRightColor: colors.border,
                                  backgroundColor: isCurrentUser(member) ? (isDark ? '#0c4a6e20' : '#e0f2fe50') : undefined,
                                }}
                              >
                                <Text
                                  className={`text-xs text-right font-medium ${
                                    netAmount > 0 ? 'text-green-500' : netAmount < 0 ? 'text-red-500' : ''
                                  }`}
                                  style={netAmount === 0 ? { color: colors.textMuted } : {}}
                                >
                                  {netAmount === 0 ? '0' : netAmount.toFixed(2)}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      );
                    })}

                    {/* Table Footer - Totals */}
                    <View className="flex-row" style={{ backgroundColor: isDark ? '#1f2937' : '#f9fafb' }}>
                      <View className="w-24 px-3 py-3 border-r" style={{ borderRightColor: colors.border }}>
                        <Text style={{ color: colors.text }} className="text-xs font-bold">TOTAL</Text>
                      </View>
                      <View className="w-40 px-3 py-3 border-r" style={{ borderRightColor: colors.border }} />
                      <View className="w-24 px-3 py-3 border-r" style={{ borderRightColor: colors.border }} />
                      <View className="w-24 px-3 py-3 border-r" style={{ borderRightColor: colors.border }}>
                        <Text style={{ color: colors.text }} className="text-xs font-bold text-right">
                          {totalExpenses.toLocaleString()}
                        </Text>
                      </View>
                      {trip.members.map((member) => {
                        let totalNet = 0;

                        allExpenseItems.forEach(item => {
                          const getMemberSplit = (memberId: string): number => {
                            if (!item.splits) return 0;
                            const split = item.splits.find(s => s.memberId === memberId);
                            return split ? split.amount : 0;
                          };

                          const paidByMemberId = item.type === 'expense'
                            ? item.original.paidByMemberId
                            : item.original.paidByMemberId;

                          const memberShare = getMemberSplit(member._id!);
                          const isPayer = member._id === paidByMemberId;

                          if (isPayer) {
                            totalNet += (item.amount - memberShare);
                          } else if (memberShare > 0) {
                            totalNet -= memberShare;
                          }
                        });

                        return (
                          <View
                            key={member._id}
                            className="w-28 px-3 py-3 border-r"
                            style={{
                              borderRightColor: colors.border,
                              backgroundColor: isCurrentUser(member) ? (isDark ? '#0c4a6e40' : '#e0f2fe') : undefined,
                            }}
                          >
                            <Text
                              className={`text-xs text-right font-bold ${
                                totalNet >= 0 ? 'text-green-500' : 'text-red-500'
                              }`}
                            >
                              {totalNet >= 0 ? '+' : ''}{totalNet.toFixed(2)}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                </ScrollView>
              )}
            </View>

            {/* Legend */}
            <View className="flex-row justify-center mt-4 gap-6">
              <View className="flex-row items-center">
                <View className="w-3 h-3 bg-green-500 rounded mr-2" />
                <Text style={{ color: colors.textMuted }} className="text-xs">Gets back</Text>
              </View>
              <View className="flex-row items-center">
                <View className="w-3 h-3 bg-red-500 rounded mr-2" />
                <Text style={{ color: colors.textMuted }} className="text-xs">Owes</Text>
              </View>
            </View>
          </View>
        )}

        {activeTab === 'members' && (
          <View className="p-4">
            {trip.members.map((member) => (
              <View key={member._id} style={{ backgroundColor: colors.card }} className="rounded-xl p-4 mb-3 shadow-sm flex-row items-center justify-between">
                <View className="flex-row items-center flex-1">
                  <View className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: isDark ? '#0c4a6e' : '#e0f2fe' }}>
                    <Text className="text-sky-600 font-bold">
                      {member.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View className="ml-3 flex-1">
                    <Text style={{ color: colors.text }} className="font-medium">
                      {member.name}
                      {isCurrentUser(member) && (
                        <Text className="text-sky-500"> (Me)</Text>
                      )}
                    </Text>
                    {member.email && (
                      <Text style={{ color: colors.textMuted }} className="text-sm">{member.email}</Text>
                    )}
                  </View>
                </View>
                {!isCurrentUser(member) && (
                  <TouchableOpacity
                    className="p-2"
                    onPress={() => handleRemoveMember(member)}
                  >
                    <Ionicons name="person-remove-outline" size={20} color="#ef4444" />
                  </TouchableOpacity>
                )}
              </View>
            ))}

            <TouchableOpacity
              className="rounded-xl p-4 border-2 border-dashed items-center"
              style={{ backgroundColor: colors.card, borderColor: colors.border }}
              onPress={() => setShowAddMember(true)}
            >
              <Ionicons name="person-add-outline" size={24} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted }} className="mt-2">Add Member</Text>
            </TouchableOpacity>
          </View>
        )}

        {activeTab === 'balances' && (
          <View className="p-4">
            {!balances ? (
              <View className="items-center py-12">
                <Ionicons name="hourglass-outline" size={48} color={colors.textMuted} />
                <Text style={{ color: colors.textMuted }} className="mt-4">Loading balances...</Text>
              </View>
            ) : !balances.memberBalances || balances.memberBalances.length === 0 ? (
              <View className="items-center py-12">
                <Ionicons name="calculator-outline" size={48} color={colors.textMuted} />
                <Text style={{ color: colors.textMuted }} className="mt-4">No balance data yet</Text>
                <Text style={{ color: colors.textMuted }} className="text-sm mt-1">Add some expenses to see balances</Text>
              </View>
            ) : (
              <>
                {balances.memberBalances.map((balance: any) => {
                  // Try to get the member name from the balance data or look it up from trip members
                  const displayName = balance.memberName || getMemberName(balance.memberId) || 'Unknown';
                  return (
                    <View key={balance.memberId} style={{ backgroundColor: colors.card }} className="rounded-xl p-4 mb-3 shadow-sm">
                      <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center">
                          <View className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: isDark ? '#0c4a6e' : '#e0f2fe' }}>
                            <Text className="text-sky-600 font-bold">
                              {displayName.charAt(0)?.toUpperCase() || '?'}
                            </Text>
                          </View>
                          <Text style={{ color: colors.text }} className="font-medium ml-3">{displayName}</Text>
                        </View>
                        <Text
                          className={`font-bold text-lg ${
                            (balance.balance || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {(balance.balance || 0) >= 0 ? '+' : ''}
                          {formatCurrency(balance.balance || 0)}
                        </Text>
                      </View>
                      <View className="flex-row justify-between mt-3 pt-3 border-t" style={{ borderTopColor: colors.border }}>
                        <View>
                          <Text style={{ color: colors.textMuted }} className="text-xs">Paid</Text>
                          <Text style={{ color: colors.text }}>{formatCurrency(balance.paid || 0)}</Text>
                        </View>
                        <View>
                          <Text style={{ color: colors.textMuted }} className="text-xs">Owes</Text>
                          <Text style={{ color: colors.text }}>{formatCurrency(balance.owes || 0)}</Text>
                        </View>
                      </View>
                    </View>
                  );
                })}

                {balances.settlements && balances.settlements.length > 0 && (
                  <View className="mt-4">
                    <Text style={{ color: colors.text }} className="font-semibold mb-3">Settlements</Text>
                    {balances.settlements.map((settlement: any, index: number) => {
                      // Backend returns: from (ID), fromName, to (ID), toName
                      // Use fromName/toName first, then lookup by from/to IDs if needed
                      const fromDisplayName = settlement.fromName || getMemberName(settlement.from) || 'Unknown';
                      const toDisplayName = settlement.toName || getMemberName(settlement.to) || 'Unknown';
                      return (
                        <View key={index} className="rounded-xl p-4 mb-2 flex-row items-center" style={{ backgroundColor: isDark ? '#422006' : '#fef9c3' }}>
                          <Ionicons name="arrow-forward" size={20} color="#f59e0b" />
                          <Text style={{ color: colors.text }} className="ml-2 flex-1">
                            <Text className="font-medium">{fromDisplayName}</Text>
                            {' pays '}
                            <Text className="font-medium">{toDisplayName}</Text>
                          </Text>
                          <Text className="text-yellow-600 font-bold">
                            {formatCurrency(settlement.amount || 0)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </>
            )}
          </View>
        )}
      </ScrollView>

      {/* FAB for adding expense */}
      {activeTab === 'expenses' && (
        <TouchableOpacity
          className="absolute bottom-6 right-6 w-14 h-14 bg-sky-500 rounded-full items-center justify-center shadow-lg"
          onPress={() => setShowAddExpense(true)}
        >
          <Ionicons name="add" size={28} color="white" />
        </TouchableOpacity>
      )}

      {/* Add Member Modal */}
      <Modal visible={showAddMember} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <View style={{ backgroundColor: colors.card }} className="rounded-t-3xl p-4">
            <View className="flex-row items-center justify-between mb-4">
              <Text style={{ color: colors.text }} className="text-lg font-semibold">Add Members</Text>
              <TouchableOpacity onPress={() => { setShowAddMember(false); setNewMemberNames(''); }}>
                <Ionicons name="close" size={24} color={colors.icon} />
              </TouchableOpacity>
            </View>

            <View className="mb-4">
              <Text style={{ color: colors.text }} className="text-sm font-medium mb-1">Names *</Text>
              <TextInput
                className="rounded-lg px-4 py-3"
                style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6', color: colors.text, minHeight: 100, textAlignVertical: 'top' }}
                placeholder="Enter names separated by comma or new line"
                placeholderTextColor={colors.textMuted}
                value={newMemberNames}
                onChangeText={setNewMemberNames}
                multiline
                numberOfLines={4}
              />
              <Text style={{ color: colors.textMuted }} className="text-xs mt-1">
                e.g., John, Jane, Bob or one name per line
              </Text>
            </View>

            {newMemberNames.trim() && (
              <View className="mb-4 p-3 rounded-lg" style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6' }}>
                <Text style={{ color: colors.textSecondary }} className="text-sm mb-2">
                  Members to add ({newMemberNames.split(/[,\n]/).filter(n => n.trim()).length}):
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {newMemberNames.split(/[,\n]/).filter(n => n.trim()).map((name, index) => (
                    <View key={index} className="px-2 py-1 rounded-full" style={{ backgroundColor: isDark ? '#0c4a6e' : '#e0f2fe' }}>
                      <Text className="text-sky-600 text-sm">{name.trim()}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <TouchableOpacity
              className={`py-4 rounded-xl items-center ${isAddingMembers ? 'bg-sky-300' : 'bg-sky-500'}`}
              onPress={handleAddMultipleMembers}
              disabled={isAddingMembers}
            >
              <Text className="text-white font-semibold text-lg">
                {isAddingMembers ? 'Adding...' : 'Add Members'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add Expense Modal */}
      <Modal visible={showAddExpense} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <View style={{ backgroundColor: colors.card }} className="rounded-t-3xl max-h-[90%]">
            <View style={{ borderBottomColor: colors.border }} className="flex-row items-center justify-between p-4 border-b">
              <Text style={{ color: colors.text }} className="text-lg font-semibold">Add Expense</Text>
              <TouchableOpacity onPress={() => { setShowAddExpense(false); resetExpenseForm(); }}>
                <Ionicons name="close" size={24} color={colors.icon} />
              </TouchableOpacity>
            </View>
            <ScrollView className="p-4">
              <View className="mb-4">
                <Text style={{ color: colors.text }} className="text-sm font-medium mb-1">Description *</Text>
                <TextInput
                  className="rounded-lg px-4 py-3"
                  style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6', color: colors.text }}
                  placeholder="e.g., Dinner at restaurant"
                  placeholderTextColor={colors.textMuted}
                  value={expenseForm.description}
                  onChangeText={(value) => setExpenseForm({ ...expenseForm, description: value })}
                />
              </View>

              <View className="mb-4">
                <Text style={{ color: colors.text }} className="text-sm font-medium mb-1">Amount *</Text>
                <TextInput
                  className="rounded-lg px-4 py-3 text-xl font-bold"
                  style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6', color: colors.text }}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  value={expenseForm.amount}
                  onChangeText={(value) => setExpenseForm({ ...expenseForm, amount: value })}
                  keyboardType="numeric"
                />
              </View>

              <View className="mb-4">
                <Text style={{ color: colors.text }} className="text-sm font-medium mb-1">Paid By *</Text>
                <View className="rounded-lg overflow-hidden" style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: isDark ? '#374151' : '#f9fafb' }}>
                  <Picker
                    selectedValue={expenseForm.paidByMemberId}
                    onValueChange={(value) =>
                      setExpenseForm({ ...expenseForm, paidByMemberId: value })
                    }
                    style={{ color: colors.text }}
                    dropdownIconColor={colors.icon}
                  >
                    <Picker.Item label="Select who paid..." value="" color="#6b7280" />
                    {trip.members.map((member) => (
                      <Picker.Item
                        key={member._id}
                        label={`${member.name}${isCurrentUser(member) ? ' (Me)' : ''}`}
                        value={member._id}
                        color="#111827"
                      />
                    ))}
                  </Picker>
                </View>
              </View>

              {/* Split Type */}
              <View className="mb-4">
                <Text style={{ color: colors.text }} className="text-sm font-medium mb-2">Split Type</Text>
                <View className="flex-row">
                  <TouchableOpacity
                    className={`flex-1 py-3 rounded-l-xl items-center ${
                      expenseForm.splitType === 'equal' ? 'bg-sky-500' : ''
                    }`}
                    style={expenseForm.splitType !== 'equal' ? { backgroundColor: isDark ? '#374151' : '#e5e7eb' } : {}}
                    onPress={() => setExpenseForm({ ...expenseForm, splitType: 'equal' })}
                  >
                    <Text style={expenseForm.splitType !== 'equal' ? { color: colors.text } : {}} className={expenseForm.splitType === 'equal' ? 'text-white font-medium' : 'font-medium'}>
                      Equal Split
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className={`flex-1 py-3 rounded-r-xl items-center ${
                      expenseForm.splitType === 'exact' ? 'bg-sky-500' : ''
                    }`}
                    style={expenseForm.splitType !== 'exact' ? { backgroundColor: isDark ? '#374151' : '#e5e7eb' } : {}}
                    onPress={() => setExpenseForm({ ...expenseForm, splitType: 'exact' })}
                  >
                    <Text style={expenseForm.splitType !== 'exact' ? { color: colors.text } : {}} className={expenseForm.splitType === 'exact' ? 'text-white font-medium' : 'font-medium'}>
                      Custom Amounts
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View className="mb-4">
                <View className="flex-row items-center justify-between mb-2">
                  <Text style={{ color: colors.text }} className="text-sm font-medium">Split Between *</Text>
                  <TouchableOpacity
                    onPress={() =>
                      setExpenseForm({
                        ...expenseForm,
                        selectedMembers: trip.members.map((m) => m._id!),
                      })
                    }
                  >
                    <Text className="text-sky-500 text-sm">Select All</Text>
                  </TouchableOpacity>
                </View>
                <View className="flex-row flex-wrap gap-2">
                  {trip.members.map((member) => {
                    const isSelected = expenseForm.selectedMembers.includes(member._id!);
                    return (
                      <TouchableOpacity
                        key={member._id}
                        className="px-3 py-2 rounded-lg border"
                        style={{
                          backgroundColor: isSelected
                            ? (isDark ? '#0c4a6e' : '#e0f2fe')
                            : (isDark ? '#374151' : '#ffffff'),
                          borderColor: isSelected ? '#0ea5e9' : colors.border,
                        }}
                        onPress={() => {
                          if (isSelected) {
                            setExpenseForm({
                              ...expenseForm,
                              selectedMembers: expenseForm.selectedMembers.filter(
                                (id) => id !== member._id
                              ),
                            });
                          } else {
                            setExpenseForm({
                              ...expenseForm,
                              selectedMembers: [...expenseForm.selectedMembers, member._id!],
                            });
                          }
                        }}
                      >
                        <Text
                          style={{ color: isSelected ? '#0ea5e9' : colors.text }}
                          className={isSelected ? 'font-medium' : ''}
                        >
                          {member.name}
                          {isCurrentUser(member) && ' (Me)'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {expenseForm.splitType === 'equal' && expenseForm.selectedMembers.length > 0 && (
                  <Text style={{ color: colors.textMuted }} className="text-xs mt-2">
                    Split: {formatCurrency((parseFloat(expenseForm.amount) || 0) / expenseForm.selectedMembers.length)} each
                  </Text>
                )}
              </View>

              {/* Custom Split Amounts */}
              {expenseForm.splitType === 'exact' && expenseForm.selectedMembers.length > 0 && (
                <View className="mb-4">
                  <Text style={{ color: colors.text }} className="text-sm font-medium mb-2">Custom Amounts</Text>
                  {expenseForm.selectedMembers.map((memberId) => {
                    const member = trip.members.find(m => m._id === memberId);
                    return (
                      <View key={memberId} className="flex-row items-center mb-2">
                        <Text style={{ color: colors.text }} className="flex-1">{member?.name}</Text>
                        <View className="flex-row items-center rounded-lg px-3" style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6', width: 120 }}>
                          <Text style={{ color: colors.textSecondary }}>₹</Text>
                          <TextInput
                            className="flex-1 py-2 ml-1"
                            style={{ color: colors.text }}
                            placeholder="0"
                            placeholderTextColor={colors.textMuted}
                            value={expenseForm.customSplits[memberId] || ''}
                            onChangeText={(value) => setExpenseForm({
                              ...expenseForm,
                              customSplits: { ...expenseForm.customSplits, [memberId]: value },
                            })}
                            keyboardType="numeric"
                          />
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              <View className="mb-4">
                <Text style={{ color: colors.text }} className="text-sm font-medium mb-1">Category</Text>
                <TextInput
                  className="rounded-lg px-4 py-3"
                  style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6', color: colors.text }}
                  placeholder="e.g., Food, Transport"
                  placeholderTextColor={colors.textMuted}
                  value={expenseForm.category}
                  onChangeText={(value) => setExpenseForm({ ...expenseForm, category: value })}
                />
              </View>

              <TouchableOpacity
                className={`py-4 rounded-xl items-center mb-6 ${
                  addExpenseMutation.isPending ? 'bg-sky-300' : 'bg-sky-500'
                }`}
                onPress={handleAddExpense}
                disabled={addExpenseMutation.isPending}
              >
                <Text className="text-white font-semibold text-lg">Add Expense</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Status Menu Modal */}
      <Modal visible={showStatusMenu} animationType="fade" transparent>
        <TouchableOpacity
          className="flex-1 bg-black/50 justify-center items-center"
          activeOpacity={1}
          onPress={() => setShowStatusMenu(false)}
        >
          <View style={{ backgroundColor: colors.card }} className="rounded-2xl p-4 mx-8 w-72">
            <Text style={{ color: colors.text }} className="text-lg font-semibold mb-4 text-center">
              Trip Status
            </Text>
            
            <TouchableOpacity
              className="flex-row items-center p-3 rounded-xl mb-2"
              style={{
                backgroundColor: trip.status === 'active' ? (isDark ? '#166534' : '#dcfce7') : (isDark ? '#374151' : '#f3f4f6'),
              }}
              onPress={() => {
                setShowStatusMenu(false);
                if (trip.status !== 'active') handleStatusChange('active');
              }}
            >
              <View className="w-8 h-8 rounded-full items-center justify-center mr-3" style={{ backgroundColor: isDark ? '#22c55e20' : '#22c55e20' }}>
                <Ionicons name="play-circle" size={20} color="#22c55e" />
              </View>
              <View className="flex-1">
                <Text style={{ color: trip.status === 'active' ? '#22c55e' : colors.text }} className="font-medium">Active</Text>
                <Text style={{ color: colors.textMuted }} className="text-xs">Trip is ongoing</Text>
              </View>
              {trip.status === 'active' && (
                <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              className="flex-row items-center p-3 rounded-xl mb-2"
              style={{
                backgroundColor: trip.status === 'completed' ? (isDark ? '#1e40af' : '#dbeafe') : (isDark ? '#374151' : '#f3f4f6'),
              }}
              onPress={() => {
                setShowStatusMenu(false);
                if (trip.status !== 'completed') handleStatusChange('completed');
              }}
            >
              <View className="w-8 h-8 rounded-full items-center justify-center mr-3" style={{ backgroundColor: isDark ? '#3b82f620' : '#3b82f620' }}>
                <Ionicons name="checkmark-done-circle" size={20} color="#3b82f6" />
              </View>
              <View className="flex-1">
                <Text style={{ color: trip.status === 'completed' ? '#3b82f6' : colors.text }} className="font-medium">Completed</Text>
                <Text style={{ color: colors.textMuted }} className="text-xs">Trip has ended</Text>
              </View>
              {trip.status === 'completed' && (
                <Ionicons name="checkmark-circle" size={20} color="#3b82f6" />
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              className="flex-row items-center p-3 rounded-xl"
              style={{
                backgroundColor: trip.status === 'cancelled' ? (isDark ? '#7f1d1d' : '#fee2e2') : (isDark ? '#374151' : '#f3f4f6'),
              }}
              onPress={() => {
                setShowStatusMenu(false);
                if (trip.status !== 'cancelled') handleStatusChange('cancelled');
              }}
            >
              <View className="w-8 h-8 rounded-full items-center justify-center mr-3" style={{ backgroundColor: isDark ? '#ef444420' : '#ef444420' }}>
                <Ionicons name="close-circle" size={20} color="#ef4444" />
              </View>
              <View className="flex-1">
                <Text style={{ color: trip.status === 'cancelled' ? '#ef4444' : colors.text }} className="font-medium">Cancelled</Text>
                <Text style={{ color: colors.textMuted }} className="text-xs">Trip was cancelled</Text>
              </View>
              {trip.status === 'cancelled' && (
                <Ionicons name="checkmark-circle" size={20} color="#ef4444" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              className="mt-4 py-3 rounded-xl items-center"
              style={{ backgroundColor: isDark ? '#374151' : '#e5e7eb' }}
              onPress={() => setShowStatusMenu(false)}
            >
              <Text style={{ color: colors.text }} className="font-medium">Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Edit Expense Modal */}
      <Modal visible={showEditExpense} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <View style={{ backgroundColor: colors.card }} className="rounded-t-3xl max-h-[90%]">
            <View style={{ borderBottomColor: colors.border }} className="flex-row items-center justify-between p-4 border-b">
              <Text style={{ color: colors.text }} className="text-lg font-semibold">Edit Expense</Text>
              <TouchableOpacity onPress={() => { setShowEditExpense(false); setEditingExpense(null); }}>
                <Ionicons name="close" size={24} color={colors.icon} />
              </TouchableOpacity>
            </View>
            <ScrollView className="p-4">
              {/* Date */}
              <View className="mb-4">
                <Text style={{ color: colors.text }} className="text-sm font-medium mb-1">Date</Text>
                <TouchableOpacity
                  className="rounded-lg px-4 py-3 flex-row items-center justify-between"
                  style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6' }}
                  onPress={() => setShowEditDatePicker(true)}
                >
                  <Text style={{ color: colors.text }}>
                    {editExpenseForm.date.toLocaleDateString('en-IN')}
                  </Text>
                  <Ionicons name="calendar-outline" size={20} color={colors.icon} />
                </TouchableOpacity>
                {showEditDatePicker && (
                  <DateTimePicker
                    value={editExpenseForm.date}
                    mode="date"
                    onChange={(event, date) => {
                      setShowEditDatePicker(false);
                      if (date) setEditExpenseForm({ ...editExpenseForm, date });
                    }}
                  />
                )}
              </View>

              {/* Description */}
              <View className="mb-4">
                <Text style={{ color: colors.text }} className="text-sm font-medium mb-1">Description *</Text>
                <TextInput
                  className="rounded-lg px-4 py-3"
                  style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6', color: colors.text }}
                  placeholder="What was this expense for?"
                  placeholderTextColor={colors.textMuted}
                  value={editExpenseForm.description}
                  onChangeText={(value) => setEditExpenseForm({ ...editExpenseForm, description: value })}
                />
              </View>

              {/* Amount */}
              <View className="mb-4">
                <Text style={{ color: colors.text }} className="text-sm font-medium mb-1">Amount *</Text>
                <View className="flex-row items-center rounded-lg px-4" style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6' }}>
                  <Text style={{ color: colors.textSecondary }} className="text-xl">₹</Text>
                  <TextInput
                    className="flex-1 py-3 text-xl font-bold ml-2"
                    style={{ color: colors.text }}
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                    value={editExpenseForm.amount}
                    onChangeText={(value) => setEditExpenseForm({ ...editExpenseForm, amount: value })}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* Paid By */}
              <View className="mb-4">
                <Text style={{ color: colors.text }} className="text-sm font-medium mb-1">Paid By *</Text>
                <View className="rounded-lg overflow-hidden" style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: isDark ? '#374151' : '#f9fafb' }}>
                  <Picker
                    selectedValue={editExpenseForm.paidByMemberId}
                    onValueChange={(value) => setEditExpenseForm({ ...editExpenseForm, paidByMemberId: value })}
                    style={{ color: colors.text }}
                    dropdownIconColor={colors.icon}
                  >
                    <Picker.Item label="Select who paid..." value="" color="#6b7280" />
                    {trip.members.map((member) => (
                      <Picker.Item
                        key={member._id}
                        label={`${member.name}${isCurrentUser(member) ? ' (Me)' : ''}`}
                        value={member._id}
                        color="#111827"
                      />
                    ))}
                  </Picker>
                </View>
              </View>

              {/* Split Type */}
              <View className="mb-4">
                <Text style={{ color: colors.text }} className="text-sm font-medium mb-2">Split Type</Text>
                <View className="flex-row">
                  <TouchableOpacity
                    className={`flex-1 py-3 rounded-l-xl items-center ${
                      editExpenseForm.splitType === 'equal' ? 'bg-sky-500' : ''
                    }`}
                    style={editExpenseForm.splitType !== 'equal' ? { backgroundColor: isDark ? '#374151' : '#e5e7eb' } : {}}
                    onPress={() => setEditExpenseForm({ ...editExpenseForm, splitType: 'equal' })}
                  >
                    <Text style={editExpenseForm.splitType !== 'equal' ? { color: colors.text } : {}} className={editExpenseForm.splitType === 'equal' ? 'text-white font-medium' : 'font-medium'}>
                      Equal Split
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className={`flex-1 py-3 rounded-r-xl items-center ${
                      editExpenseForm.splitType === 'exact' ? 'bg-sky-500' : ''
                    }`}
                    style={editExpenseForm.splitType !== 'exact' ? { backgroundColor: isDark ? '#374151' : '#e5e7eb' } : {}}
                    onPress={() => setEditExpenseForm({ ...editExpenseForm, splitType: 'exact' })}
                  >
                    <Text style={editExpenseForm.splitType !== 'exact' ? { color: colors.text } : {}} className={editExpenseForm.splitType === 'exact' ? 'text-white font-medium' : 'font-medium'}>
                      Custom Amounts
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Split Between */}
              <View className="mb-4">
                <View className="flex-row items-center justify-between mb-2">
                  <Text style={{ color: colors.text }} className="text-sm font-medium">Split Between *</Text>
                  <TouchableOpacity
                    onPress={() => setEditExpenseForm({
                      ...editExpenseForm,
                      selectedMembers: trip.members.map(m => m._id!),
                    })}
                  >
                    <Text className="text-sky-500 text-sm">Select All</Text>
                  </TouchableOpacity>
                </View>
                <View className="flex-row flex-wrap gap-2">
                  {trip.members.map((member) => {
                    const isSelected = editExpenseForm.selectedMembers.includes(member._id!);
                    return (
                      <TouchableOpacity
                        key={member._id}
                        className="px-3 py-2 rounded-lg"
                        style={{
                          backgroundColor: isSelected
                            ? (isDark ? '#0c4a6e' : '#e0f2fe')
                            : (isDark ? '#374151' : '#ffffff'),
                          borderWidth: 1,
                          borderColor: isSelected ? '#0ea5e9' : colors.border,
                        }}
                        onPress={() => {
                          if (isSelected) {
                            setEditExpenseForm({
                              ...editExpenseForm,
                              selectedMembers: editExpenseForm.selectedMembers.filter(id => id !== member._id),
                            });
                          } else {
                            setEditExpenseForm({
                              ...editExpenseForm,
                              selectedMembers: [...editExpenseForm.selectedMembers, member._id!],
                            });
                          }
                        }}
                      >
                        <Text style={{ color: isSelected ? '#0ea5e9' : colors.text }} className={isSelected ? 'font-medium' : ''}>
                          {member.name}
                          {isCurrentUser(member) && ' (Me)'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {editExpenseForm.splitType === 'equal' && editExpenseForm.selectedMembers.length > 0 && (
                  <Text style={{ color: colors.textMuted }} className="text-xs mt-2">
                    Split: {formatCurrency((parseFloat(editExpenseForm.amount) || 0) / editExpenseForm.selectedMembers.length)} each
                  </Text>
                )}
              </View>

              {/* Custom Split Amounts */}
              {editExpenseForm.splitType === 'exact' && editExpenseForm.selectedMembers.length > 0 && (
                <View className="mb-4">
                  <Text style={{ color: colors.text }} className="text-sm font-medium mb-2">Custom Amounts</Text>
                  {editExpenseForm.selectedMembers.map((memberId) => {
                    const member = trip.members.find(m => m._id === memberId);
                    return (
                      <View key={memberId} className="flex-row items-center mb-2">
                        <Text style={{ color: colors.text }} className="flex-1">{member?.name}</Text>
                        <View className="flex-row items-center rounded-lg px-3" style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6', width: 120 }}>
                          <Text style={{ color: colors.textSecondary }}>₹</Text>
                          <TextInput
                            className="flex-1 py-2 ml-1"
                            style={{ color: colors.text }}
                            placeholder="0"
                            placeholderTextColor={colors.textMuted}
                            value={editExpenseForm.customSplits[memberId] || ''}
                            onChangeText={(value) => setEditExpenseForm({
                              ...editExpenseForm,
                              customSplits: { ...editExpenseForm.customSplits, [memberId]: value },
                            })}
                            keyboardType="numeric"
                          />
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Category */}
              <View className="mb-4">
                <Text style={{ color: colors.text }} className="text-sm font-medium mb-1">Category</Text>
                <TextInput
                  className="rounded-lg px-4 py-3"
                  style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6', color: colors.text }}
                  placeholder="e.g., Food, Transport"
                  placeholderTextColor={colors.textMuted}
                  value={editExpenseForm.category}
                  onChangeText={(value) => setEditExpenseForm({ ...editExpenseForm, category: value })}
                />
              </View>

              <TouchableOpacity
                className={`py-4 rounded-xl items-center mb-6 ${
                  updateExpenseMutation.isPending ? 'bg-sky-300' : 'bg-sky-500'
                }`}
                onPress={handleSaveEditExpense}
                disabled={updateExpenseMutation.isPending}
              >
                <Text className="text-white font-semibold text-lg">Save Changes</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
