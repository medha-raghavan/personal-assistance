import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { sectionService, categoryService, transactionService } from '../../services/api';
import { useTheme } from '../../components/ThemeProvider';

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

export default function AddTransactionScreen() {
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

  const { data: sections = [] } = useQuery({
    queryKey: ['sections'],
    queryFn: () => sectionService.getAll(),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoryService.getAll(),
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
    <ScrollView style={{ backgroundColor: colors.background }} className="flex-1">
      <View className="p-4 space-y-4">
        {/* Date Picker */}
        <View style={{ backgroundColor: colors.card }} className="rounded-xl p-4 shadow-sm">
          <Text style={{ color: colors.text }} className="font-medium mb-2">Date</Text>
          <TouchableOpacity
            className="flex-row items-center justify-between rounded-lg px-4 py-3"
            style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6' }}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={{ color: colors.text }}>
              {formData.transactionDate.toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
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

        {/* Account Selection */}
        <View style={{ backgroundColor: colors.card }} className="rounded-xl p-4 shadow-sm">
          <Text style={{ color: colors.text }} className="font-medium mb-2">Account *</Text>
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

        {/* Type Selection */}
        <View style={{ backgroundColor: colors.card }} className="rounded-xl p-4 shadow-sm">
          <Text style={{ color: colors.text }} className="font-medium mb-2">Type</Text>
          <View className="flex-row">
            <TouchableOpacity
              className={`flex-1 py-4 rounded-l-xl items-center ${
                formData.type === 'debit' ? 'bg-red-500' : ''
              }`}
              style={formData.type !== 'debit' ? { backgroundColor: isDark ? '#374151' : '#f3f4f6' } : {}}
              onPress={() => setFormData({ ...formData, type: 'debit' })}
            >
              <Ionicons
                name="arrow-up-circle"
                size={24}
                color={formData.type === 'debit' ? 'white' : colors.icon}
              />
              <Text
                className="mt-1 font-medium"
                style={{ color: formData.type === 'debit' ? 'white' : colors.text }}
              >
                Expense
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`flex-1 py-4 rounded-r-xl items-center ${
                formData.type === 'credit' ? 'bg-green-500' : ''
              }`}
              style={formData.type !== 'credit' ? { backgroundColor: isDark ? '#374151' : '#f3f4f6' } : {}}
              onPress={() => setFormData({ ...formData, type: 'credit' })}
            >
              <Ionicons
                name="arrow-down-circle"
                size={24}
                color={formData.type === 'credit' ? 'white' : colors.icon}
              />
              <Text
                className="mt-1 font-medium"
                style={{ color: formData.type === 'credit' ? 'white' : colors.text }}
              >
                Income
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Amount */}
        <View style={{ backgroundColor: colors.card }} className="rounded-xl p-4 shadow-sm">
          <Text style={{ color: colors.text }} className="font-medium mb-2">Amount *</Text>
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
        <View style={{ backgroundColor: colors.card }} className="rounded-xl p-4 shadow-sm">
          <Text style={{ color: colors.text }} className="font-medium mb-2">Description *</Text>
          <TextInput
            className="rounded-lg px-4 py-3"
            style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6', color: colors.text }}
            placeholder="What's this for?"
            placeholderTextColor={colors.textMuted}
            value={formData.description}
            onChangeText={(value) => setFormData({ ...formData, description: value })}
            multiline
            numberOfLines={2}
          />
        </View>

        {/* Category */}
        <View style={{ backgroundColor: colors.card }} className="rounded-xl p-4 shadow-sm">
          <Text style={{ color: colors.text }} className="font-medium mb-2">Category</Text>
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
        <View style={{ backgroundColor: colors.card }} className="rounded-xl p-4 shadow-sm">
          <Text style={{ color: colors.text }} className="font-medium mb-2">Tags</Text>
          <TextInput
            className="rounded-lg px-4 py-3"
            style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6', color: colors.text }}
            placeholder="Enter tags separated by commas"
            placeholderTextColor={colors.textMuted}
            value={formData.tags}
            onChangeText={(value) => setFormData({ ...formData, tags: value })}
          />
          <Text style={{ color: colors.textMuted }} className="text-xs mt-1">
            e.g., groceries, food, online
          </Text>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          className={`py-4 rounded-xl items-center flex-row justify-center ${
            createMutation.isPending ? 'bg-sky-300' : 'bg-sky-500'
          }`}
          onPress={handleSubmit}
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={24} color="white" />
              <Text className="text-white font-semibold text-lg ml-2">Add Transaction</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Quick Reset */}
        <TouchableOpacity
          className="py-3 items-center"
          onPress={resetForm}
        >
          <Text style={{ color: colors.textSecondary }}>Clear Form</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
