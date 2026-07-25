import { useEffect, useMemo, useState } from 'react';
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
  Image,
  Platform,
  ActivityIndicator,
  Linking,
  AppState,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  whatsappService,
  googleService,
  ScheduledWhatsAppMessage,
  ScheduledMessageStatus,
  GoogleContact,
  GoogleContactPhone,
} from '../../services/api';
import { useTheme } from '../../components/ThemeProvider';

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'sent', label: 'Sent' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
];

function formatDateTime(dateString?: string): string {
  if (!dateString) return '';
  return new Date(dateString).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function defaultScheduleDate(): Date {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setSeconds(0, 0);
  return d;
}

export default function WhatsAppScreen() {
  const queryClient = useQueryClient();
  const { isDark, colors } = useTheme();
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCompose, setShowCompose] = useState(false);
  const [editing, setEditing] = useState<ScheduledWhatsAppMessage | null>(null);

  const {
    data: connection,
    isLoading: connectionLoading,
    refetch: refetchStatus,
  } = useQuery({
    queryKey: ['whatsapp-status'],
    queryFn: () => whatsappService.getStatus(),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'qr' || status === 'connecting' ? 2000 : 10000;
    },
  });

  const {
    data: messages = [],
    isLoading: messagesLoading,
    refetch: refetchMessages,
  } = useQuery({
    queryKey: ['whatsapp-messages', statusFilter],
    queryFn: () => whatsappService.getMessages(statusFilter),
    refetchInterval: 15000,
  });

  const {
    data: googleStatus,
    isLoading: googleLoading,
    refetch: refetchGoogle,
  } = useQuery({
    queryKey: ['google-status'],
    queryFn: () => googleService.getStatus(),
  });

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        queryClient.invalidateQueries({ queryKey: ['google-status'] });
      }
    });
    return () => sub.remove();
  }, [queryClient]);

  const connectMutation = useMutation({
    mutationFn: () => whatsappService.connect(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-status'] });
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to connect');
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () => whatsappService.disconnect(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-status'] });
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to disconnect');
    },
  });

  const googleConnectMutation = useMutation({
    mutationFn: () => googleService.getAuthUrl('mobile'),
    onSuccess: async (url) => {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert('Error', 'Cannot open Google sign-in URL');
        return;
      }
      await Linking.openURL(url);
      Alert.alert(
        'Complete sign-in',
        'Finish Google sign-in in the browser, then return here. Pull to refresh if needed.'
      );
    },
    onError: (error: any) => {
      Alert.alert(
        'Error',
        error.response?.data?.error?.message || 'Failed to start Google sign-in'
      );
    },
  });

  const googleDisconnectMutation = useMutation({
    mutationFn: () => googleService.disconnect(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-status'] });
      queryClient.removeQueries({ queryKey: ['google-contacts'] });
      Alert.alert('Disconnected', 'Google Contacts disconnected');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to disconnect Google');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => whatsappService.cancelMessage(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages'] });
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to cancel');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => whatsappService.deleteMessage(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages'] });
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to delete');
    },
  });

  const isConnected = connection?.status === 'connected';
  const showQr = connection?.status === 'qr' && !!connection.qrDataUrl;
  const googleConnected = !!googleStatus?.connected;

  const pendingCount = useMemo(
    () => messages.filter((m) => m.status === 'pending').length,
    [messages]
  );

  const getStatusStyle = (status: ScheduledMessageStatus) => {
    switch (status) {
      case 'sent':
        return { bg: isDark ? '#166534' : '#dcfce7', text: '#22c55e' };
      case 'pending':
      case 'sending':
        return { bg: isDark ? '#1e40af' : '#dbeafe', text: '#3b82f6' };
      case 'failed':
        return { bg: isDark ? '#7f1d1d' : '#fee2e2', text: '#ef4444' };
      case 'cancelled':
        return { bg: isDark ? '#78350f' : '#fef3c7', text: '#f59e0b' };
      default:
        return { bg: isDark ? '#374151' : '#f3f4f6', text: '#6b7280' };
    }
  };

  const handleRefresh = async () => {
    await Promise.all([refetchStatus(), refetchMessages(), refetchGoogle()]);
  };

  const openCompose = (message?: ScheduledWhatsAppMessage) => {
    if (!message && !isConnected) {
      Alert.alert('Not Connected', 'Connect WhatsApp before scheduling messages.');
      return;
    }
    setEditing(message || null);
    setShowCompose(true);
  };

  const handleDisconnect = () => {
    Alert.alert(
      'Disconnect WhatsApp',
      'This clears the saved session. You will need to scan a new QR code.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: () => disconnectMutation.mutate(),
        },
      ]
    );
  };

  const renderMessage = ({ item }: { item: ScheduledWhatsAppMessage }) => {
    const statusStyle = getStatusStyle(item.status);
    return (
      <View style={{ backgroundColor: colors.card }} className="rounded-xl p-4 mb-3 shadow-sm">
        <View className="flex-row items-start justify-between mb-2">
          <View className="flex-1 mr-2">
            <View className="flex-row items-center flex-wrap gap-2 mb-1">
              <View className="px-2 py-1 rounded-full" style={{ backgroundColor: statusStyle.bg }}>
                <Text className="text-xs font-medium capitalize" style={{ color: statusStyle.text }}>
                  {item.status}
                </Text>
              </View>
              <Text style={{ color: colors.text }} className="font-semibold">
                {item.recipientName || `+${item.recipientPhone}`}
              </Text>
            </View>
            {item.recipientName ? (
              <Text style={{ color: colors.textMuted }} className="text-xs mb-1">
                +{item.recipientPhone}
              </Text>
            ) : null}
            <Text style={{ color: colors.text }} className="mt-1">
              {item.message}
            </Text>
            <Text style={{ color: colors.textMuted }} className="text-xs mt-2">
              Scheduled {formatDateTime(item.scheduledAt)}
            </Text>
            {item.sentAt ? (
              <Text style={{ color: colors.textMuted }} className="text-xs mt-1">
                Sent {formatDateTime(item.sentAt)}
              </Text>
            ) : null}
            {item.error ? (
              <Text className="text-red-500 text-xs mt-2">{item.error}</Text>
            ) : null}
          </View>
          <View className="flex-row">
            {item.status === 'pending' && (
              <>
                <TouchableOpacity className="p-2" onPress={() => openCompose(item)}>
                  <Ionicons name="pencil-outline" size={18} color={colors.icon} />
                </TouchableOpacity>
                <TouchableOpacity
                  className="p-2"
                  onPress={() =>
                    Alert.alert('Cancel message', 'Cancel this scheduled message?', [
                      { text: 'No', style: 'cancel' },
                      {
                        text: 'Cancel',
                        style: 'destructive',
                        onPress: () => cancelMutation.mutate(item._id),
                      },
                    ])
                  }
                >
                  <Ionicons name="close-circle-outline" size={18} color="#f59e0b" />
                </TouchableOpacity>
              </>
            )}
            {item.status !== 'sending' && (
              <TouchableOpacity
                className="p-2"
                onPress={() =>
                  Alert.alert('Delete message', 'Delete this message?', [
                    { text: 'No', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: () => deleteMutation.mutate(item._id),
                    },
                  ])
                }
              >
                <Ionicons name="trash-outline" size={18} color="#ef4444" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  const listHeader = (
    <View className="mb-4">
      <View style={{ backgroundColor: colors.card }} className="rounded-xl p-4 shadow-sm mb-4">
        <View className="flex-row items-center mb-3">
          <View
            className="w-10 h-10 rounded-full items-center justify-center mr-3"
            style={{ backgroundColor: isConnected ? '#dcfce7' : isDark ? '#374151' : '#f3f4f6' }}
          >
            <Ionicons
              name={isConnected ? 'wifi' : 'wifi-outline'}
              size={22}
              color={isConnected ? '#22c55e' : colors.icon}
            />
          </View>
          <View className="flex-1">
            <Text style={{ color: colors.text }} className="font-semibold">
              Account connection
            </Text>
            <Text style={{ color: colors.textMuted }} className="text-sm">
              {connectionLoading
                ? 'Checking status...'
                : isConnected
                  ? `Connected${connection?.phoneNumber ? ` as +${connection.phoneNumber}` : ''}`
                  : connection?.status === 'qr'
                    ? 'Scan the QR code with WhatsApp'
                    : connection?.status === 'connecting'
                      ? 'Connecting...'
                      : connection?.hasSavedSession
                        ? 'Session saved — reconnect to resume'
                        : 'Not connected'}
            </Text>
          </View>
        </View>

        {connection?.lastError ? (
          <View
            className="rounded-lg p-3 mb-3"
            style={{ backgroundColor: isDark ? '#7f1d1d33' : '#fee2e2' }}
          >
            <Text className="text-red-500 text-sm">{connection.lastError}</Text>
          </View>
        ) : null}

        <View className="flex-row flex-wrap gap-2 mb-3">
          {!isConnected && (
            <TouchableOpacity
              className="bg-sky-500 px-4 py-2.5 rounded-xl flex-row items-center"
              onPress={() => connectMutation.mutate()}
              disabled={connectMutation.isPending || connection?.status === 'connecting'}
            >
              {connectMutation.isPending || connection?.status === 'connecting' ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Ionicons name="qr-code-outline" size={18} color="white" />
              )}
              <Text className="text-white font-medium ml-2">
                {connection?.hasSavedSession ? 'Reconnect' : 'Connect WhatsApp'}
              </Text>
            </TouchableOpacity>
          )}
          {(isConnected || connection?.hasSavedSession || connection?.status === 'qr') && (
            <TouchableOpacity
              className="bg-red-500 px-4 py-2.5 rounded-xl"
              onPress={handleDisconnect}
              disabled={disconnectMutation.isPending}
            >
              <Text className="text-white font-medium">Disconnect</Text>
            </TouchableOpacity>
          )}
        </View>

        {showQr && connection?.qrDataUrl ? (
          <View className="items-center py-2">
            <View className="bg-white p-3 rounded-xl">
              <Image
                source={{ uri: connection.qrDataUrl }}
                style={{ width: 220, height: 220 }}
                resizeMode="contain"
              />
            </View>
            <Text style={{ color: colors.textMuted }} className="text-xs mt-3 text-center px-2">
              WhatsApp → Linked devices → Link a device
            </Text>
          </View>
        ) : isConnected ? (
          <View className="items-center py-3">
            <Ionicons name="checkmark-circle" size={40} color="#22c55e" />
            <Text className="text-green-500 font-medium mt-1">Ready to send</Text>
            {pendingCount > 0 ? (
              <Text style={{ color: colors.textMuted }} className="text-sm mt-1">
                {pendingCount} pending message{pendingCount === 1 ? '' : 's'}
              </Text>
            ) : null}
          </View>
        ) : (
          <Text style={{ color: colors.textMuted }} className="text-xs">
            Uses an unofficial multi-device connection. Keep your server private.
          </Text>
        )}
      </View>

      <View style={{ backgroundColor: colors.card }} className="rounded-xl p-4 shadow-sm mb-4">
        <View className="flex-row items-center mb-3">
          <View
            className="w-10 h-10 rounded-full items-center justify-center mr-3"
            style={{
              backgroundColor: googleConnected
                ? isDark
                  ? '#1e3a8a'
                  : '#dbeafe'
                : isDark
                  ? '#374151'
                  : '#f3f4f6',
            }}
          >
            <Ionicons
              name="logo-google"
              size={22}
              color={googleConnected ? '#3b82f6' : colors.icon}
            />
          </View>
          <View className="flex-1">
            <Text style={{ color: colors.text }} className="font-semibold">
              Google Contacts
            </Text>
            <Text style={{ color: colors.textMuted }} className="text-sm">
              {googleLoading
                ? 'Checking status...'
                : !googleStatus?.configured
                  ? 'Not configured on server'
                  : googleConnected
                    ? `Connected${googleStatus.email ? ` as ${googleStatus.email}` : ''}`
                    : 'Connect to pick message recipients'}
            </Text>
          </View>
        </View>
        <View className="flex-row flex-wrap gap-2">
          {googleStatus?.configured && !googleConnected && (
            <TouchableOpacity
              className="bg-sky-500 px-4 py-2.5 rounded-xl flex-row items-center"
              onPress={() => googleConnectMutation.mutate()}
              disabled={googleConnectMutation.isPending}
            >
              {googleConnectMutation.isPending ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Ionicons name="people-outline" size={18} color="white" />
              )}
              <Text className="text-white font-medium ml-2">Connect Google</Text>
            </TouchableOpacity>
          )}
          {googleConnected && (
            <TouchableOpacity
              className="px-4 py-2.5 rounded-xl"
              style={{ backgroundColor: isDark ? '#374151' : '#e5e7eb' }}
              onPress={() =>
                Alert.alert('Disconnect Google', 'Disconnect Google Contacts?', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Disconnect',
                    style: 'destructive',
                    onPress: () => googleDisconnectMutation.mutate(),
                  },
                ])
              }
              disabled={googleDisconnectMutation.isPending}
            >
              <Text style={{ color: colors.text }} className="font-medium">
                Disconnect Google
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View className="flex-row items-center justify-between mb-3">
        <Text style={{ color: colors.text }} className="text-lg font-semibold">
          Messages
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
        <View className="flex-row gap-2">
          {STATUS_FILTERS.map((filter) => {
            const active = statusFilter === filter.value;
            return (
              <TouchableOpacity
                key={filter.value}
                onPress={() => setStatusFilter(filter.value)}
                className="px-3 py-1.5 rounded-full"
                style={{
                  backgroundColor: active
                    ? colors.primary
                    : isDark
                      ? '#374151'
                      : '#e5e7eb',
                }}
              >
                <Text
                  className="text-sm font-medium"
                  style={{ color: active ? 'white' : colors.text }}
                >
                  {filter.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );

  return (
    <View style={{ backgroundColor: colors.background }} className="flex-1">
      <FlatList
        data={messages}
        keyExtractor={(item) => item._id}
        renderItem={renderMessage}
        ListHeaderComponent={listHeader}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={connectionLoading || messagesLoading}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          !messagesLoading ? (
            <View
              style={{ backgroundColor: colors.card }}
              className="rounded-xl p-8 items-center shadow-sm"
            >
              <Ionicons name="time-outline" size={40} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted }} className="mt-3 mb-4 text-center">
                No messages yet.
              </Text>
              <TouchableOpacity
                className="bg-sky-500 px-4 py-2.5 rounded-xl"
                onPress={() => openCompose()}
                disabled={!isConnected}
              >
                <Text className="text-white font-medium">Schedule your first message</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
      />

      <TouchableOpacity
        className="absolute bottom-6 right-6 w-14 h-14 bg-sky-500 rounded-full items-center justify-center shadow-lg"
        onPress={() => openCompose()}
        disabled={!isConnected}
        style={{ opacity: isConnected ? 1 : 0.5 }}
      >
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>

      <ComposeModal
        visible={showCompose}
        onClose={() => {
          setShowCompose(false);
          setEditing(null);
        }}
        message={editing}
        isConnected={!!isConnected}
        googleConnected={googleConnected}
        onConnectGoogle={() => googleConnectMutation.mutate()}
        connectingGoogle={googleConnectMutation.isPending}
      />
    </View>
  );
}

function ComposeModal({
  visible,
  onClose,
  message,
  isConnected,
  googleConnected,
  onConnectGoogle,
  connectingGoogle,
}: {
  visible: boolean;
  onClose: () => void;
  message: ScheduledWhatsAppMessage | null;
  isConnected: boolean;
  googleConnected: boolean;
  onConnectGoogle: () => void;
  connectingGoogle: boolean;
}) {
  const queryClient = useQueryClient();
  const { isDark, colors } = useTheme();
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [body, setBody] = useState('');
  const [scheduledAt, setScheduledAt] = useState(defaultScheduleDate());
  const [sendMode, setSendMode] = useState<'schedule' | 'now'>('schedule');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showContacts, setShowContacts] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (message) {
      setRecipientPhone(message.recipientPhone);
      setRecipientName(message.recipientName || '');
      setBody(message.message);
      setScheduledAt(new Date(message.scheduledAt));
      setSendMode('schedule');
    } else {
      setRecipientPhone('');
      setRecipientName('');
      setBody('');
      setScheduledAt(defaultScheduleDate());
      setSendMode('schedule');
    }
    setShowContacts(false);
  }, [message, visible]);

  const createMutation = useMutation({
    mutationFn: (payload: {
      recipientPhone: string;
      recipientName?: string;
      message: string;
      scheduledAt?: string;
      sendNow?: boolean;
    }) => whatsappService.createMessage(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages'] });
      onClose();
      Alert.alert('Success', sendMode === 'now' ? 'Message sent' : 'Message scheduled');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to create message');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: {
      recipientPhone: string;
      recipientName?: string;
      message: string;
      scheduledAt: string;
    }) => whatsappService.updateMessage(message!._id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages'] });
      onClose();
      Alert.alert('Success', 'Message updated');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to update message');
    },
  });

  const handleSubmit = () => {
    if (!recipientPhone.trim() || !body.trim()) {
      Alert.alert('Error', 'Phone number and message are required');
      return;
    }

    if (message) {
      updateMutation.mutate({
        recipientPhone: recipientPhone.trim(),
        recipientName: recipientName.trim() || undefined,
        message: body.trim(),
        scheduledAt: scheduledAt.toISOString(),
      });
      return;
    }

    if (sendMode === 'now') {
      if (!isConnected) {
        Alert.alert('Error', 'Connect WhatsApp before sending now');
        return;
      }
      createMutation.mutate({
        recipientPhone: recipientPhone.trim(),
        recipientName: recipientName.trim() || undefined,
        message: body.trim(),
        sendNow: true,
      });
    } else {
      createMutation.mutate({
        recipientPhone: recipientPhone.trim(),
        recipientName: recipientName.trim() || undefined,
        message: body.trim(),
        scheduledAt: scheduledAt.toISOString(),
      });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <>
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1 bg-black/50 justify-end">
        <View
          style={{ backgroundColor: colors.card }}
          className="rounded-t-3xl max-h-[92%]"
        >
          <View
            className="flex-row items-center justify-between p-4 border-b"
            style={{ borderColor: colors.border }}
          >
            <Text style={{ color: colors.text }} className="text-lg font-semibold">
              {message ? 'Edit message' : 'Schedule WhatsApp message'}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.icon} />
            </TouchableOpacity>
          </View>

          <ScrollView className="p-4" keyboardShouldPersistTaps="handled">
            <Text style={{ color: colors.textSecondary }} className="text-sm mb-1">
              Phone number (with country code)
            </Text>
            <View className="flex-row gap-2 mb-3">
              <TextInput
                value={recipientPhone}
                onChangeText={setRecipientPhone}
                placeholder="e.g. 919876543210"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
                style={{
                  backgroundColor: isDark ? '#111827' : '#f9fafb',
                  color: colors.text,
                  borderColor: colors.border,
                }}
                className="flex-1 border rounded-xl px-3 py-3"
              />
              <TouchableOpacity
                className="px-3 rounded-xl items-center justify-center"
                style={{ backgroundColor: isDark ? '#374151' : '#e5e7eb' }}
                onPress={() => {
                  if (!googleConnected) {
                    onConnectGoogle();
                    return;
                  }
                  setShowContacts(true);
                }}
                disabled={connectingGoogle}
              >
                {connectingGoogle ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons name="people-outline" size={22} color={colors.primary} />
                )}
              </TouchableOpacity>
            </View>

            <Text style={{ color: colors.textSecondary }} className="text-sm mb-1">
              Recipient name (optional)
            </Text>
            <TextInput
              value={recipientName}
              onChangeText={setRecipientName}
              placeholder="e.g. Mom"
              placeholderTextColor={colors.textMuted}
              style={{
                backgroundColor: isDark ? '#111827' : '#f9fafb',
                color: colors.text,
                borderColor: colors.border,
              }}
              className="border rounded-xl px-3 py-3 mb-3"
            />

            <Text style={{ color: colors.textSecondary }} className="text-sm mb-1">
              Message
            </Text>
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder="Type your WhatsApp message..."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              maxLength={4096}
              style={{
                backgroundColor: isDark ? '#111827' : '#f9fafb',
                color: colors.text,
                borderColor: colors.border,
                minHeight: 120,
              }}
              className="border rounded-xl px-3 py-3 mb-1"
            />
            <Text style={{ color: colors.textMuted }} className="text-xs text-right mb-3">
              {body.length}/4096
            </Text>

            {!message && (
              <View className="flex-row gap-2 mb-3">
                <TouchableOpacity
                  className="flex-1 py-2.5 rounded-xl border items-center"
                  style={{
                    borderColor: sendMode === 'schedule' ? colors.primary : colors.border,
                    backgroundColor:
                      sendMode === 'schedule'
                        ? isDark
                          ? '#0c4a6e55'
                          : '#e0f2fe'
                        : 'transparent',
                  }}
                  onPress={() => setSendMode('schedule')}
                >
                  <Text
                    style={{
                      color: sendMode === 'schedule' ? colors.primary : colors.textMuted,
                    }}
                    className="font-medium"
                  >
                    Schedule
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 py-2.5 rounded-xl border items-center"
                  style={{
                    borderColor: sendMode === 'now' ? colors.primary : colors.border,
                    backgroundColor:
                      sendMode === 'now'
                        ? isDark
                          ? '#0c4a6e55'
                          : '#e0f2fe'
                        : 'transparent',
                  }}
                  onPress={() => setSendMode('now')}
                >
                  <Text
                    style={{
                      color: sendMode === 'now' ? colors.primary : colors.textMuted,
                    }}
                    className="font-medium"
                  >
                    Send now
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {(message || sendMode === 'schedule') && (
              <View className="mb-4">
                <Text style={{ color: colors.textSecondary }} className="text-sm mb-1">
                  Send at
                </Text>
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    className="flex-1 border rounded-xl px-3 py-3"
                    style={{
                      backgroundColor: isDark ? '#111827' : '#f9fafb',
                      borderColor: colors.border,
                    }}
                    onPress={() => setShowDatePicker(true)}
                  >
                    <Text style={{ color: colors.text }}>
                      {scheduledAt.toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="flex-1 border rounded-xl px-3 py-3"
                    style={{
                      backgroundColor: isDark ? '#111827' : '#f9fafb',
                      borderColor: colors.border,
                    }}
                    onPress={() => setShowTimePicker(true)}
                  >
                    <Text style={{ color: colors.text }}>
                      {scheduledAt.toLocaleTimeString('en-IN', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </Text>
                  </TouchableOpacity>
                </View>

                {showDatePicker && (
                  <DateTimePicker
                    value={scheduledAt}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    minimumDate={new Date()}
                    onChange={(_event, date) => {
                      if (Platform.OS !== 'ios') setShowDatePicker(false);
                      if (date) {
                        const next = new Date(scheduledAt);
                        next.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
                        setScheduledAt(next);
                      }
                    }}
                  />
                )}
                {showTimePicker && (
                  <DateTimePicker
                    value={scheduledAt}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(_event, date) => {
                      if (Platform.OS !== 'ios') setShowTimePicker(false);
                      if (date) {
                        const next = new Date(scheduledAt);
                        next.setHours(date.getHours(), date.getMinutes(), 0, 0);
                        setScheduledAt(next);
                      }
                    }}
                  />
                )}
                {Platform.OS === 'ios' && (showDatePicker || showTimePicker) && (
                  <TouchableOpacity
                    className="mt-2 self-end"
                    onPress={() => {
                      setShowDatePicker(false);
                      setShowTimePicker(false);
                    }}
                  >
                    <Text style={{ color: colors.primary }} className="font-medium">
                      Done
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <TouchableOpacity
              className="bg-sky-500 rounded-xl py-3.5 items-center mb-8"
              onPress={handleSubmit}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-semibold">
                  {message ? 'Update' : sendMode === 'now' ? 'Send now' : 'Schedule'}
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>

    <ContactPickerModal
      visible={showContacts}
      onClose={() => setShowContacts(false)}
      onSelect={(contact, phone) => {
        setRecipientPhone(phone.phone);
        setRecipientName(contact.name);
        setShowContacts(false);
      }}
    />
    </>
  );
}

function ContactPickerModal({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (contact: GoogleContact, phone: GoogleContactPhone) => void;
}) {
  const { isDark, colors } = useTheme();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    if (!visible) {
      setSearch('');
      setDebouncedSearch('');
      return;
    }
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search, visible]);

  const { data: contacts = [], isLoading, isFetching, error } = useQuery({
    queryKey: ['google-contacts', debouncedSearch],
    queryFn: () => googleService.getContacts(debouncedSearch || undefined),
    enabled: visible,
  });

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1 bg-black/50 justify-end">
        <View style={{ backgroundColor: colors.card }} className="rounded-t-3xl max-h-[92%]">
          <View
            className="flex-row items-center justify-between p-4 border-b"
            style={{ borderColor: colors.border }}
          >
            <Text style={{ color: colors.text }} className="text-lg font-semibold">
              Pick a Google contact
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.icon} />
            </TouchableOpacity>
          </View>

          <View className="p-4 pb-2">
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search name, email, or phone..."
              placeholderTextColor={colors.textMuted}
              style={{
                backgroundColor: isDark ? '#111827' : '#f9fafb',
                color: colors.text,
                borderColor: colors.border,
              }}
              className="border rounded-xl px-3 py-3"
              autoFocus
            />
          </View>

          {error ? (
            <View className="px-4 pb-2">
              <Text className="text-red-500 text-sm">
                {(error as any).response?.data?.error?.message || 'Failed to load contacts'}
              </Text>
            </View>
          ) : null}

          {isLoading || isFetching ? (
            <View className="py-12 items-center">
              <ActivityIndicator color={colors.primary} />
              <Text style={{ color: colors.textMuted }} className="mt-3">
                Loading contacts...
              </Text>
            </View>
          ) : (
            <FlatList
              data={contacts}
              keyExtractor={(item) => item.resourceName || `${item.name}-${item.phones[0]?.phone}`}
              contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 40 }}
              ListEmptyComponent={
                <Text style={{ color: colors.textMuted }} className="text-center py-10">
                  No contacts with phone numbers found.
                </Text>
              }
              renderItem={({ item }) => (
                <View
                  className="rounded-xl border p-3 mb-3"
                  style={{ borderColor: colors.border, backgroundColor: isDark ? '#111827' : '#f9fafb' }}
                >
                  <View className="flex-row items-center mb-2">
                    {item.photoUrl ? (
                      <Image
                        source={{ uri: item.photoUrl }}
                        className="w-9 h-9 rounded-full mr-3"
                      />
                    ) : (
                      <View className="w-9 h-9 rounded-full bg-sky-500/20 items-center justify-center mr-3">
                        <Text className="text-sky-500 font-semibold">
                          {item.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View className="flex-1">
                      <Text style={{ color: colors.text }} className="font-medium">
                        {item.name}
                      </Text>
                      {item.email ? (
                        <Text style={{ color: colors.textMuted }} className="text-xs">
                          {item.email}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  {item.phones.map((phone) => (
                    <TouchableOpacity
                      key={`${item.resourceName}-${phone.phone}`}
                      className="rounded-lg px-3 py-2.5 mb-1"
                      style={{ backgroundColor: isDark ? '#1f2937' : '#ffffff' }}
                      onPress={() => onSelect(item, phone)}
                    >
                      <Text style={{ color: colors.text }}>+{phone.phone}</Text>
                      <Text style={{ color: colors.textMuted }} className="text-xs">
                        {phone.label || phone.displayPhone}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}
