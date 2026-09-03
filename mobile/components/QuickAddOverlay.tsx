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

export function QuickAddOverlay() {
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuthStore();
  const { colors, isDark } = useTheme();
  const { showQuickAdd, currentPayment, hidePaymentOverlay, dismissPayment, clearCurrentPayment } =
    usePaymentStore();

  const [selectedSection, setSelectedSection] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
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

  useEffect(() => {
    if (showQuickAdd) {
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
  }, [showQuickAdd]);

  useEffect(() => {
    if (sections.length > 0 && !selectedSection) {
      const digitalWallet = sections.find((s: Section) => s.type === 'digital_wallet');
      const checking = sections.find((s: Section) => s.type === 'checking');
      setSelectedSection(digitalWallet?._id || checking?._id || sections[0]._id);
    }
  }, [sections, selectedSection]);

  const createMutation = useMutation({
    mutationFn: (data: {
      sectionId: string;
      amount: number;
      type: 'credit' | 'debit';
      description: string;
      categoryId?: string;
      transactionDate: string;
    }) => transactionService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['sections'] });
      Alert.alert('Success', 'Transaction recorded!');
      handleClose();
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to save transaction');
    },
  });

  const handleSave = () => {
    if (!currentPayment) return;
    if (!selectedSection) {
      Alert.alert('Error', 'Please select an account');
      return;
    }

    createMutation.mutate({
      sectionId: selectedSection,
      amount: currentPayment.amount,
      type: currentPayment.type,
      description: currentPayment.merchant || 'Payment',
      categoryId: selectedCategory || undefined,
      transactionDate: new Date().toISOString(),
    });
  };

  const handleClose = () => {
    if (currentPayment) {
      dismissPayment(currentPayment.id);
    }
    clearCurrentPayment();
    setSelectedCategory('');
  };

  const handleDismiss = () => {
    if (currentPayment) {
      dismissPayment(currentPayment.id);
    }
    hidePaymentOverlay();
  };

  if (!showQuickAdd || !currentPayment || !isAuthenticated) {
    return null;
  }

  const amountColor = currentPayment.type === 'credit' ? colors.income : colors.expense;

  return (
    <Modal visible={showQuickAdd} transparent animationType="none">
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
                  name={currentPayment.type === 'credit' ? 'arrow-down' : 'arrow-up'}
                  size={20}
                  color={amountColor}
                />
              </View>
              <View className="ml-3">
                <Text style={{ color: colors.textMuted }} className="text-xs">Payment Detected</Text>
                <Text style={{ color: colors.text }} className="font-semibold">
                  {currentPayment.bank || 'UPI'} Transaction
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={handleDismiss} className="p-2">
              <Ionicons name="close" size={24} color={colors.icon} />
            </TouchableOpacity>
          </View>

          <ScrollView className="p-4 max-h-96">
            <View className="items-center py-4">
              <Text style={{ color: amountColor }} className="text-4xl font-bold">
                {currentPayment.type === 'credit' ? '+' : '-'}
                {formatCurrency(currentPayment.amount)}
              </Text>
              <Text style={{ color: colors.textSecondary }} className="mt-1" numberOfLines={2}>
                {currentPayment.merchant}
              </Text>
              {currentPayment.upiId && (
                <Text style={{ color: colors.textMuted }} className="text-xs mt-1">
                  {currentPayment.upiId}
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
                  onValueChange={(value) => setSelectedSection(value)}
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
                  onPress={() => setSelectedCategory(category._id)}
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
                style={{ backgroundColor: colors.panel2 }}
                onPress={handleDismiss}
              >
                <Text style={{ color: colors.textSecondary }} className="font-medium">Skip</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 py-4 rounded-xl items-center"
                style={{
                  backgroundColor: createMutation.isPending
                    ? colors.primary + '88'
                    : colors.primary,
                }}
                onPress={handleSave}
                disabled={createMutation.isPending}
              >
                <Text className="text-white font-semibold">
                  {createMutation.isPending ? 'Saving...' : 'Save Transaction'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}
