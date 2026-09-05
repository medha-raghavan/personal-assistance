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
import { Picker } from '@react-native-picker/picker';
import { usePaymentStore } from '../store/paymentStore';
import { useAuthStore } from '../store/authStore';
import { sectionService, categoryService, transactionService } from '../services/api';
import { ParsedPayment } from '../services/paymentParser';
import { useTheme } from './ThemeProvider';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
  }).format(amount);
}

interface Section {
  _id: string;
  name: string;
  type: string;
}

interface Category {
  _id: string;
  name: string;
  color: string;
}

interface PendingPayment extends ParsedPayment {
  id: string;
  timestamp: number;
  dismissed: boolean;
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

function pickDefaultSection(sections: Section[]): string {
  const digitalWallet = sections.find((section) => section.type === 'digital_wallet');
  const checking = sections.find((section) => section.type === 'checking');
  return digitalWallet?._id || checking?._id || sections[0]._id;
}

export function QuickAddOverlay() {
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuthStore();
  const { colors, isDark } = useTheme();
  const { showQuickAdd, currentPayment, hidePaymentOverlay, dismissPayment } = usePaymentStore();

  const [selectedSection, setSelectedSection] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [frozenPayment, setFrozenPayment] = useState<PendingPayment | null>(null);
  const [slideAnim] = useState(new Animated.Value(Dimensions.get('window').height));

  const { data: sections = [] } = useQuery({
    queryKey: ['sections'],
    queryFn: () => sectionService.getAll(),
    enabled: isAuthenticated,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoryService.getAll(),
    enabled: isAuthenticated,
  });

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
    },
    onError: (error: any) => {
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
      setSelectedSection(pickDefaultSection(sections));
    } else {
      setSelectedSection('');
    }
  }, [showQuickAdd, currentPayment?.id, sections, isSaving]);

  const handleSave = () => {
    if (!currentPayment) return;
    if (!selectedSection) {
      Alert.alert('Error', 'Please select an account');
      return;
    }
    if (!Number.isFinite(currentPayment.amount) || currentPayment.amount <= 0) {
      Alert.alert('Error', 'Invalid payment amount');
      return;
    }

    setFrozenPayment(currentPayment);

    createMutation.mutate({
      paymentId: currentPayment.id,
      sectionId: selectedSection,
      amount: currentPayment.amount,
      type: currentPayment.type,
      description: currentPayment.merchant || 'Payment',
      categoryId: selectedCategory || undefined,
      transactionDate: (currentPayment.date ?? new Date()).toISOString(),
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
            <View className="flex-row items-center">
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
              <View className="ml-3">
                <Text style={{ color: colors.textMuted }} className="text-xs">Payment Detected</Text>
                <Text style={{ color: colors.text }} className="font-semibold">
                  {displayPayment.bank || 'UPI'} Transaction
                </Text>
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
            </View>

            <View className="mb-4">
              <Text style={{ color: colors.text }} className="text-sm font-medium mb-1">Account</Text>
              <View
                className="rounded-lg overflow-hidden"
                style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel2 }}
              >
                <Picker
                  selectedValue={selectedSection}
                  onValueChange={(value) => value && setSelectedSection(value)}
                  enabled={!isSaving}
                  style={{ color: colors.text }}
                  dropdownIconColor={colors.icon}
                >
                  <Picker.Item label="Select account..." value="" color={colors.textMuted} />
                  {sections.map((section: Section) => (
                    <Picker.Item
                      key={section._id}
                      label={section.name}
                      value={section._id}
                      color={isDark ? '#f9fafb' : '#111827'}
                    />
                  ))}
                </Picker>
              </View>
            </View>

            <View className="mb-4">
              <Text style={{ color: colors.text }} className="text-sm font-medium mb-1">Category</Text>
              <View
                className="rounded-lg overflow-hidden"
                style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel2 }}
              >
                <Picker
                  selectedValue={selectedCategory}
                  onValueChange={(value) => setSelectedCategory(value)}
                  enabled={!isSaving}
                  style={{ color: colors.text }}
                  dropdownIconColor={colors.icon}
                >
                  <Picker.Item label="Select category (optional)" value="" color={colors.textMuted} />
                  {categories.map((category: Category) => (
                    <Picker.Item
                      key={category._id}
                      label={category.name}
                      value={category._id}
                      color={isDark ? '#f9fafb' : '#111827'}
                    />
                  ))}
                </Picker>
              </View>
            </View>

            <View className="flex-row flex-wrap gap-2 mb-4">
              {categories.slice(0, 6).map((category: Category) => (
                <TouchableOpacity
                  key={category._id}
                  className="px-3 py-2 rounded-full border"
                  style={{
                    borderColor:
                      selectedCategory === category._id ? colors.primary : colors.border,
                    backgroundColor:
                      selectedCategory === category._id
                        ? colors.primary + '22'
                        : colors.panel2,
                  }}
                  onPress={() => !isSaving && setSelectedCategory(category._id)}
                  disabled={isSaving}
                >
                  <Text
                    style={{
                      color:
                        selectedCategory === category._id ? colors.primary : colors.textSecondary,
                    }}
                  >
                    {category.name}
                  </Text>
                </TouchableOpacity>
              ))}
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
