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
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  whatsappService,
  googleService,
  ScheduledWhatsAppMessage,
  ScheduledMessageStatus,
  WhatsAppRecipientType,
  WhatsAppGroup,
  GoogleContact,
} from '../../services/api';
import { useTheme } from '../../components/ThemeProvider';
import { SegmentedControl } from '../../components/ui';

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

  const { data: googleStatus } = useQuery({
    queryKey: ['google-status'],
    queryFn: () => googleService.getStatus(),
  });

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
    await Promise.all([refetchStatus(), refetchMessages()]);
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
              {item.recipientType === 'group' ? (
                <View className="px-2 py-1 rounded-full" style={{ backgroundColor: colors.primary + '22' }}>
                  <Text className="text-xs font-medium" style={{ color: colors.primary }}>Group</Text>
                </View>
              ) : null}
              <Text style={{ color: colors.text }} className="font-semibold">
                {item.recipientName || (item.recipientType === 'group' ? 'WhatsApp group' : `+${item.recipientPhone}`)}
              </Text>
            </View>
            {item.recipientType === 'group' ? (
              <Text style={{ color: colors.textMuted }} className="text-xs mb-1">
                {item.recipientName || item.recipientJid || 'Group'}
              </Text>
            ) : item.recipientName ? (
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
      <View className="mb-4">
        <Text style={{ color: colors.text }} className="text-xl font-bold">WhatsApp</Text>
        <Text style={{ color: colors.textSecondary }} className="text-sm mt-1">
          Schedule messages and pick contacts or groups
        </Text>
      </View>
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
        <View className="flex-row items-center mb-2">
          <Ionicons name="logo-google" size={20} color={colors.primary} />
          <Text style={{ color: colors.text }} className="font-semibold ml-2">Google Contacts</Text>
        </View>
        <Text style={{ color: colors.textMuted }} className="text-sm mb-3">
          {googleStatus?.connected
            ? `Connected${googleStatus.email ? ` as ${googleStatus.email}` : ''}`
            : googleStatus?.configured
              ? 'Connect to pick contacts when composing'
              : 'Google OAuth is not configured on the server'}
        </Text>
        {googleStatus?.configured && (
          <View className="flex-row gap-2">
            {!googleStatus.connected ? (
              <TouchableOpacity
                className="px-4 py-2.5 rounded-xl"
                style={{ backgroundColor: colors.primary }}
                onPress={async () => {
                  try {
                    const url = await googleService.getAuthUrl('mobile');
                    await Linking.openURL(url);
                  } catch (error: any) {
                    Alert.alert('Error', error.response?.data?.error?.message || 'Could not start Google login');
                  }
                }}
              >
                <Text className="text-white font-medium">Connect Google</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                className="px-4 py-2.5 rounded-xl bg-red-500"
                onPress={() =>
                  googleService.disconnect().then(() => {
                    queryClient.invalidateQueries({ queryKey: ['google-status'] });
                    queryClient.removeQueries({ queryKey: ['google-contacts'] });
                  })
                }
              >
                <Text className="text-white font-medium">Disconnect</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
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
        googleConnected={!!googleStatus?.connected}
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
}: {
  visible: boolean;
  onClose: () => void;
  message: ScheduledWhatsAppMessage | null;
  isConnected: boolean;
  googleConnected: boolean;
}) {
  const queryClient = useQueryClient();
  const { isDark, colors } = useTheme();
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientType, setRecipientType] = useState<WhatsAppRecipientType>('contact');
  const [recipientJid, setRecipientJid] = useState('');
  const [contactSearch, setContactSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showContacts, setShowContacts] = useState(false);
  const [showGroups, setShowGroups] = useState(false);
  const [groupSearch, setGroupSearch] = useState('');
  const [body, setBody] = useState('');
  const [scheduledAt, setScheduledAt] = useState(defaultScheduleDate());
  const [sendMode, setSendMode] = useState<'schedule' | 'now'>('schedule');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setShowContacts(false);
    setShowGroups(false);
    setContactSearch('');
    setGroupSearch('');
    if (message) {
      setRecipientPhone(message.recipientPhone || '');
      setRecipientName(message.recipientName || '');
      setRecipientType(message.recipientType === 'group' ? 'group' : 'contact');
      setRecipientJid(message.recipientJid || '');
      setBody(message.message);
      setScheduledAt(new Date(message.scheduledAt));
      setSendMode('schedule');
    } else {
      setRecipientPhone('');
      setRecipientName('');
      setRecipientType('contact');
      setRecipientJid('');
      setBody('');
      setScheduledAt(defaultScheduleDate());
      setSendMode('schedule');
    }
  }, [message, visible]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(contactSearch.trim()), 250);
    return () => clearTimeout(t);
  }, [contactSearch]);

  const { data: contacts = [], isLoading: contactsLoading, isFetching: contactsFetching, error: contactsError } =
    useQuery({
      queryKey: ['google-contacts', debouncedSearch],
      queryFn: () => googleService.getContacts(debouncedSearch || undefined),
      enabled: visible && showContacts,
    });

  const {
    data: groups = [],
    isLoading: groupsLoading,
    isFetching: groupsFetching,
    error: groupsError,
    refetch: refetchGroups,
  } = useQuery({
    queryKey: ['whatsapp-groups'],
    queryFn: () => whatsappService.getGroups(),
    enabled: visible && showGroups && isConnected,
  });

  const filteredGroups = useMemo(() => {
    const q = groupSearch.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => g.name.toLowerCase().includes(q));
  }, [groups, groupSearch]);

  const createMutation = useMutation({
    mutationFn: (payload: {
      recipientType?: WhatsAppRecipientType;
      recipientPhone?: string;
      recipientJid?: string;
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
      recipientType?: WhatsAppRecipientType;
      recipientPhone?: string;
      recipientJid?: string;
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

  const buildPayload = (opts: { scheduledAt?: string; sendNow?: boolean }) => {
    if (!body.trim()) {
      Alert.alert('Error', 'Message is required');
      return null;
    }
    if (recipientType === 'group') {
      if (!recipientJid.trim()) {
        Alert.alert('Error', 'Pick a WhatsApp group');
        return null;
      }
      return {
        recipientType: 'group' as const,
        recipientJid: recipientJid.trim(),
        recipientName: recipientName.trim() || undefined,
        message: body.trim(),
        ...opts,
      };
    }
    if (!recipientPhone.trim()) {
      Alert.alert('Error', 'Phone number and message are required');
      return null;
    }
    return {
      recipientType: 'contact' as const,
      recipientPhone: recipientPhone.trim(),
      recipientName: recipientName.trim() || undefined,
      message: body.trim(),
      ...opts,
    };
  };

  const handleSubmit = () => {
    if (message) {
      const payload = buildPayload({ scheduledAt: scheduledAt.toISOString() });
      if (payload) updateMutation.mutate(payload as any);
      return;
    }
    if (sendMode === 'now') {
      if (!isConnected) {
        Alert.alert('Error', 'Connect WhatsApp before sending now');
        return;
      }
      const payload = buildPayload({ sendNow: true });
      if (payload) createMutation.mutate(payload);
    } else {
      const payload = buildPayload({ scheduledAt: scheduledAt.toISOString() });
      if (payload) createMutation.mutate(payload);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const inputStyle = {
    backgroundColor: isDark ? '#111827' : '#f9fafb',
    color: colors.text,
    borderColor: colors.border,
  };

  const openContacts = async () => {
    if (!googleConnected) {
      try {
        const url = await googleService.getAuthUrl('mobile');
        await Linking.openURL(url);
      } catch (error: any) {
        Alert.alert('Error', error.response?.data?.error?.message || 'Could not start Google login');
      }
      return;
    }
    setShowGroups(false);
    setShowContacts(true);
  };

  const openGroups = () => {
    if (!isConnected) {
      Alert.alert('Error', 'Connect WhatsApp to pick a group');
      return;
    }
    setShowContacts(false);
    setShowGroups(true);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1 bg-black/50 justify-end">
        <View style={{ backgroundColor: colors.card }} className="rounded-t-3xl max-h-[92%]">
          <View
            className="flex-row items-center justify-between p-4 border-b"
            style={{ borderColor: colors.border }}
          >
            <Text style={{ color: colors.text }} className="text-lg font-semibold">
              {showContacts
                ? 'Pick a Google contact'
                : showGroups
                  ? 'Pick a WhatsApp group'
                  : message
                    ? 'Edit message'
                    : 'Schedule WhatsApp message'}
            </Text>
            <TouchableOpacity
              onPress={() => {
                if (showContacts || showGroups) {
                  setShowContacts(false);
                  setShowGroups(false);
                } else {
                  onClose();
                }
              }}
            >
              <Ionicons name="close" size={24} color={colors.icon} />
            </TouchableOpacity>
          </View>

          {showContacts ? (
            <View className="p-4" style={{ maxHeight: 520 }}>
              <View
                className="flex-row items-center rounded-xl px-3 py-2 mb-3 border"
                style={{ backgroundColor: colors.panel2, borderColor: colors.border }}
              >
                <Ionicons name="search" size={18} color={colors.textMuted} />
                <TextInput
                  value={contactSearch}
                  onChangeText={setContactSearch}
                  placeholder="Search name, email, or phone..."
                  placeholderTextColor={colors.textMuted}
                  style={{ color: colors.text, flex: 1, marginLeft: 8 }}
                  autoFocus
                />
              </View>
              {contactsError ? (
                <Text className="text-red-500 text-sm mb-3">
                  {(contactsError as any).response?.data?.error?.message || 'Failed to load contacts'}
                </Text>
              ) : null}
              {contactsLoading || contactsFetching ? (
                <ActivityIndicator color={colors.primary} className="my-8" />
              ) : (
                <ScrollView keyboardShouldPersistTaps="handled">
                  {contacts.length === 0 ? (
                    <Text style={{ color: colors.textMuted }} className="text-center py-8">
                      No contacts with phone numbers found.
                    </Text>
                  ) : (
                    contacts.map((contact: GoogleContact) => (
                      <View
                        key={contact.resourceName || `${contact.name}-${contact.phones[0]?.phone}`}
                        className="rounded-xl border p-3 mb-2"
                        style={{ borderColor: colors.border, backgroundColor: colors.panel2 }}
                      >
                        <Text style={{ color: colors.text }} className="font-semibold mb-1">
                          {contact.name}
                        </Text>
                        {contact.email ? (
                          <Text style={{ color: colors.textMuted }} className="text-xs mb-2">
                            {contact.email}
                          </Text>
                        ) : null}
                        {contact.phones.map((phone) => (
                          <TouchableOpacity
                            key={`${contact.resourceName}-${phone.phone}`}
                            className="rounded-lg px-3 py-2 mb-1"
                            style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}
                            onPress={() => {
                              setRecipientPhone(phone.phone);
                              setRecipientName(contact.name);
                              setRecipientJid('');
                              setRecipientType('contact');
                              setShowContacts(false);
                            }}
                          >
                            <Text style={{ color: colors.text }}>+{phone.phone}</Text>
                            {(phone.label || phone.displayPhone) ? (
                              <Text style={{ color: colors.textMuted }} className="text-xs">
                                {phone.label || phone.displayPhone}
                              </Text>
                            ) : null}
                          </TouchableOpacity>
                        ))}
                      </View>
                    ))
                  )}
                </ScrollView>
              )}
            </View>
          ) : showGroups ? (
            <View className="p-4" style={{ maxHeight: 520 }}>
              <View
                className="flex-row items-center rounded-xl px-3 py-2 mb-3 border"
                style={{ backgroundColor: colors.panel2, borderColor: colors.border }}
              >
                <Ionicons name="search" size={18} color={colors.textMuted} />
                <TextInput
                  value={groupSearch}
                  onChangeText={setGroupSearch}
                  placeholder="Search groups..."
                  placeholderTextColor={colors.textMuted}
                  style={{ color: colors.text, flex: 1, marginLeft: 8 }}
                  autoFocus
                />
              </View>
              {groupsError ? (
                <View className="mb-3 flex-row items-center justify-between">
                  <Text className="text-red-500 text-sm flex-1">
                    {(groupsError as any).response?.data?.error?.message || 'Failed to load groups'}
                  </Text>
                  <TouchableOpacity onPress={() => refetchGroups()}>
                    <Text style={{ color: colors.primary }} className="font-medium">Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              {groupsLoading || groupsFetching ? (
                <ActivityIndicator color={colors.primary} className="my-8" />
              ) : (
                <ScrollView keyboardShouldPersistTaps="handled">
                  {filteredGroups.length === 0 ? (
                    <Text style={{ color: colors.textMuted }} className="text-center py-8">
                      No groups found.
                    </Text>
                  ) : (
                    filteredGroups.map((group: WhatsAppGroup) => (
                      <TouchableOpacity
                        key={group.id}
                        className="flex-row items-center rounded-xl border p-3 mb-2"
                        style={{ borderColor: colors.border, backgroundColor: colors.panel2 }}
                        onPress={() => {
                          setRecipientJid(group.id);
                          setRecipientName(group.name);
                          setRecipientPhone('');
                          setRecipientType('group');
                          setShowGroups(false);
                        }}
                      >
                        <View
                          className="w-9 h-9 rounded-full items-center justify-center mr-3"
                          style={{ backgroundColor: colors.primary + '33' }}
                        >
                          <Ionicons name="people" size={18} color={colors.primary} />
                        </View>
                        <View className="flex-1">
                          <Text style={{ color: colors.text }} className="font-semibold">
                            {group.name}
                          </Text>
                          <Text style={{ color: colors.textMuted }} className="text-xs">
                            {group.participantCount} participant{group.participantCount === 1 ? '' : 's'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
              )}
            </View>
          ) : (
            <ScrollView className="p-4" keyboardShouldPersistTaps="handled">
              <View className="mb-3">
                <SegmentedControl
                  options={[
                    { id: 'contact', label: 'Contact' },
                    { id: 'group', label: 'Group' },
                  ]}
                  value={recipientType}
                  onChange={(id) => {
                    setRecipientType(id);
                    if (id === 'group') setRecipientPhone('');
                    else setRecipientJid('');
                  }}
                />
              </View>

              {recipientType === 'contact' ? (
                <>
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
                      style={inputStyle}
                      className="border rounded-xl px-3 py-3 flex-1"
                    />
                    <TouchableOpacity
                      className="px-3 rounded-xl items-center justify-center border"
                      style={{ borderColor: colors.border, backgroundColor: colors.panel2 }}
                      onPress={openContacts}
                    >
                      <Ionicons name="people-outline" size={20} color={colors.primary} />
                      <Text style={{ color: colors.primary }} className="text-xs mt-0.5">
                        Contacts
                      </Text>
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
                    style={inputStyle}
                    className="border rounded-xl px-3 py-3 mb-3"
                  />
                </>
              ) : (
                <View className="mb-3">
                  <Text style={{ color: colors.textSecondary }} className="text-sm mb-1">
                    WhatsApp group
                  </Text>
                  <View className="flex-row gap-2 items-center">
                    <View
                      className="flex-1 border rounded-xl px-3 py-3"
                      style={inputStyle}
                    >
                      <Text style={{ color: recipientJid ? colors.text : colors.textMuted }} numberOfLines={1}>
                        {recipientJid ? recipientName || recipientJid : 'No group selected'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      className="px-3 py-3 rounded-xl border"
                      style={{ borderColor: colors.border, backgroundColor: colors.panel2 }}
                      onPress={openGroups}
                    >
                      <Text style={{ color: colors.primary }} className="font-medium">
                        Pick group
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

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
                style={{ ...inputStyle, minHeight: 120 }}
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
                      style={inputStyle}
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
                      style={inputStyle}
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
                className="rounded-xl py-3.5 items-center mb-8"
                style={{ backgroundColor: colors.primary }}
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
          )}
        </View>
      </View>
    </Modal>
  );
}
