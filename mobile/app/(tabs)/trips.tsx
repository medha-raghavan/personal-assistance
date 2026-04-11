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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { tripService, Trip } from '../../services/api';
import { useTheme } from '../../components/ThemeProvider';

function formatDate(dateString?: string): string {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function TripsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isDark, colors } = useTheme();
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    defaultCurrency: 'INR',
    inrRate: '1',
    startDate: '',
    endDate: '',
  });

  const { data: trips = [], isLoading, refetch } = useQuery({
    queryKey: ['trips'],
    queryFn: () => tripService.getAll(),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      tripService.create({
        ...data,
        inrRate: parseFloat(data.inrRate),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      closeModal();
      Alert.alert('Success', 'Trip created successfully');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to create trip');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tripService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      Alert.alert('Success', 'Trip deleted');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to delete trip');
    },
  });

  const closeModal = () => {
    setShowAddModal(false);
    setFormData({
      name: '',
      description: '',
      defaultCurrency: 'INR',
      inrRate: '1',
      startDate: '',
      endDate: '',
    });
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Please enter a trip name');
      return;
    }
    createMutation.mutate(formData);
  };

  const handleDelete = (trip: Trip) => {
    Alert.alert(
      'Delete Trip',
      `Are you sure you want to delete "${trip.name}"? All expenses will be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(trip._id),
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return { bg: isDark ? '#166534' : '#dcfce7', text: '#22c55e' };
      case 'completed':
        return { bg: isDark ? '#1e40af' : '#dbeafe', text: '#3b82f6' };
      case 'cancelled':
        return { bg: isDark ? '#374151' : '#f3f4f6', text: '#6b7280' };
      default:
        return { bg: isDark ? '#374151' : '#f3f4f6', text: '#6b7280' };
    }
  };

  const renderTrip = ({ item }: { item: Trip }) => {
    const statusStyle = getStatusColor(item.status);
    return (
      <TouchableOpacity
        style={{ backgroundColor: colors.card }}
        className="rounded-xl p-4 mb-3 shadow-sm"
        onPress={() => router.push(`/trip/${item._id}`)}
      >
        <View className="flex-row items-start justify-between mb-2">
          <View className="flex-1">
            <Text style={{ color: colors.text }} className="font-semibold text-lg">{item.name}</Text>
            {item.description && (
              <Text style={{ color: colors.textMuted }} className="text-sm mt-1" numberOfLines={2}>
                {item.description}
              </Text>
            )}
          </View>
          <View className="px-2 py-1 rounded-full" style={{ backgroundColor: statusStyle.bg }}>
            <Text className="text-xs font-medium" style={{ color: statusStyle.text }}>
              {item.status}
            </Text>
          </View>
        </View>

        <View className="flex-row flex-wrap gap-3 mt-3">
          <View className="flex-row items-center">
            <Ionicons name="people-outline" size={16} color={colors.textMuted} />
            <Text style={{ color: colors.textMuted }} className="text-sm ml-1">
              {item.members.length} member{item.members.length !== 1 ? 's' : ''}
            </Text>
          </View>

          {item.startDate && (
            <View className="flex-row items-center">
              <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted }} className="text-sm ml-1">
                {formatDate(item.startDate)}
                {item.endDate && ` - ${formatDate(item.endDate)}`}
              </Text>
            </View>
          )}

          {item.defaultCurrency !== 'INR' && (
            <View className="flex-row items-center">
              <Ionicons name="cash-outline" size={16} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted }} className="text-sm ml-1">
                1 {item.defaultCurrency} = ₹{item.inrRate}
              </Text>
            </View>
          )}
        </View>

        <View className="flex-row justify-between items-center mt-4 pt-3 border-t" style={{ borderTopColor: colors.border }}>
          <TouchableOpacity
            className="flex-row items-center px-4 py-2 rounded-lg"
            style={{ backgroundColor: isDark ? '#0c4a6e' : '#e0f2fe' }}
            onPress={() => router.push(`/trip/${item._id}`)}
          >
            <Ionicons name="eye-outline" size={18} color="#0ea5e9" />
            <Text className="text-sky-500 font-medium ml-2">View Details</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="p-2"
            onPress={() => handleDelete(item)}
          >
            <Ionicons name="trash-outline" size={20} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ backgroundColor: colors.background }} className="flex-1">
      <FlatList
        data={trips}
        keyExtractor={(item) => item._id}
        renderItem={renderTrip}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        ListEmptyComponent={
          <View className="items-center py-12">
            <Ionicons name="airplane-outline" size={48} color={colors.textMuted} />
            <Text style={{ color: colors.textMuted }} className="mt-4 text-center">
              No trips yet.{'\n'}Create one to start tracking shared expenses.
            </Text>
          </View>
        }
      />

      <TouchableOpacity
        className="absolute bottom-6 right-6 w-14 h-14 bg-sky-500 rounded-full items-center justify-center shadow-lg"
        onPress={() => setShowAddModal(true)}
      >
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>

      <Modal visible={showAddModal} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <View style={{ backgroundColor: colors.card }} className="rounded-t-3xl max-h-[90%]">
            <View style={{ borderBottomColor: colors.border }} className="flex-row items-center justify-between p-4 border-b">
              <Text style={{ color: colors.text }} className="text-lg font-semibold">Create Trip</Text>
              <TouchableOpacity onPress={closeModal}>
                <Ionicons name="close" size={24} color={colors.icon} />
              </TouchableOpacity>
            </View>
            <ScrollView className="p-4">
              <View className="mb-4">
                <Text style={{ color: colors.text }} className="text-sm font-medium mb-1">Trip Name *</Text>
                <TextInput
                  className="rounded-lg px-4 py-3"
                  style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6', color: colors.text }}
                  placeholder="e.g., Goa Trip 2024"
                  placeholderTextColor={colors.textMuted}
                  value={formData.name}
                  onChangeText={(value) => setFormData({ ...formData, name: value })}
                />
              </View>

              <View className="mb-4">
                <Text style={{ color: colors.text }} className="text-sm font-medium mb-1">Description</Text>
                <TextInput
                  className="rounded-lg px-4 py-3"
                  style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6', color: colors.text }}
                  placeholder="Optional description"
                  placeholderTextColor={colors.textMuted}
                  value={formData.description}
                  onChangeText={(value) => setFormData({ ...formData, description: value })}
                  multiline
                />
              </View>

              <View className="flex-row gap-3 mb-4">
                <View className="flex-1">
                  <Text style={{ color: colors.text }} className="text-sm font-medium mb-1">Currency</Text>
                  <TextInput
                    className="rounded-lg px-4 py-3"
                    style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6', color: colors.text }}
                    placeholder="INR"
                    placeholderTextColor={colors.textMuted}
                    value={formData.defaultCurrency}
                    onChangeText={(value) =>
                      setFormData({ ...formData, defaultCurrency: value.toUpperCase() })
                    }
                    autoCapitalize="characters"
                  />
                </View>
                <View className="flex-1">
                  <Text style={{ color: colors.text }} className="text-sm font-medium mb-1">Rate to INR</Text>
                  <TextInput
                    className="rounded-lg px-4 py-3"
                    style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6', color: colors.text }}
                    placeholder="1"
                    placeholderTextColor={colors.textMuted}
                    value={formData.inrRate}
                    onChangeText={(value) => setFormData({ ...formData, inrRate: value })}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <TouchableOpacity
                className={`py-4 rounded-xl items-center mb-6 ${
                  createMutation.isPending ? 'bg-sky-300' : 'bg-sky-500'
                }`}
                onPress={handleSubmit}
                disabled={createMutation.isPending}
              >
                <Text className="text-white font-semibold text-lg">Create Trip</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
