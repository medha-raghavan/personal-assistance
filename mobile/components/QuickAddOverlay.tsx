import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  Animated,
  Dimensions,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { usePaymentStore, PendingPayment } from '../store/paymentStore';
import { useAuthStore } from '../store/authStore';
import { sectionService, categoryService, transactionService } from '../services/api';
import {
  cacheCategories,
  cacheSections,
  enqueueOfflineTransaction,
  loadCachedCategories,
  loadCachedSections,
  CachedCategory,
  CachedSection,
} from '../services/lookupCache';
import { flushOfflineTransactionQueue } from '../services/offlineQueue';
import { useTheme } from './ThemeProvider';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
  }).format(amount);
}

interface SaveTransactionInput {
  paymentId: string;
  sectionId: string;
  amount: number;
  type: 'credit' | 'debit';
  description: string;
  categoryId?: string;
  transactionDate: string;
}

function pickDefaultSection(sections: CachedSection[]): string {
  const digitalWallet = sections.find((section) => section.type === 'digital_wallet');
  const checking = sections.find((section) => section.type === 'checking');
  return digitalWallet?._id || checking?._id || sections[0]?._id || '';
}

function isNetworkError(error: any): boolean {
  if (!error) return false;
  if (error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK') return true;
  if (!error.response && error.message) return true;
  return false;
}

/** Preferred quick-select chips on SMS payment save (order matters). */
const QUICK_CATEGORY_NAMES = [
  'Food & Dining',
  'Transport',
  'Shopping',
  'Groceries',
  'Health',
  'Bills & Utilities',
  'Entertainment',
];

function getQuickCategories(categories: CachedCategory[]): CachedCategory[] {
  const byName = new Map(categories.map((c) => [c.name.toLowerCase(), c]));
  const quick: CachedCategory[] = [];
  const used = new Set<string>();

  for (const name of QUICK_CATEGORY_NAMES) {
    const match = byName.get(name.toLowerCase());
    if (match && !used.has(match._id)) {
      quick.push(match);
      used.add(match._id);
    }
  }

  // Ensure Transport appears even if named slightly differently (e.g. Transportation)
  if (!quick.some((c) => /transport/i.test(c.name))) {
    const transport = categories.find((c) => /transport/i.test(c.name));
    if (transport && !used.has(transport._id)) {
      quick.splice(Math.min(1, quick.length), 0, transport);
      used.add(transport._id);
    }
  }

  return quick;
}

export function QuickAddOverlay() {
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuthStore();
  const { colors } = useTheme();
  const { showQuickAdd, currentPayment, hidePaymentOverlay, dismissPayment } = usePaymentStore();

  const [selectedSection, setSelectedSection] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [frozenPayment, setFrozenPayment] = useState<PendingPayment | null>(null);
  const [cachedSections, setCachedSections] = useState<CachedSection[]>([]);
  const [cachedCategories, setCachedCategories] = useState<CachedCategory[]>([]);
  const [slideAnim] = useState(new Animated.Value(Dimensions.get('window').height));

  useEffect(() => {
    void (async () => {
      setCachedSections(await loadCachedSections());
      setCachedCategories(await loadCachedCategories());
    })();
  }, []);

  const {
    data: remoteSections = [],
    isError: sectionsError,
    isFetching: sectionsFetching,
  } = useQuery({
    queryKey: ['sections'],
    queryFn: async () => {
      const data = await sectionService.getAll();
      await cacheSections(data);
      setCachedSections(
        data.map((s: CachedSection) => ({ _id: s._id, name: s.name, type: s.type }))
      );
      return data;
    },
    enabled: isAuthenticated,
    retry: 1,
  });

  const {
    data: remoteCategories = [],
    isError: categoriesError,
    isFetching: categoriesFetching,
  } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const data = await categoryService.getAll();
      await cacheCategories(data);
      setCachedCategories(
        data.map((c: CachedCategory) => ({
          _id: c._id,
          name: c.name,
          color: c.color || '#6b7280',
        }))
      );
      return data;
    },
    enabled: isAuthenticated,
    retry: 1,
  });

  const sections: CachedSection[] =
    remoteSections.length > 0
      ? remoteSections.map((s: CachedSection) => ({
          _id: s._id,
          name: s.name,
          type: s.type,
        }))
      : cachedSections;

  const categories: CachedCategory[] =
    remoteCategories.length > 0
      ? remoteCategories.map((c: CachedCategory) => ({
          _id: c._id,
          name: c.name,
          color: c.color || '#6b7280',
        }))
      : cachedCategories;

  const quickCategories = getQuickCategories(categories);
  // Quick chips first (includes Transport), then remaining categories
  const orderedCategories = [
    ...quickCategories,
    ...categories.filter((c) => !quickCategories.some((q) => q._id === c._id)),
  ];

  const usingCachedLookups =
    (sectionsError || categoriesError || (!sectionsFetching && remoteSections.length === 0 && cachedSections.length > 0)) &&
    sections.length > 0;

  const createMutation = useMutation({
    mutationFn: (data: SaveTransactionInput) =>
      transactionService.create({
        sectionId: data.sectionId,
        amount: data.amount,
        type: data.type,
        description: data.description,
        categoryId: data.categoryId,
        transactionDate: data.transactionDate,
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['sections'] });
      Alert.alert('Success', 'Transaction recorded!');
      dismissPayment(variables.paymentId);
      setSelectedCategory('');
      setFrozenPayment(null);
      createMutation.reset();
      void flushOfflineTransactionQueue();
    },
    onError: (error: any, variables) => {
      if (isNetworkError(error)) {
        Alert.alert(
          'Server unreachable',
          'Choose how to continue with this payment.',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => setFrozenPayment(null) },
            {
              text: 'Retry',
              onPress: () => createMutation.mutate(variables),
            },
            {
              text: 'Save for later',
              onPress: async () => {
                await enqueueOfflineTransaction({
                  paymentId: variables.paymentId,
                  sectionId: variables.sectionId,
                  amount: variables.amount,
                  type: variables.type,
                  description: variables.description,
                  categoryId: variables.categoryId,
                  transactionDate: variables.transactionDate,
                });
                dismissPayment(variables.paymentId);
                setSelectedCategory('');
                setFrozenPayment(null);
                createMutation.reset();
                Alert.alert(
                  'Saved offline',
                  'This transaction will sync automatically when the server is reachable.'
                );
              },
            },
          ]
        );
        return;
      }

      const message =
        error.code === 'ECONNABORTED'
          ? 'Request timed out. Check your connection and try again.'
          : error.response?.data?.error?.message || 'Failed to save transaction';
      Alert.alert('Error', message);
      setFrozenPayment(null);
    },
  });

  const displayPayment = frozenPayment ?? currentPayment;
  const isSaving = createMutation.isPending;
  const shouldRenderOverlay =
    isAuthenticated && ((showQuickAdd && !!displayPayment) || isSaving);

  useEffect(() => {
    if (shouldRenderOverlay) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: Dimensions.get('window').height,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [shouldRenderOverlay, slideAnim]);

  useEffect(() => {
    if (!showQuickAdd || !currentPayment || isSaving) {
      return;
    }

    setSelectedCategory('');

    if (sections.length > 0) {
      setSelectedSection((prev) =>
        prev && sections.some((section) => section._id === prev)
          ? prev
          : pickDefaultSection(sections)
      );
    } else {
      setSelectedSection('');
    }
  }, [showQuickAdd, currentPayment?.id, sections, isSaving]);

  const handleSave = () => {
    const payment = frozenPayment ?? currentPayment;
    if (!payment) return;
    if (!selectedSection) {
      Alert.alert(
        'Select an account',
        sections.length === 0
          ? 'No accounts available offline. Open the app once while online to cache your accounts.'
          : 'Please select an account'
      );
      return;
    }
    if (!Number.isFinite(payment.amount) || payment.amount <= 0) {
      Alert.alert('Error', 'Invalid payment amount');
      return;
    }

    setFrozenPayment(payment);

    createMutation.mutate({
      paymentId: payment.id,
      sectionId: selectedSection,
      amount: payment.amount,
      type: payment.type,
      description: payment.merchant || 'Payment',
      categoryId: selectedCategory || undefined,
      transactionDate: (payment.date ?? new Date()).toISOString(),
    });
  };

  const handleDismiss = () => {
    if (isSaving) {
      Alert.alert('Saving', 'Please wait for the transaction to finish saving.');
      return;
    }

    if (currentPayment) {
      dismissPayment(currentPayment.id);
    }
    hidePaymentOverlay();
    setFrozenPayment(null);
    createMutation.reset();
  };

  if (!shouldRenderOverlay || !displayPayment) {
    return null;
  }

  const amountColor = displayPayment.type === 'credit' ? colors.income : colors.expense;
  const selectedSectionName =
    sections.find((section) => section._id === selectedSection)?.name || 'Select account';

  return (
    <Modal visible={shouldRenderOverlay} transparent animationType="none">
      <View className="flex-1 bg-black/50 justify-end">
        <Animated.View
          style={{
            transform: [{ translateY: slideAnim }],
            backgroundColor: colors.card,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
          }}
        >
          <View className="items-center pt-3 pb-2">
            <View className="w-10 h-1 rounded-full" style={{ backgroundColor: colors.border }} />
          </View>

          <View
            className="flex-row items-center justify-between px-4 pb-3 border-b"
            style={{ borderColor: colors.border }}
          >
            <View className="flex-row items-center flex-1">
              <View
                className="w-10 h-10 rounded-full items-center justify-center"
                style={{ backgroundColor: amountColor + '22' }}
              >
                <Ionicons
                  name={displayPayment.type === 'credit' ? 'arrow-down' : 'arrow-up'}
                  size={20}
                  color={amountColor}
                />
              </View>
              <View className="ml-3 flex-1">
                <Text style={{ color: colors.textMuted }} className="text-xs">Payment Detected</Text>
                <Text style={{ color: colors.text }} className="font-semibold">
                  {displayPayment.bank || 'UPI'} Transaction
                </Text>
                {usingCachedLookups && (
                  <Text style={{ color: '#E8A33D' }} className="text-xs mt-0.5">
                    Offline — showing saved accounts/categories
                  </Text>
                )}
              </View>
            </View>
            <TouchableOpacity onPress={handleDismiss} className="p-2" disabled={isSaving}>
              <Ionicons name="close" size={24} color={isSaving ? colors.textMuted : colors.icon} />
            </TouchableOpacity>
          </View>

          <ScrollView className="p-4 max-h-96">
            <View className="items-center py-4">
              <Text style={{ color: amountColor }} className="text-4xl font-bold">
                {displayPayment.type === 'credit' ? '+' : '-'}
                {formatCurrency(displayPayment.amount)}
              </Text>
              <Text style={{ color: colors.textSecondary }} className="mt-1" numberOfLines={2}>
                {displayPayment.merchant}
              </Text>
              {displayPayment.upiId && (
                <Text style={{ color: colors.textMuted }} className="text-xs mt-1">
                  {displayPayment.upiId}
                </Text>
              )}
              {displayPayment.referenceNumber && (
                <Text style={{ color: colors.textMuted }} className="text-xs mt-1">
                  Ref {displayPayment.referenceNumber}
                </Text>
              )}
            </View>

            <View className="mb-4">
              <Text style={{ color: colors.text }} className="text-sm font-medium mb-2">
                Account
              </Text>
              {sections.length === 0 ? (
                <Text style={{ color: colors.textMuted }} className="text-sm">
                  {sectionsFetching
                    ? 'Loading accounts…'
                    : 'No accounts cached. Connect once while online to load them.'}
                </Text>
              ) : (
                <View className="flex-row flex-wrap gap-2">
                  {sections.map((section) => {
                    const selected = selectedSection === section._id;
                    return (
                      <TouchableOpacity
                        key={section._id}
                        className="px-3 py-2 rounded-full border"
                        style={{
                          borderColor: selected ? colors.primary : colors.border,
                          backgroundColor: selected ? colors.primary + '22' : colors.panel2,
                        }}
                        onPress={() => !isSaving && setSelectedSection(section._id)}
                        disabled={isSaving}
                      >
                        <Text
                          style={{
                            color: selected ? colors.primary : colors.textSecondary,
                            fontWeight: selected ? '600' : '400',
                          }}
                        >
                          {section.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
              {!!selectedSection && (
                <Text style={{ color: colors.textMuted }} className="text-xs mt-2">
                  Selected: {selectedSectionName}
                </Text>
              )}
            </View>

            <View className="mb-4">
              <Text style={{ color: colors.text }} className="text-sm font-medium mb-2">
                Category (optional)
              </Text>
              {categories.length === 0 ? (
                <Text style={{ color: colors.textMuted }} className="text-sm">
                  {categoriesFetching ? 'Loading categories…' : 'No categories cached yet.'}
                </Text>
              ) : (
                <View className="flex-row flex-wrap gap-2">
                  <TouchableOpacity
                    className="px-3 py-2 rounded-full border"
                    style={{
                      borderColor: !selectedCategory ? colors.primary : colors.border,
                      backgroundColor: !selectedCategory ? colors.primary + '22' : colors.panel2,
                    }}
                    onPress={() => !isSaving && setSelectedCategory('')}
                    disabled={isSaving}
                  >
                    <Text
                      style={{
                        color: !selectedCategory ? colors.primary : colors.textSecondary,
                      }}
                    >
                      None
                    </Text>
                  </TouchableOpacity>
                  {orderedCategories.map((category) => {
                    const selected = selectedCategory === category._id;
                    return (
                      <TouchableOpacity
                        key={category._id}
                        className="px-3 py-2 rounded-full border"
                        style={{
                          borderColor: selected ? colors.primary : colors.border,
                          backgroundColor: selected ? colors.primary + '22' : colors.panel2,
                        }}
                        onPress={() => !isSaving && setSelectedCategory(category._id)}
                        disabled={isSaving}
                      >
                        <Text
                          style={{
                            color: selected ? colors.primary : colors.textSecondary,
                          }}
                        >
                          {category.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            <View className="flex-row gap-3 pb-6">
              <TouchableOpacity
                className="flex-1 py-4 rounded-xl items-center"
                style={{ backgroundColor: colors.panel2, opacity: isSaving ? 0.5 : 1 }}
                onPress={handleDismiss}
                disabled={isSaving}
              >
                <Text style={{ color: colors.textSecondary }} className="font-medium">Skip</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 py-4 rounded-xl items-center"
                style={{
                  backgroundColor: isSaving ? colors.primary + '88' : colors.primary,
                }}
                onPress={handleSave}
                disabled={isSaving}
              >
                <Text className="text-white font-semibold">
                  {isSaving ? 'Saving...' : 'Save Transaction'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}
