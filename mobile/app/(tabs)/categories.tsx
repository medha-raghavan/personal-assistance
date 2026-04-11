import { useState, useMemo } from 'react';
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
import { categoryService } from '../../services/api';
import { useTheme } from '../../components/ThemeProvider';

const COLOR_OPTIONS = [
  '#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#64748b',
];

interface Category {
  _id: string;
  name: string;
  color: string;
  keywords: string[];
  isDefault: boolean;
}

export default function CategoriesScreen() {
  const queryClient = useQueryClient();
  const { isDark, colors } = useTheme();
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    color: '#3b82f6',
  });
  const [newKeyword, setNewKeyword] = useState<{ categoryId: string; value: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: categories = [], isLoading, refetch } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoryService.getAll(),
  });

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    const query = searchQuery.toLowerCase().trim();
    return categories.filter((category: Category) => {
      const nameMatch = category.name.toLowerCase().includes(query);
      const keywordMatch = category.keywords.some((keyword: string) =>
        keyword.toLowerCase().includes(query)
      );
      return nameMatch || keywordMatch;
    });
  }, [categories, searchQuery]);

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => categoryService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      closeModal();
      Alert.alert('Success', 'Category created successfully');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to create category');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof formData }) =>
      categoryService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      closeModal();
      Alert.alert('Success', 'Category updated successfully');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to update category');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => categoryService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      Alert.alert('Success', 'Category deleted');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to delete category');
    },
  });

  const addKeywordMutation = useMutation({
    mutationFn: ({ id, keyword }: { id: string; keyword: string }) =>
      categoryService.addKeyword(id, keyword),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setNewKeyword(null);
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to add keyword');
    },
  });

  const removeKeywordMutation = useMutation({
    mutationFn: ({ id, keyword }: { id: string; keyword: string }) =>
      categoryService.removeKeyword(id, keyword),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to remove keyword');
    },
  });

  const openAddModal = () => {
    setEditingCategory(null);
    setFormData({ name: '', color: '#3b82f6' });
    setShowModal(true);
  };

  const openEditModal = (category: Category) => {
    setEditingCategory(category);
    setFormData({ name: category.name, color: category.color || '#3b82f6' });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCategory(null);
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Please enter a name');
      return;
    }
    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory._id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (category: Category) => {
    if (category.isDefault) {
      Alert.alert('Cannot Delete', 'Default categories cannot be deleted.');
      return;
    }
    Alert.alert(
      'Delete Category',
      `Are you sure you want to delete "${category.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(category._id),
        },
      ]
    );
  };

  const handleAddKeyword = (categoryId: string) => {
    if (newKeyword?.value.trim()) {
      addKeywordMutation.mutate({ id: categoryId, keyword: newKeyword.value.trim() });
    }
  };

  const renderCategory = ({ item }: { item: Category }) => {
    const isAddingKeyword = newKeyword?.categoryId === item._id;

    return (
      <View style={{ backgroundColor: colors.card }} className="rounded-xl p-4 mb-3 shadow-sm">
        <View className="flex-row items-start justify-between mb-3">
          <View className="flex-row items-center flex-1">
            <View
              className="w-10 h-10 rounded-lg items-center justify-center mr-3"
              style={{ backgroundColor: item.color || '#6b7280' }}
            >
              <Ionicons name="pricetag" size={20} color="white" />
            </View>
            <View className="flex-1">
              <Text style={{ color: colors.text }} className="font-semibold">{item.name}</Text>
              <Text style={{ color: colors.textMuted }} className="text-xs">
                {item.keywords.length} keyword{item.keywords.length !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>
          <View className="flex-row">
            <TouchableOpacity className="p-2" onPress={() => openEditModal(item)}>
              <Ionicons name="pencil-outline" size={18} color={colors.icon} />
            </TouchableOpacity>
            {!item.isDefault && (
              <TouchableOpacity className="p-2" onPress={() => handleDelete(item)}>
                <Ionicons name="trash-outline" size={18} color="#ef4444" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Keywords */}
        <View className="flex-row flex-wrap gap-2 mb-3">
          {item.keywords.map((keyword) => (
            <View
              key={keyword}
              className="flex-row items-center rounded-full px-3 py-1"
              style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6' }}
            >
              <Text style={{ color: colors.textSecondary }} className="text-sm">{keyword}</Text>
              <TouchableOpacity
                className="ml-2"
                onPress={() => removeKeywordMutation.mutate({ id: item._id, keyword })}
              >
                <Ionicons name="close-circle" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          ))}
          {item.keywords.length === 0 && (
            <Text style={{ color: colors.textMuted }} className="text-sm italic">No keywords</Text>
          )}
        </View>

        {/* Add Keyword */}
        {isAddingKeyword ? (
          <View className="flex-row items-center gap-2">
            <TextInput
              className="flex-1 rounded-lg px-3 py-2"
              style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6', color: colors.text }}
              placeholder="Enter keyword..."
              placeholderTextColor={colors.textMuted}
              value={newKeyword.value}
              onChangeText={(value) => setNewKeyword({ ...newKeyword, value })}
              autoFocus
              onSubmitEditing={() => handleAddKeyword(item._id)}
            />
            <TouchableOpacity
              className="bg-sky-500 rounded-lg px-3 py-2"
              onPress={() => handleAddKeyword(item._id)}
            >
              <Text className="text-white font-medium">Add</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="rounded-lg px-3 py-2"
              style={{ backgroundColor: isDark ? '#374151' : '#e5e7eb' }}
              onPress={() => setNewKeyword(null)}
            >
              <Text style={{ color: colors.textSecondary }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            className="flex-row items-center"
            onPress={() => setNewKeyword({ categoryId: item._id, value: '' })}
          >
            <Ionicons name="add-circle-outline" size={18} color="#0ea5e9" />
            <Text className="text-sky-500 ml-1">Add Keyword</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={{ backgroundColor: colors.background }} className="flex-1">
      {/* Search Bar */}
      <View style={{ backgroundColor: colors.card, borderColor: colors.border }} className="px-4 py-3 border-b">
        <View 
          className="flex-row items-center rounded-lg px-3 py-2"
          style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6' }}
        >
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            className="flex-1 ml-2"
            style={{ color: colors.text }}
            placeholder="Search by category or keyword..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={filteredCategories}
        keyExtractor={(item) => item._id}
        renderItem={renderCategory}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        ListEmptyComponent={
          <View className="items-center py-12">
            <Ionicons name="pricetags-outline" size={48} color={colors.textMuted} />
            <Text style={{ color: colors.textMuted }} className="mt-4 text-center">
              {searchQuery 
                ? 'No categories match your search.'
                : 'No categories yet.\nCreate one to organize your transactions.'}
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
          <View style={{ backgroundColor: colors.card }} className="rounded-t-3xl">
            <View className="flex-row items-center justify-between p-4 border-b" style={{ borderColor: colors.border }}>
              <Text style={{ color: colors.text }} className="text-lg font-semibold">
                {editingCategory ? 'Edit Category' : 'Add Category'}
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
                  placeholder="e.g., Food & Dining"
                  placeholderTextColor={colors.textMuted}
                  value={formData.name}
                  onChangeText={(value) => setFormData({ ...formData, name: value })}
                />
              </View>

              <View className="mb-4">
                <Text style={{ color: colors.text }} className="text-sm font-medium mb-2">Color</Text>
                <View className="flex-row flex-wrap gap-3">
                  {COLOR_OPTIONS.map((color) => (
                    <TouchableOpacity
                      key={color}
                      className={`w-10 h-10 rounded-full ${
                        formData.color === color ? 'border-2' : ''
                      }`}
                      style={{ 
                        backgroundColor: color,
                        borderColor: formData.color === color ? colors.text : 'transparent'
                      }}
                      onPress={() => setFormData({ ...formData, color })}
                    />
                  ))}
                </View>
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
                  {editingCategory ? 'Update Category' : 'Create Category'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
