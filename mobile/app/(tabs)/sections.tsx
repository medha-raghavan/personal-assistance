import { useState } from 'react';
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
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { sectionService } from '../../services/api';
import { useTheme } from '../../components/ThemeProvider';

const SECTION_TYPES = [
  { value: 'checking', label: 'Bank Account', icon: 'business-outline', color: '#3b82f6' },
  { value: 'savings', label: 'Savings', icon: 'wallet-outline', color: '#22c55e' },
  { value: 'credit', label: 'Credit Card', icon: 'card-outline', color: '#ef4444' },
  { value: 'cash', label: 'Cash', icon: 'cash-outline', color: '#f59e0b' },
  { value: 'investment', label: 'Investment', icon: 'trending-up-outline', color: '#8b5cf6' },
  { value: 'digital_wallet', label: 'Digital Wallet', icon: 'phone-portrait-outline', color: '#06b6d4' },
];

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
  label: string;
  type: string;
  balance: number;
  uploadEnabled: boolean;
  parserConfig?: { type: string };
}

export default function SectionsScreen() {
  const queryClient = useQueryClient();
  const { isDark, colors } = useTheme();
  const [showModal, setShowModal] = useState(false);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    label: '',
    type: 'checking',
    balance: '0',
    uploadEnabled: true,
  });

  const { data: sections = [], isLoading, refetch } = useQuery({
    queryKey: ['sections'],
    queryFn: () => sectionService.getAll(),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      sectionService.create({
        ...data,
        balance: parseFloat(data.balance),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sections'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      closeModal();
      Alert.alert('Success', 'Section created successfully');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to create section');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof formData }) =>
      sectionService.update(id, {
        ...data,
        balance: parseFloat(data.balance),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sections'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      closeModal();
      Alert.alert('Success', 'Section updated successfully');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to update section');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => sectionService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sections'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      Alert.alert('Success', 'Section deleted');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to delete section');
    },
  });

  const openAddModal = () => {
    setEditingSection(null);
    setFormData({
      name: '',
      label: '',
      type: 'checking',
      balance: '0',
      uploadEnabled: true,
    });
    setShowModal(true);
  };

  const openEditModal = (section: Section) => {
    setEditingSection(section);
    setFormData({
      name: section.name,
      label: section.label || '',
      type: section.type,
      balance: section.balance.toString(),
      uploadEnabled: section.uploadEnabled,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingSection(null);
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Please enter a name');
      return;
    }
    if (editingSection) {
      updateMutation.mutate({ id: editingSection._id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (section: Section) => {
    Alert.alert(
      'Delete Section',
      `Are you sure you want to delete "${section.name}"? This will also delete all transactions in this section.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(section._id),
        },
      ]
    );
  };

  const getTypeInfo = (type: string) => {
    return SECTION_TYPES.find((t) => t.value === type) || SECTION_TYPES[0];
  };

  const renderSection = ({ item }: { item: Section }) => {
    const typeInfo = getTypeInfo(item.type);
    return (
      <View style={{ backgroundColor: colors.card }} className="rounded-xl p-4 mb-3 shadow-sm">
        <View className="flex-row items-start justify-between">
          <View className="flex-row items-center flex-1">
            <View
              className="w-12 h-12 rounded-xl items-center justify-center mr-3"
              style={{ backgroundColor: typeInfo.color + '20' }}
            >
              <Ionicons name={typeInfo.icon as any} size={24} color={typeInfo.color} />
            </View>
            <View className="flex-1">
              <Text style={{ color: colors.text }} className="font-semibold text-base">{item.name}</Text>
              {item.label && <Text style={{ color: colors.textMuted }} className="text-sm">{item.label}</Text>}
              <Text style={{ color: colors.textMuted }} className="text-xs mt-1">{typeInfo.label}</Text>
            </View>
          </View>
          <View className="items-end">
            <Text
              className={`text-lg font-bold ${
                item.type === 'credit' && item.balance > 0
                  ? 'text-red-600'
                  : item.balance >= 0
                  ? 'text-green-600'
                  : 'text-red-600'
              }`}
            >
              {item.type === 'credit' && item.balance > 0 ? '-' : ''}
              {formatCurrency(Math.abs(item.balance))}
            </Text>
          </View>
        </View>
        <View className="flex-row justify-end mt-3 pt-3 border-t" style={{ borderTopColor: colors.border }}>
          <TouchableOpacity
            className="flex-row items-center px-3 py-2 mr-2"
            onPress={() => openEditModal(item)}
          >
            <Ionicons name="pencil-outline" size={18} color={colors.textMuted} />
            <Text style={{ color: colors.textMuted }} className="ml-1">Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-row items-center px-3 py-2"
            onPress={() => handleDelete(item)}
          >
            <Ionicons name="trash-outline" size={18} color="#ef4444" />
            <Text className="text-red-500 ml-1">Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={{ backgroundColor: colors.background }} className="flex-1">
      <FlatList
        data={sections}
        keyExtractor={(item) => item._id}
        renderItem={renderSection}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        ListEmptyComponent={
          <View className="items-center py-12">
            <Ionicons name="wallet-outline" size={48} color={colors.textMuted} />
            <Text style={{ color: colors.textMuted }} className="mt-4 text-center">
              No sections yet.{'\n'}Add your first account to start tracking.
            </Text>
          </View>
        }
      />

      <TouchableOpacity
        className="absolute bottom-6 right-6 w-14 h-14 bg-sky-500 rounded-full items-center justify-center shadow-lg"
        onPress={openAddModal}
      >
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>

      <Modal visible={showModal} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <View style={{ backgroundColor: colors.card }} className="rounded-t-3xl max-h-[90%]">
            <View style={{ borderBottomColor: colors.border }} className="flex-row items-center justify-between p-4 border-b">
              <Text style={{ color: colors.text }} className="text-lg font-semibold">
                {editingSection ? 'Edit Section' : 'Add Section'}
              </Text>
              <TouchableOpacity onPress={closeModal}>
                <Ionicons name="close" size={24} color={colors.icon} />
              </TouchableOpacity>
            </View>
            <ScrollView className="p-4">
              <View className="mb-4">
                <Text style={{ color: colors.text }} className="text-sm font-medium mb-1">Name *</Text>
                <TextInput
                  className="rounded-lg px-4 py-3"
                  style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6', color: colors.text }}
                  placeholder="e.g., HDFC Savings"
                  placeholderTextColor={colors.textMuted}
                  value={formData.name}
                  onChangeText={(value) => setFormData({ ...formData, name: value })}
                />
              </View>

              <View className="mb-4">
                <Text style={{ color: colors.text }} className="text-sm font-medium mb-1">Label / Description</Text>
                <TextInput
                  className="rounded-lg px-4 py-3"
                  style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6', color: colors.text }}
                  placeholder="e.g., Primary Savings"
                  placeholderTextColor={colors.textMuted}
                  value={formData.label}
                  onChangeText={(value) => setFormData({ ...formData, label: value })}
                />
              </View>

              <View className="mb-4">
                <Text style={{ color: colors.text }} className="text-sm font-medium mb-2">Account Type</Text>
                <View className="flex-row flex-wrap gap-2">
                  {SECTION_TYPES.map((type) => (
                    <TouchableOpacity
                      key={type.value}
                      className={`flex-row items-center px-3 py-2 rounded-lg border ${
                        formData.type === type.value
                          ? 'border-sky-500'
                          : ''
                      }`}
                      style={{
                        backgroundColor: formData.type === type.value
                          ? (isDark ? '#0c4a6e' : '#e0f2fe')
                          : (isDark ? '#374151' : '#ffffff'),
                        borderColor: formData.type === type.value
                          ? '#0ea5e9'
                          : colors.border,
                      }}
                      onPress={() => setFormData({ ...formData, type: type.value })}
                    >
                      <Ionicons
                        name={type.icon as any}
                        size={18}
                        color={formData.type === type.value ? '#0ea5e9' : colors.textMuted}
                      />
                      <Text
                        className="ml-2"
                        style={{
                          color: formData.type === type.value ? '#0ea5e9' : colors.text,
                        }}
                      >
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View className="mb-4">
                <Text style={{ color: colors.text }} className="text-sm font-medium mb-1">
                  {editingSection ? 'Balance' : 'Initial Balance'}
                </Text>
                <TextInput
                  className="rounded-lg px-4 py-3"
                  style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6', color: colors.text }}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  value={formData.balance}
                  onChangeText={(value) => setFormData({ ...formData, balance: value })}
                  keyboardType="numeric"
                />
              </View>

              <TouchableOpacity
                className={`py-4 rounded-xl items-center mb-6 ${
                  createMutation.isPending || updateMutation.isPending
                    ? 'bg-sky-300'
                    : 'bg-sky-500'
                }`}
                onPress={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                <Text className="text-white font-semibold text-lg">
                  {editingSection ? 'Update Section' : 'Create Section'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
