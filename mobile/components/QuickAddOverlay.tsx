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

  return (
    <Modal visible={showQuickAdd} transparent animationType="none">
      <View className="flex-1 bg-black/50 justify-end">
        <Animated.View
          style={{ transform: [{ translateY: slideAnim }] }}
          className="bg-white rounded-t-3xl"
        >
          {/* Handle bar */}
          <View className="items-center pt-3 pb-2">
            <View className="w-10 h-1 bg-gray-300 rounded-full" />
          </View>

          {/* Header */}
          <View className="flex-row items-center justify-between px-4 pb-3 border-b border-gray-100">
            <View className="flex-row items-center">
              <View className="w-10 h-10 bg-green-100 rounded-full items-center justify-center">
                <Ionicons
                  name={currentPayment.type === 'credit' ? 'arrow-down' : 'arrow-up'}
                  size={20}
                  color={currentPayment.type === 'credit' ? '#22c55e' : '#ef4444'}
                />
              </View>
              <View className="ml-3">
                <Text className="text-gray-500 text-xs">Payment Detected</Text>
                <Text className="text-gray-900 font-semibold">
                  {currentPayment.bank || 'UPI'} Transaction
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={handleDismiss} className="p-2">
              <Ionicons name="close" size={24} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          <ScrollView className="p-4 max-h-96">
            {/* Amount Display */}
            <View className="items-center py-4">
              <Text
                className={`text-4xl font-bold ${
                  currentPayment.type === 'credit' ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {currentPayment.type === 'credit' ? '+' : '-'}
                {formatCurrency(currentPayment.amount)}
              </Text>
              <Text className="text-gray-500 mt-1" numberOfLines={2}>
                {currentPayment.merchant}
              </Text>
              {currentPayment.upiId && (
                <Text className="text-gray-400 text-xs mt-1">{currentPayment.upiId}</Text>
              )}
            </View>

            {/* Account Selection */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-1">Account</Text>
              <View className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                <Picker
                  selectedValue={selectedSection}
                  onValueChange={(value) => setSelectedSection(value)}
                >
                  <Picker.Item label="Select account..." value="" />
                  {sections.map((section: Section) => (
                    <Picker.Item key={section._id} label={section.name} value={section._id} />
                  ))}
                </Picker>
              </View>
            </View>

            {/* Category Selection */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-1">Category</Text>
              <View className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                <Picker
                  selectedValue={selectedCategory}
                  onValueChange={(value) => setSelectedCategory(value)}
                >
                  <Picker.Item label="Select category (optional)" value="" />
                  {categories.map((category: Category) => (
                    <Picker.Item key={category._id} label={category.name} value={category._id} />
                  ))}
                </Picker>
              </View>
            </View>

            {/* Quick Category Buttons */}
            <View className="flex-row flex-wrap gap-2 mb-4">
              {categories.slice(0, 6).map((category: Category) => (
                <TouchableOpacity
                  key={category._id}
                  className={`px-3 py-2 rounded-full border ${
                    selectedCategory === category._id
                      ? 'border-sky-500 bg-sky-50'
                      : 'border-gray-200 bg-white'
                  }`}
                  onPress={() => setSelectedCategory(category._id)}
                >
                  <Text
                    className={
                      selectedCategory === category._id ? 'text-sky-600' : 'text-gray-600'
                    }
                  >
                    {category.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Action Buttons */}
            <View className="flex-row gap-3 pb-6">
              <TouchableOpacity
                className="flex-1 py-4 bg-gray-100 rounded-xl items-center"
                onPress={handleDismiss}
              >
                <Text className="text-gray-600 font-medium">Skip</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`flex-1 py-4 rounded-xl items-center ${
                  createMutation.isPending ? 'bg-sky-300' : 'bg-sky-500'
                }`}
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
