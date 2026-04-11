import { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Alert,
  Modal,
  ScrollView,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import {
  transactionService,
  sectionService,
  categoryService,
  tripService,
  uploadService,
  TransactionFilters,
  UploadPreview,
} from '../../services/api';
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

interface Transaction {
  _id: string;
  transactionDate: string;
  description: string;
  amount: number;
  type: 'credit' | 'debit';
  sectionId: string;
  categoryId?: string;
  tripId?: string;
  paidByMemberId?: string;
  paidByMemberName?: string;
  tripSplits?: { memberId: string; memberName: string; amount: number }[];
  tags?: string[];
  section?: { name: string; _id?: string };
  category?: { name: string; color: string; _id?: string };
  trip?: { name: string; _id?: string; members?: TripMember[] };
}

interface Section {
  _id: string;
  name: string;
  uploadEnabled?: boolean;
}

interface Category {
  _id: string;
  name: string;
  color: string;
}

interface TripMember {
  _id?: string;
  name: string;
  email?: string;
}

interface Trip {
  _id: string;
  name: string;
  members: TripMember[];
}

export default function TransactionsScreen() {
  const queryClient = useQueryClient();
  const [showFilters, setShowFilters] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showFabMenu, setShowFabMenu] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [filters, setFilters] = useState<TransactionFilters>({
    page: 1,
    limit: 50,
    sortBy: 'transactionDate',
    sortOrder: 'desc',
  });
  const [searchQuery, setSearchQuery] = useState('');

  const { data: sections = [] } = useQuery({
    queryKey: ['sections'],
    queryFn: () => sectionService.getAll(),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoryService.getAll(),
  });

  const { data: trips = [] } = useQuery({
    queryKey: ['trips'],
    queryFn: () => tripService.getAll(),
  });

  // Filter date picker states
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [filterTags, setFilterTags] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['transactions', filters],
    queryFn: () => transactionService.getAll(filters),
  });

  const transactions = data?.transactions || [];
  const rawTotals = data?.totals || { totalCredit: 0, totalDebit: 0, netTotal: 0 };
  const totals = {
    income: rawTotals.totalCredit || 0,
    expense: rawTotals.totalDebit || 0,
    net: rawTotals.netTotal || 0,
  };
  const pagination = data?.pagination || { total: 0, page: 1, limit: 50, pages: 1 };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => transactionService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      queryClient.invalidateQueries({ queryKey: ['sections'] });
      Alert.alert('Success', 'Transaction deleted');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to delete');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => transactionService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      queryClient.invalidateQueries({ queryKey: ['sections'] });
      // Invalidate trip queries when transaction might be linked to a trip
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      queryClient.invalidateQueries({ queryKey: ['trip-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['trip-linked-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['trip-balances'] });
      setShowEditModal(false);
      setEditingTx(null);
      Alert.alert('Success', 'Transaction updated');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to update');
    },
  });

  const handleSearch = useCallback(() => {
    setFilters((prev) => ({ ...prev, search: searchQuery, page: 1 }));
  }, [searchQuery]);

  const clearFilters = () => {
    setFilters({
      page: 1,
      limit: 50,
      sortBy: 'transactionDate',
      sortOrder: 'desc',
    });
    setSearchQuery('');
    setFilterTags('');
    setShowFilters(false);
  };

  const openEditModal = (tx: Transaction) => {
    setEditingTx(tx);
    setShowEditModal(true);
  };

  const handleDelete = (tx: Transaction) => {
    Alert.alert(
      'Delete Transaction',
      'Are you sure you want to delete this transaction?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(tx._id),
        },
      ]
    );
  };

  const hasActiveFilters = !!(
    filters.search ||
    filters.sectionId ||
    filters.categoryId ||
    filters.type ||
    filters.startDate ||
    filters.endDate ||
    filters.minAmount ||
    filters.maxAmount ||
    filters.tags?.length ||
    filters.tripId
  );

  const { isDark, colors } = useTheme();

  const renderTransaction = ({ item }: { item: Transaction }) => (
    <TouchableOpacity
      style={{ backgroundColor: colors.card }}
      className="rounded-xl p-4 mb-3 shadow-sm"
      onPress={() => openEditModal(item)}
      onLongPress={() => handleDelete(item)}
    >
      <View className="flex-row justify-between items-start">
        <View className="flex-1 mr-3">
          <Text style={{ color: colors.text }} className="font-medium" numberOfLines={2}>
            {item.description}
          </Text>
          <View className="flex-row flex-wrap mt-1 gap-1">
            {item.category && (
              <View
                className="rounded px-2 py-0.5"
                style={{ backgroundColor: (item.category.color || '#6b7280') + '20' }}
              >
                <Text style={{ color: item.category.color || '#6b7280' }} className="text-xs">
                  {item.category.name}
                </Text>
              </View>
            )}
            {item.tags?.slice(0, 2).map((tag) => (
              <View key={tag} className="rounded px-2 py-0.5" style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6' }}>
                <Text style={{ color: colors.textSecondary }} className="text-xs">{tag}</Text>
              </View>
            ))}
          </View>
          <Text style={{ color: colors.textMuted }} className="text-xs mt-2">
            {formatDate(item.transactionDate)}
            {item.section && ` • ${item.section.name}`}
          </Text>
        </View>
        <Text
          className={`font-bold text-lg ${
            item.type === 'credit' ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {item.type === 'credit' ? '+' : '-'}
          {formatCurrency(item.amount)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const uploadEnabledSections = sections.filter((s: Section) => s.uploadEnabled !== false);

  return (
    <View style={{ backgroundColor: colors.background }} className="flex-1">
      {/* Totals */}
      <View style={{ backgroundColor: colors.card, borderColor: colors.border }} className="px-4 py-3 border-b">
        <View className="flex-row justify-between">
          <View className="items-center flex-1">
            <Text style={{ color: colors.textMuted }} className="text-xs">Income</Text>
            <Text className="text-green-600 font-semibold">{formatCurrency(totals.income)}</Text>
          </View>
          <View className="items-center flex-1">
            <Text style={{ color: colors.textMuted }} className="text-xs">Expense</Text>
            <Text className="text-red-600 font-semibold">{formatCurrency(totals.expense)}</Text>
          </View>
          <View className="items-center flex-1">
            <Text style={{ color: colors.textMuted }} className="text-xs">Net</Text>
            <Text
              className={`font-semibold ${totals.net >= 0 ? 'text-green-600' : 'text-red-600'}`}
            >
              {formatCurrency(totals.net)}
            </Text>
          </View>
        </View>
      </View>

      {/* Search & Filter Bar */}
      <View style={{ backgroundColor: colors.card, borderColor: colors.border }} className="px-4 py-3 border-b flex-row items-center gap-2">
        <View className="flex-1 flex-row items-center rounded-lg px-3 py-2" style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6' }}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            className="flex-1 ml-2"
            style={{ color: colors.text }}
            placeholder="Search transactions..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          {searchQuery && (
            <TouchableOpacity onPress={() => { setSearchQuery(''); handleSearch(); }}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          className="p-2 rounded-lg"
          style={{ backgroundColor: hasActiveFilters ? '#e0f2fe' : (isDark ? '#374151' : '#f3f4f6') }}
          onPress={() => setShowFilters(true)}
        >
          <Ionicons
            name="filter"
            size={20}
            color={hasActiveFilters ? '#0ea5e9' : colors.icon}
          />
        </TouchableOpacity>
      </View>

      {/* Transaction List */}
      <FlatList
        data={transactions}
        keyExtractor={(item) => item._id}
        renderItem={renderTransaction}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        ListEmptyComponent={
          <View className="items-center py-12">
            <Ionicons name="receipt-outline" size={48} color={colors.textMuted} />
            <Text style={{ color: colors.textMuted }} className="mt-4">No transactions found</Text>
          </View>
        }
        ListFooterComponent={
          pagination.pages > 1 ? (
            <View className="flex-row justify-center items-center gap-4 py-4">
              <TouchableOpacity
                disabled={pagination.page === 1}
                onPress={() => setFilters((prev) => ({ ...prev, page: prev.page! - 1 }))}
                className={`px-4 py-2 rounded-lg ${
                  pagination.page === 1 ? '' : 'bg-sky-500'
                }`}
                style={pagination.page === 1 ? { backgroundColor: isDark ? '#374151' : '#e5e7eb' } : {}}
              >
                <Text className={pagination.page === 1 ? '' : 'text-white'} style={pagination.page === 1 ? { color: colors.textMuted } : {}}>
                  Previous
                </Text>
              </TouchableOpacity>
              <Text style={{ color: colors.textSecondary }}>
                {pagination.page} / {pagination.pages}
              </Text>
              <TouchableOpacity
                disabled={pagination.page === pagination.pages}
                onPress={() => setFilters((prev) => ({ ...prev, page: prev.page! + 1 }))}
                className={`px-4 py-2 rounded-lg ${
                  pagination.page === pagination.pages ? '' : 'bg-sky-500'
                }`}
                style={pagination.page === pagination.pages ? { backgroundColor: isDark ? '#374151' : '#e5e7eb' } : {}}
              >
                <Text
                  className={pagination.page === pagination.pages ? '' : 'text-white'}
                  style={pagination.page === pagination.pages ? { color: colors.textMuted } : {}}
                >
                  Next
                </Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
      />

      {/* FAB Menu Overlay */}
      {showFabMenu && (
        <TouchableOpacity
          className="absolute inset-0 bg-black/30"
          activeOpacity={1}
          onPress={() => setShowFabMenu(false)}
        />
      )}

      {/* FAB Menu Options */}
      {showFabMenu && (
        <View className="absolute bottom-24 right-4 items-end">
          <TouchableOpacity
            className="flex-row items-center mb-3"
            onPress={() => {
              setShowFabMenu(false);
              setShowUploadModal(true);
            }}
          >
            <View className="bg-white rounded-lg px-3 py-2 mr-3 shadow-md">
              <Text className="text-gray-800 font-medium">Upload Statement</Text>
            </View>
            <View className="w-12 h-12 rounded-full bg-purple-500 items-center justify-center shadow-lg">
              <Ionicons name="cloud-upload" size={24} color="white" />
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-row items-center"
            onPress={() => {
              setShowFabMenu(false);
              setShowAddModal(true);
            }}
          >
            <View className="bg-white rounded-lg px-3 py-2 mr-3 shadow-md">
              <Text className="text-gray-800 font-medium">Add Transaction</Text>
            </View>
            <View className="w-12 h-12 rounded-full bg-green-500 items-center justify-center shadow-lg">
              <Ionicons name="add" size={28} color="white" />
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* FAB Button */}
      <TouchableOpacity
        className="absolute bottom-6 right-4 w-14 h-14 rounded-full bg-sky-500 items-center justify-center shadow-lg"
        onPress={() => setShowFabMenu(!showFabMenu)}
        activeOpacity={0.8}
      >
        <Ionicons name={showFabMenu ? 'close' : 'add'} size={28} color="white" />
      </TouchableOpacity>

      {/* Filter Modal */}
      <Modal visible={showFilters} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <View style={{ backgroundColor: colors.card }} className="rounded-t-3xl max-h-[85%]">
            <View style={{ borderBottomColor: colors.border }} className="flex-row items-center justify-between p-4 border-b">
              <Text style={{ color: colors.text }} className="text-lg font-semibold">Filters</Text>
              <TouchableOpacity onPress={() => setShowFilters(false)}>
                <Ionicons name="close" size={24} color={colors.icon} />
              </TouchableOpacity>
            </View>
            <ScrollView className="p-4">
              {/* Section Filter */}
              <View className="mb-4">
                <Text style={{ color: colors.text }} className="text-sm font-medium mb-1">Section</Text>
                <View className="rounded-lg overflow-hidden" style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: isDark ? '#374151' : '#f9fafb' }}>
                  <Picker
                    selectedValue={filters.sectionId || ''}
                    onValueChange={(value) =>
                      setFilters((prev) => ({ ...prev, sectionId: value || undefined }))
                    }
                    style={{ color: colors.text }}
                    dropdownIconColor={colors.icon}
                  >
                    <Picker.Item label="All Sections" value="" color="#6b7280" />
                    {sections.map((s: Section) => (
                      <Picker.Item key={s._id} label={s.name} value={s._id} color="#111827" />
                    ))}
                  </Picker>
                </View>
              </View>

              {/* Category Filter */}
              <View className="mb-4">
                <Text style={{ color: colors.text }} className="text-sm font-medium mb-1">Category</Text>
                <View className="rounded-lg overflow-hidden" style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: isDark ? '#374151' : '#f9fafb' }}>
                  <Picker
                    selectedValue={filters.categoryId || ''}
                    onValueChange={(value) =>
                      setFilters((prev) => ({ ...prev, categoryId: value || undefined }))
                    }
                    style={{ color: colors.text }}
                    dropdownIconColor={colors.icon}
                  >
                    <Picker.Item label="All Categories" value="" color="#6b7280" />
                    {categories.map((c: Category) => (
                      <Picker.Item key={c._id} label={c.name} value={c._id} color="#111827" />
                    ))}
                  </Picker>
                </View>
              </View>

              {/* Trip Filter */}
              <View className="mb-4">
                <Text style={{ color: colors.text }} className="text-sm font-medium mb-1">Trip</Text>
                <View className="rounded-lg overflow-hidden" style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: isDark ? '#374151' : '#f9fafb' }}>
                  <Picker
                    selectedValue={filters.tripId || ''}
                    onValueChange={(value) =>
                      setFilters((prev) => ({ ...prev, tripId: value || undefined }))
                    }
                    style={{ color: colors.text }}
                    dropdownIconColor={colors.icon}
                  >
                    <Picker.Item label="All / No Trip" value="" color="#6b7280" />
                    {trips.map((t: Trip) => (
                      <Picker.Item key={t._id} label={t.name} value={t._id} color="#111827" />
                    ))}
                  </Picker>
                </View>
              </View>

              {/* Type Filter */}
              <View className="mb-4">
                <Text style={{ color: colors.text }} className="text-sm font-medium mb-2">Type</Text>
                <View className="flex-row gap-2">
                  {[
                    { value: undefined, label: 'All' },
                    { value: 'credit' as const, label: 'Income' },
                    { value: 'debit' as const, label: 'Expense' },
                  ].map((opt) => (
                    <TouchableOpacity
                      key={opt.label}
                      className={`flex-1 py-3 rounded-lg items-center ${
                        filters.type === opt.value
                          ? 'bg-sky-500'
                          : ''
                      }`}
                      style={filters.type !== opt.value ? { backgroundColor: isDark ? '#374151' : '#f3f4f6' } : {}}
                      onPress={() => setFilters((prev) => ({ ...prev, type: opt.value }))}
                    >
                      <Text
                        style={filters.type !== opt.value ? { color: colors.text } : {}}
                        className={filters.type === opt.value ? 'text-white font-medium' : 'font-medium'}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Date Range */}
              <View className="mb-4">
                <Text style={{ color: colors.text }} className="text-sm font-medium mb-2">Date Range</Text>
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    className="flex-1 rounded-lg px-4 py-3 flex-row items-center justify-between"
                    style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6' }}
                    onPress={() => setShowStartDatePicker(true)}
                  >
                    <Text style={{ color: filters.startDate ? colors.text : colors.textMuted }}>
                      {filters.startDate ? new Date(filters.startDate).toLocaleDateString('en-IN') : 'Start Date'}
                    </Text>
                    <Ionicons name="calendar-outline" size={18} color={colors.icon} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="flex-1 rounded-lg px-4 py-3 flex-row items-center justify-between"
                    style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6' }}
                    onPress={() => setShowEndDatePicker(true)}
                  >
                    <Text style={{ color: filters.endDate ? colors.text : colors.textMuted }}>
                      {filters.endDate ? new Date(filters.endDate).toLocaleDateString('en-IN') : 'End Date'}
                    </Text>
                    <Ionicons name="calendar-outline" size={18} color={colors.icon} />
                  </TouchableOpacity>
                </View>
                {(filters.startDate || filters.endDate) && (
                  <TouchableOpacity
                    className="mt-2"
                    onPress={() => setFilters((prev) => ({ ...prev, startDate: undefined, endDate: undefined }))}
                  >
                    <Text className="text-sky-500 text-sm">Clear dates</Text>
                  </TouchableOpacity>
                )}
                {showStartDatePicker && (
                  <DateTimePicker
                    value={filters.startDate ? new Date(filters.startDate) : new Date()}
                    mode="date"
                    onChange={(event, date) => {
                      setShowStartDatePicker(false);
                      if (date) {
                        setFilters((prev) => ({ ...prev, startDate: date.toISOString().split('T')[0] }));
                      }
                    }}
                  />
                )}
                {showEndDatePicker && (
                  <DateTimePicker
                    value={filters.endDate ? new Date(filters.endDate) : new Date()}
                    mode="date"
                    onChange={(event, date) => {
                      setShowEndDatePicker(false);
                      if (date) {
                        setFilters((prev) => ({ ...prev, endDate: date.toISOString().split('T')[0] }));
                      }
                    }}
                  />
                )}
              </View>

              {/* Amount Range */}
              <View className="mb-4">
                <Text style={{ color: colors.text }} className="text-sm font-medium mb-2">Amount Range</Text>
                <View className="flex-row gap-2">
                  <View className="flex-1">
                    <View className="flex-row items-center rounded-lg px-3" style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6' }}>
                      <Text style={{ color: colors.textMuted }}>₹</Text>
                      <TextInput
                        className="flex-1 py-3 ml-1"
                        style={{ color: colors.text }}
                        placeholder="Min"
                        placeholderTextColor={colors.textMuted}
                        value={filters.minAmount?.toString() || ''}
                        onChangeText={(value) => 
                          setFilters((prev) => ({ 
                            ...prev, 
                            minAmount: value ? parseFloat(value) : undefined 
                          }))
                        }
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center rounded-lg px-3" style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6' }}>
                      <Text style={{ color: colors.textMuted }}>₹</Text>
                      <TextInput
                        className="flex-1 py-3 ml-1"
                        style={{ color: colors.text }}
                        placeholder="Max"
                        placeholderTextColor={colors.textMuted}
                        value={filters.maxAmount?.toString() || ''}
                        onChangeText={(value) => 
                          setFilters((prev) => ({ 
                            ...prev, 
                            maxAmount: value ? parseFloat(value) : undefined 
                          }))
                        }
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                </View>
              </View>

              {/* Tags Filter */}
              <View className="mb-4">
                <Text style={{ color: colors.text }} className="text-sm font-medium mb-1">Tags</Text>
                <TextInput
                  className="rounded-lg px-4 py-3"
                  style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6', color: colors.text }}
                  placeholder="Enter tags separated by commas"
                  placeholderTextColor={colors.textMuted}
                  value={filterTags}
                  onChangeText={(value) => {
                    setFilterTags(value);
                    const tags = value.split(',').map(t => t.trim()).filter(Boolean);
                    setFilters((prev) => ({ ...prev, tags: tags.length > 0 ? tags : undefined }));
                  }}
                />
                <Text style={{ color: colors.textMuted }} className="text-xs mt-1">
                  e.g., food, travel, shopping
                </Text>
              </View>

              {/* Action Buttons */}
              <View className="flex-row gap-4 mb-6">
                <TouchableOpacity
                  className="flex-1 py-3 rounded-lg items-center"
                  style={{ backgroundColor: isDark ? '#374151' : '#e5e7eb' }}
                  onPress={clearFilters}
                >
                  <Text style={{ color: colors.text }} className="font-medium">Clear All</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 py-3 bg-sky-500 rounded-lg items-center"
                  onPress={() => setShowFilters(false)}
                >
                  <Text className="text-white font-medium">Apply</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add Transaction Modal */}
      <AddTransactionModal
        visible={showAddModal}
        sections={sections}
        categories={categories}
        onClose={() => setShowAddModal(false)}
      />

      {/* Upload Statement Modal */}
      <UploadStatementModal
        visible={showUploadModal}
        sections={uploadEnabledSections}
        onClose={() => setShowUploadModal(false)}
      />

      {/* Edit Modal */}
      <EditTransactionModal
        visible={showEditModal}
        transaction={editingTx}
        sections={sections}
        categories={categories}
        trips={trips}
        onClose={() => {
          setShowEditModal(false);
          setEditingTx(null);
        }}
        onSave={(data) => {
          if (editingTx) {
            updateMutation.mutate({ id: editingTx._id, data });
          }
        }}
        isLoading={updateMutation.isPending}
      />
    </View>
  );
}

function AddTransactionModal({
  visible,
  sections,
  categories,
  onClose,
}: {
  visible: boolean;
  sections: Section[];
  categories: Category[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [formData, setFormData] = useState({
    sectionId: '',
    amount: '',
    type: 'debit' as 'credit' | 'debit',
    description: '',
    categoryId: '',
    tags: '',
    transactionDate: new Date(),
  });

  const createMutation = useMutation({
    mutationFn: () => {
      const tags = formData.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      return transactionService.create({
        sectionId: formData.sectionId,
        amount: parseFloat(formData.amount),
        type: formData.type,
        description: formData.description,
        categoryId: formData.categoryId || undefined,
        tags: tags.length > 0 ? tags : undefined,
        transactionDate: formData.transactionDate.toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      queryClient.invalidateQueries({ queryKey: ['sections'] });
      Alert.alert('Success', 'Transaction added successfully');
      resetForm();
      onClose();
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to add transaction');
    },
  });

  const resetForm = () => {
    setFormData({
      sectionId: '',
      amount: '',
      type: 'debit',
      description: '',
      categoryId: '',
      tags: '',
      transactionDate: new Date(),
    });
  };

  const handleSubmit = () => {
    if (!formData.sectionId) {
      Alert.alert('Error', 'Please select an account');
      return;
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    if (!formData.description.trim()) {
      Alert.alert('Error', 'Please enter a description');
      return;
    }
    createMutation.mutate();
  };

  const { isDark, colors } = useTheme();

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1 bg-black/50 justify-end">
        <View style={{ backgroundColor: colors.card }} className="rounded-t-3xl max-h-[90%]">
          <View style={{ borderBottomColor: colors.border }} className="flex-row items-center justify-between p-4 border-b">
            <Text style={{ color: colors.text }} className="text-lg font-semibold">Add Transaction</Text>
            <TouchableOpacity onPress={onClose}>
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
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={{ color: colors.text }}>
                  {formData.transactionDate.toLocaleDateString('en-IN')}
                </Text>
                <Ionicons name="calendar-outline" size={20} color={colors.icon} />
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={formData.transactionDate}
                  mode="date"
                  onChange={(event, date) => {
                    setShowDatePicker(false);
                    if (date) {
                      setFormData({ ...formData, transactionDate: date });
                    }
                  }}
                />
              )}
            </View>

            {/* Account */}
            <View className="mb-4">
              <Text style={{ color: colors.text }} className="text-sm font-medium mb-1">Account *</Text>
              <View className="rounded-lg overflow-hidden" style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: isDark ? '#374151' : '#f9fafb' }}>
                <Picker
                  selectedValue={formData.sectionId}
                  onValueChange={(value) => setFormData({ ...formData, sectionId: value })}
                  style={{ color: colors.text }}
                  dropdownIconColor={colors.icon}
                >
                  <Picker.Item label="Select account..." value="" color="#6b7280" />
                  {sections.map((section: Section) => (
                    <Picker.Item key={section._id} label={section.name} value={section._id} color="#111827" />
                  ))}
                </Picker>
              </View>
            </View>

            {/* Type */}
            <View className="mb-4">
              <Text style={{ color: colors.text }} className="text-sm font-medium mb-2">Type</Text>
              <View className="flex-row">
                <TouchableOpacity
                  className={`flex-1 py-3 rounded-l-xl items-center ${
                    formData.type === 'debit' ? 'bg-red-500' : ''
                  }`}
                  style={formData.type !== 'debit' ? { backgroundColor: isDark ? '#374151' : '#f3f4f6' } : {}}
                  onPress={() => setFormData({ ...formData, type: 'debit' })}
                >
                  <Text style={{ color: formData.type === 'debit' ? 'white' : colors.text }} className="font-medium">
                    Expense
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className={`flex-1 py-3 rounded-r-xl items-center ${
                    formData.type === 'credit' ? 'bg-green-500' : ''
                  }`}
                  style={formData.type !== 'credit' ? { backgroundColor: isDark ? '#374151' : '#f3f4f6' } : {}}
                  onPress={() => setFormData({ ...formData, type: 'credit' })}
                >
                  <Text style={{ color: formData.type === 'credit' ? 'white' : colors.text }} className="font-medium">
                    Income
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Amount */}
            <View className="mb-4">
              <Text style={{ color: colors.text }} className="text-sm font-medium mb-1">Amount *</Text>
              <View className="flex-row items-center rounded-lg px-4" style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6' }}>
                <Text style={{ color: colors.textSecondary }} className="text-xl">₹</Text>
                <TextInput
                  className="flex-1 py-3 text-2xl font-bold ml-2"
                  style={{ color: colors.text }}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  value={formData.amount}
                  onChangeText={(value) => setFormData({ ...formData, amount: value })}
                  keyboardType="numeric"
                />
              </View>
            </View>

            {/* Description */}
            <View className="mb-4">
              <Text style={{ color: colors.text }} className="text-sm font-medium mb-1">Description *</Text>
              <TextInput
                className="rounded-lg px-4 py-3"
                style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6', color: colors.text }}
                placeholder="What's this for?"
                placeholderTextColor={colors.textMuted}
                value={formData.description}
                onChangeText={(value) => setFormData({ ...formData, description: value })}
                multiline
              />
            </View>

            {/* Category */}
            <View className="mb-4">
              <Text style={{ color: colors.text }} className="text-sm font-medium mb-1">Category</Text>
              <View className="rounded-lg overflow-hidden" style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: isDark ? '#374151' : '#f9fafb' }}>
                <Picker
                  selectedValue={formData.categoryId}
                  onValueChange={(value) => setFormData({ ...formData, categoryId: value })}
                  style={{ color: colors.text }}
                  dropdownIconColor={colors.icon}
                >
                  <Picker.Item label="Select category (optional)" value="" color="#6b7280" />
                  {categories.map((category: Category) => (
                    <Picker.Item key={category._id} label={category.name} value={category._id} color="#111827" />
                  ))}
                </Picker>
              </View>
            </View>

            {/* Tags */}
            <View className="mb-4">
              <Text style={{ color: colors.text }} className="text-sm font-medium mb-1">Tags</Text>
              <TextInput
                className="rounded-lg px-4 py-3"
                style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6', color: colors.text }}
                placeholder="Enter tags separated by commas"
                placeholderTextColor={colors.textMuted}
                value={formData.tags}
                onChangeText={(value) => setFormData({ ...formData, tags: value })}
              />
            </View>

            {/* Submit */}
            <TouchableOpacity
              className={`py-4 rounded-xl items-center mb-6 ${
                createMutation.isPending ? 'bg-sky-300' : 'bg-sky-500'
              }`}
              onPress={handleSubmit}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? (
                <ActivityIndicator color="white" />
              ) : (
                <View className="flex-row items-center">
                  <Ionicons name="checkmark-circle" size={24} color="white" />
                  <Text className="text-white font-semibold text-lg ml-2">Add Transaction</Text>
                </View>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function UploadStatementModal({
  visible,
  sections,
  onClose,
}: {
  visible: boolean;
  sections: Section[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [sectionId, setSectionId] = useState('');
  const [selectedFile, setSelectedFile] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadPreview, setUploadPreview] = useState<UploadPreview | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [isConfirming, setIsConfirming] = useState(false);

  const { isDark, colors } = useTheme();

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setSelectedFile({
          uri: file.uri,
          name: file.name,
          type: file.mimeType || 'application/octet-stream',
        });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick file');
    }
  };

  const handleUpload = async () => {
    if (!sectionId) {
      Alert.alert('Error', 'Please select an account');
      return;
    }
    if (!selectedFile) {
      Alert.alert('Error', 'Please select a file');
      return;
    }

    setIsUploading(true);
    try {
      const preview = await uploadService.uploadStatement(sectionId, selectedFile);
      setUploadPreview(preview);
      const allIndices = new Set<number>();
      preview.transactions.forEach((_, index) => {
        if (!preview.transactions[index].isDuplicate) {
          allIndices.add(index);
        }
      });
      setSelectedIndices(allIndices);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to upload file');
    } finally {
      setIsUploading(false);
    }
  };

  const toggleTransaction = (index: number) => {
    const newSet = new Set(selectedIndices);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }
    setSelectedIndices(newSet);
  };

  const handleConfirm = async () => {
    if (!uploadPreview) return;

    setIsConfirming(true);
    try {
      const indices = Array.from(selectedIndices);
      await uploadService.confirmUpload(uploadPreview.uploadId, indices);
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      queryClient.invalidateQueries({ queryKey: ['sections'] });
      Alert.alert('Success', `${indices.length} transactions imported successfully`);
      handleClose();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to confirm upload');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCancel = async () => {
    if (uploadPreview) {
      try {
        await uploadService.cancelUpload(uploadPreview.uploadId);
      } catch (error) {
        // Ignore cancel errors
      }
    }
    handleClose();
  };

  const handleClose = () => {
    setSectionId('');
    setSelectedFile(null);
    setUploadPreview(null);
    setSelectedIndices(new Set());
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1 bg-black/50 justify-end">
        <View style={{ backgroundColor: colors.card }} className="rounded-t-3xl max-h-[90%]">
          <View style={{ borderBottomColor: colors.border }} className="flex-row items-center justify-between p-4 border-b">
            <Text style={{ color: colors.text }} className="text-lg font-semibold">
              {uploadPreview ? 'Review Transactions' : 'Upload Statement'}
            </Text>
            <TouchableOpacity onPress={handleCancel}>
              <Ionicons name="close" size={24} color={colors.icon} />
            </TouchableOpacity>
          </View>

          {!uploadPreview ? (
            <ScrollView className="p-4">
              {/* Account Selection */}
              <View className="mb-4">
                <Text style={{ color: colors.text }} className="text-sm font-medium mb-1">Account *</Text>
                <View className="rounded-lg overflow-hidden" style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: isDark ? '#374151' : '#f9fafb' }}>
                  <Picker
                    selectedValue={sectionId}
                    onValueChange={(value) => setSectionId(value)}
                    style={{ color: colors.text }}
                    dropdownIconColor={colors.icon}
                  >
                    <Picker.Item label="Select account..." value="" color="#6b7280" />
                    {sections.map((section: Section) => (
                      <Picker.Item key={section._id} label={section.name} value={section._id} color="#111827" />
                    ))}
                  </Picker>
                </View>
                {sections.length === 0 && (
                  <Text style={{ color: colors.textMuted }} className="text-xs mt-1">
                    No accounts with upload enabled
                  </Text>
                )}
              </View>

              {/* File Picker */}
              <View className="mb-4">
                <Text style={{ color: colors.text }} className="text-sm font-medium mb-2">Statement File *</Text>
                <TouchableOpacity
                  className="rounded-xl p-6 items-center border-2 border-dashed"
                  style={{ borderColor: colors.border, backgroundColor: isDark ? '#1f2937' : '#f9fafb' }}
                  onPress={handlePickFile}
                >
                  {selectedFile ? (
                    <>
                      <Ionicons name="document-text" size={40} color={colors.primary} />
                      <Text style={{ color: colors.text }} className="mt-2 font-medium text-center">
                        {selectedFile.name}
                      </Text>
                      <Text style={{ color: colors.textMuted }} className="text-xs mt-1">
                        Tap to change file
                      </Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="cloud-upload-outline" size={48} color={colors.textMuted} />
                      <Text style={{ color: colors.text }} className="mt-2 font-medium">
                        Select File
                      </Text>
                      <Text style={{ color: colors.textMuted }} className="text-xs mt-1">
                        PDF, CSV, or Excel
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* Upload Button */}
              <TouchableOpacity
                className={`py-4 rounded-xl items-center mb-6 ${
                  isUploading ? 'bg-purple-300' : 'bg-purple-500'
                }`}
                onPress={handleUpload}
                disabled={isUploading || !sectionId || !selectedFile}
              >
                {isUploading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <View className="flex-row items-center">
                    <Ionicons name="cloud-upload" size={24} color="white" />
                    <Text className="text-white font-semibold text-lg ml-2">Upload & Preview</Text>
                  </View>
                )}
              </TouchableOpacity>
            </ScrollView>
          ) : (
            <>
              {/* Preview Header */}
              <View style={{ backgroundColor: isDark ? '#1f2937' : '#f3f4f6' }} className="p-4">
                <Text style={{ color: colors.text }} className="font-medium">
                  {uploadPreview.sectionName}
                </Text>
                <View className="flex-row mt-2">
                  <View className="flex-1">
                    <Text style={{ color: colors.textMuted }} className="text-xs">Total</Text>
                    <Text style={{ color: colors.text }} className="font-semibold">{uploadPreview.totalCount}</Text>
                  </View>
                  <View className="flex-1">
                    <Text style={{ color: colors.textMuted }} className="text-xs">New</Text>
                    <Text className="text-green-600 font-semibold">{uploadPreview.newCount}</Text>
                  </View>
                  <View className="flex-1">
                    <Text style={{ color: colors.textMuted }} className="text-xs">Duplicates</Text>
                    <Text className="text-orange-500 font-semibold">{uploadPreview.duplicateCount}</Text>
                  </View>
                  <View className="flex-1">
                    <Text style={{ color: colors.textMuted }} className="text-xs">Selected</Text>
                    <Text style={{ color: colors.primary }} className="font-semibold">{selectedIndices.size}</Text>
                  </View>
                </View>
              </View>

              {/* Transaction List */}
              <FlatList
                data={uploadPreview.transactions}
                keyExtractor={(_, index) => index.toString()}
                renderItem={({ item, index }) => (
                  <TouchableOpacity
                    className="flex-row items-center p-4 border-b"
                    style={{ borderBottomColor: colors.border }}
                    onPress={() => toggleTransaction(index)}
                  >
                    <View className="mr-3">
                      <Ionicons
                        name={selectedIndices.has(index) ? 'checkbox' : 'square-outline'}
                        size={24}
                        color={selectedIndices.has(index) ? colors.primary : colors.textMuted}
                      />
                    </View>
                    <View className="flex-1">
                      <Text style={{ color: colors.text }} numberOfLines={1}>
                        {item.description}
                      </Text>
                      <View className="flex-row items-center mt-1">
                        <Text style={{ color: colors.textMuted }} className="text-xs">
                          {formatDate(item.transactionDate)}
                        </Text>
                        {item.isDuplicate && (
                          <View className="ml-2 bg-orange-100 rounded px-2 py-0.5">
                            <Text className="text-orange-600 text-xs">Duplicate</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <Text className={`font-semibold ${item.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                      {item.type === 'credit' ? '+' : '-'}₹{item.amount.toLocaleString('en-IN')}
                    </Text>
                  </TouchableOpacity>
                )}
                style={{ maxHeight: 300 }}
              />

              {/* Action Buttons */}
              <View className="p-4 flex-row gap-4">
                <TouchableOpacity
                  className="flex-1 py-4 bg-gray-200 rounded-xl items-center"
                  onPress={handleCancel}
                >
                  <Text className="text-gray-700 font-semibold">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className={`flex-1 py-4 rounded-xl items-center ${
                    isConfirming || selectedIndices.size === 0 ? 'bg-green-300' : 'bg-green-500'
                  }`}
                  onPress={handleConfirm}
                  disabled={isConfirming || selectedIndices.size === 0}
                >
                  {isConfirming ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text className="text-white font-semibold">
                      Import {selectedIndices.size}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

function EditTransactionModal({
  visible,
  transaction,
  sections,
  categories,
  trips,
  onClose,
  onSave,
  isLoading,
}: {
  visible: boolean;
  transaction: Transaction | null;
  sections: Section[];
  categories: Category[];
  trips: Trip[];
  onClose: () => void;
  onSave: (data: any) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    transactionDate: new Date(),
    description: '',
    amount: '',
    type: 'debit' as 'credit' | 'debit',
    sectionId: '',
    categoryId: '',
    tripId: '',
    paidByMemberId: '',
    selectedMemberIds: [] as string[],
    tags: '',
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [transactionId, setTransactionId] = useState<string | null>(null);

  const { isDark, colors } = useTheme();

  // Helper to extract ID - handles both string IDs and populated objects
  const extractId = (value: any): string => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value._id) return value._id;
    return '';
  };

  // Get selected trip - only if tripId is not empty
  const selectedTrip = formData.tripId ? trips.find(t => t._id === formData.tripId) : null;

  // Properly initialize form when transaction changes
  if (transaction && transaction._id !== transactionId) {
    setTransactionId(transaction._id);
    
    // Extract IDs properly - handle both direct IDs and populated objects
    const sectionId = extractId(transaction.sectionId) || extractId(transaction.section);
    const categoryId = extractId(transaction.categoryId) || extractId(transaction.category);
    const tripId = extractId(transaction.tripId) || extractId(transaction.trip);
    
    // Extract trip split data
    const paidByMemberId = transaction.paidByMemberId || '';
    const selectedMemberIds = transaction.tripSplits?.map(s => s.memberId) || [];
    
    setFormData({
      transactionDate: new Date(transaction.transactionDate),
      description: transaction.description,
      amount: transaction.amount.toString(),
      type: transaction.type,
      sectionId,
      categoryId,
      tripId,
      paidByMemberId,
      selectedMemberIds,
      tags: transaction.tags?.join(', ') || '',
    });
  }

  // Reset when modal closes
  if (!visible && transactionId !== null) {
    setTransactionId(null);
  }

  // Toggle member selection
  const toggleMember = (memberId: string) => {
    if (formData.selectedMemberIds.includes(memberId)) {
      setFormData({
        ...formData,
        selectedMemberIds: formData.selectedMemberIds.filter(id => id !== memberId),
      });
    } else {
      setFormData({
        ...formData,
        selectedMemberIds: [...formData.selectedMemberIds, memberId],
      });
    }
  };

  // Select all members
  const selectAllMembers = () => {
    if (selectedTrip) {
      setFormData({
        ...formData,
        selectedMemberIds: selectedTrip.members.map(m => m._id!),
      });
    }
  };

  // Handle trip change
  const handleTripChange = (tripId: string) => {
    const trip = trips.find(t => t._id === tripId);
    if (trip) {
      // Auto-select all members and first member as payer
      setFormData({
        ...formData,
        tripId,
        selectedMemberIds: trip.members.map(m => m._id!),
        paidByMemberId: trip.members[0]?._id || '',
      });
    } else {
      // Clear trip-related data
      setFormData({
        ...formData,
        tripId: '',
        selectedMemberIds: [],
        paidByMemberId: '',
      });
    }
  };

  const handleSave = () => {
    const tags = formData.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    // Build trip splits if trip is selected
    let tripSplits: { memberId: string; memberName: string; amount: number }[] | null = null;
    let paidByMemberId: string | null = null;
    let paidByMemberName: string | null = null;

    if (formData.tripId && selectedTrip && formData.selectedMemberIds.length > 0) {
      const amount = parseFloat(formData.amount) || 0;
      const splitAmount = amount / formData.selectedMemberIds.length;
      
      tripSplits = formData.selectedMemberIds.map(memberId => {
        const member = selectedTrip.members.find(m => m._id === memberId);
        return {
          memberId,
          memberName: member?.name || '',
          amount: splitAmount,
        };
      });

      if (formData.paidByMemberId) {
        const payer = selectedTrip.members.find(m => m._id === formData.paidByMemberId);
        paidByMemberId = formData.paidByMemberId;
        paidByMemberName = payer?.name || null;
      }
    }

    onSave({
      transactionDate: formData.transactionDate.toISOString(),
      description: formData.description,
      amount: parseFloat(formData.amount),
      type: formData.type,
      sectionId: formData.sectionId,
      categoryId: formData.categoryId || null,
      tripId: formData.tripId || null,
      tripSplits,
      paidByMemberId,
      paidByMemberName,
      tags,
    });
  };

  // Calculate split amount
  const splitAmount = formData.selectedMemberIds.length > 0
    ? (parseFloat(formData.amount) || 0) / formData.selectedMemberIds.length
    : 0;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1 bg-black/50 justify-end">
        <View style={{ backgroundColor: colors.card }} className="rounded-t-3xl max-h-[90%]">
          <View style={{ borderBottomColor: colors.border }} className="flex-row items-center justify-between p-4 border-b">
            <Text style={{ color: colors.text }} className="text-lg font-semibold">Edit Transaction</Text>
            <TouchableOpacity onPress={onClose}>
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
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={{ color: colors.text }}>
                  {formData.transactionDate.toLocaleDateString('en-IN')}
                </Text>
                <Ionicons name="calendar-outline" size={20} color={colors.icon} />
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={formData.transactionDate}
                  mode="date"
                  onChange={(event, date) => {
                    setShowDatePicker(false);
                    if (date) {
                      setFormData({ ...formData, transactionDate: date });
                    }
                  }}
                />
              )}
            </View>

            {/* Description */}
            <View className="mb-4">
              <Text style={{ color: colors.text }} className="text-sm font-medium mb-1">Description</Text>
              <TextInput
                className="rounded-lg px-4 py-3"
                style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6', color: colors.text }}
                placeholderTextColor={colors.textMuted}
                value={formData.description}
                onChangeText={(value) => setFormData({ ...formData, description: value })}
                multiline
              />
            </View>

            {/* Type */}
            <View className="mb-4">
              <Text style={{ color: colors.text }} className="text-sm font-medium mb-2">Type</Text>
              <View className="flex-row">
                <TouchableOpacity
                  className={`flex-1 py-3 rounded-l-xl items-center ${
                    formData.type === 'debit' ? 'bg-red-500' : ''
                  }`}
                  style={formData.type !== 'debit' ? { backgroundColor: isDark ? '#374151' : '#e5e7eb' } : {}}
                  onPress={() => setFormData({ ...formData, type: 'debit' })}
                >
                  <Text style={formData.type !== 'debit' ? { color: colors.text } : {}} className={formData.type === 'debit' ? 'text-white font-medium' : 'font-medium'}>
                    Expense
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className={`flex-1 py-3 rounded-r-xl items-center ${
                    formData.type === 'credit' ? 'bg-green-500' : ''
                  }`}
                  style={formData.type !== 'credit' ? { backgroundColor: isDark ? '#374151' : '#e5e7eb' } : {}}
                  onPress={() => setFormData({ ...formData, type: 'credit' })}
                >
                  <Text style={formData.type !== 'credit' ? { color: colors.text } : {}} className={formData.type === 'credit' ? 'text-white font-medium' : 'font-medium'}>
                    Income
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Amount */}
            <View className="mb-4">
              <Text style={{ color: colors.text }} className="text-sm font-medium mb-1">Amount</Text>
              <View className="flex-row items-center rounded-lg px-4" style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6' }}>
                <Text style={{ color: colors.textSecondary }} className="text-xl">₹</Text>
                <TextInput
                  className="flex-1 py-3 text-xl font-bold ml-2"
                  style={{ color: colors.text }}
                  value={formData.amount}
                  onChangeText={(value) => setFormData({ ...formData, amount: value })}
                  keyboardType="numeric"
                />
              </View>
            </View>

            {/* Section */}
            <View className="mb-4">
              <Text style={{ color: colors.text }} className="text-sm font-medium mb-1">Account *</Text>
              <View className="rounded-lg overflow-hidden" style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: isDark ? '#374151' : '#f9fafb' }}>
                <Picker
                  selectedValue={formData.sectionId}
                  onValueChange={(value) => setFormData({ ...formData, sectionId: value })}
                  style={{ color: colors.text }}
                  dropdownIconColor={colors.icon}
                >
                  <Picker.Item label="Select account..." value="" color="#6b7280" />
                  {sections.map((s) => (
                    <Picker.Item key={s._id} label={s.name} value={s._id} color="#111827" />
                  ))}
                </Picker>
              </View>
            </View>

            {/* Category */}
            <View className="mb-4">
              <Text style={{ color: colors.text }} className="text-sm font-medium mb-1">Category</Text>
              <View className="rounded-lg overflow-hidden" style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: isDark ? '#374151' : '#f9fafb' }}>
                <Picker
                  selectedValue={formData.categoryId}
                  onValueChange={(value) => setFormData({ ...formData, categoryId: value })}
                  style={{ color: colors.text }}
                  dropdownIconColor={colors.icon}
                >
                  <Picker.Item label="No category" value="" color="#6b7280" />
                  {categories.map((c) => (
                    <Picker.Item key={c._id} label={c.name} value={c._id} color="#111827" />
                  ))}
                </Picker>
              </View>
            </View>

            {/* Trip */}
            <View className="mb-4">
              <Text style={{ color: colors.text }} className="text-sm font-medium mb-1">Link to Trip</Text>
              <View className="rounded-lg overflow-hidden" style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: isDark ? '#374151' : '#f9fafb' }}>
                <Picker
                  selectedValue={formData.tripId}
                  onValueChange={handleTripChange}
                  style={{ color: colors.text }}
                  dropdownIconColor={colors.icon}
                >
                  <Picker.Item label="No trip" value="" color="#6b7280" />
                  {trips.map((t) => (
                    <Picker.Item key={t._id} label={t.name} value={t._id} color="#111827" />
                  ))}
                </Picker>
              </View>
            </View>

            {/* Trip Split Options - shown when trip is selected */}
            {selectedTrip && selectedTrip.members.length > 0 && (
              <View className="mb-4 p-3 rounded-lg" style={{ backgroundColor: isDark ? '#1f2937' : '#f3f4f6', borderWidth: 1, borderColor: colors.border }}>
                {/* Split with Members */}
                <View className="mb-3">
                  <View className="flex-row items-center justify-between mb-2">
                    <Text style={{ color: colors.text }} className="text-sm font-medium">Split with Members</Text>
                    <TouchableOpacity onPress={selectAllMembers}>
                      <Text className="text-sky-500 text-xs">Select All</Text>
                    </TouchableOpacity>
                  </View>
                  <View className="flex-row flex-wrap gap-2">
                    {selectedTrip.members.map(member => {
                      const isSelected = formData.selectedMemberIds.includes(member._id!);
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
                          onPress={() => toggleMember(member._id!)}
                        >
                          <Text
                            style={{ color: isSelected ? '#0ea5e9' : colors.text }}
                            className={isSelected ? 'font-medium' : ''}
                          >
                            {member.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {formData.selectedMemberIds.length > 0 && (
                    <Text style={{ color: colors.textMuted }} className="text-xs mt-2">
                      Split equally: {formatCurrency(splitAmount)} each
                    </Text>
                  )}
                </View>

                {/* Who Paid */}
                <View>
                  <Text style={{ color: colors.text }} className="text-sm font-medium mb-1">Who paid?</Text>
                  <View className="rounded-lg overflow-hidden" style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: isDark ? '#374151' : '#ffffff' }}>
                    <Picker
                      selectedValue={formData.paidByMemberId}
                      onValueChange={(value) => setFormData({ ...formData, paidByMemberId: value })}
                      style={{ color: colors.text }}
                      dropdownIconColor={colors.icon}
                    >
                      <Picker.Item label="Select who paid..." value="" color="#6b7280" />
                      {selectedTrip.members.map((m) => (
                        <Picker.Item key={m._id} label={m.name} value={m._id} color="#111827" />
                      ))}
                    </Picker>
                  </View>
                </View>
              </View>
            )}

            {/* Tags */}
            <View className="mb-4">
              <Text style={{ color: colors.text }} className="text-sm font-medium mb-1">Tags (comma separated)</Text>
              <TextInput
                className="rounded-lg px-4 py-3"
                style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6', color: colors.text }}
                placeholder="e.g., food, swiggy"
                placeholderTextColor={colors.textMuted}
                value={formData.tags}
                onChangeText={(value) => setFormData({ ...formData, tags: value })}
              />
            </View>

            <TouchableOpacity
              className={`py-4 rounded-xl items-center mb-6 ${
                isLoading ? 'bg-sky-300' : 'bg-sky-500'
              }`}
              onPress={handleSave}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-semibold text-lg">Save Changes</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
