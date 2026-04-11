import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, ScrollView, Switch, Platform } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { usePaymentStore } from '../../store/paymentStore';
import { useTheme } from '../../components/ThemeProvider';
import { ThemeMode } from '../../store/themeStore';
import { Ionicons } from '@expo/vector-icons';
import {
  isSmsListenerAvailable,
  checkSmsPermission,
  initializeSmsListener,
  stopSmsListener,
  showSmsSetupInstructions,
  testPaymentParser,
} from '../../services/smsListener';
import {
  parseFromClipboard,
  showManualEntryPrompt,
  createManualPayment,
} from '../../services/clipboardParser';

export default function SettingsScreen() {
  const { user, logout } = useAuthStore();
  const queryClient = useQueryClient();
  const { smsListenerEnabled, setSmsListenerEnabled, getPendingCount, clearAllPending } =
    usePaymentStore();
  const { mode, isDark, colors, setMode } = useTheme();

  const [smsAvailable, setSmsAvailable] = useState(false);
  const [smsPermissionGranted, setSmsPermissionGranted] = useState(false);
  const pendingCount = getPendingCount();

  const themeOptions: { value: ThemeMode; label: string; icon: string }[] = [
    { value: 'light', label: 'Light', icon: 'sunny-outline' },
    { value: 'dark', label: 'Dark', icon: 'moon-outline' },
    { value: 'system', label: 'System', icon: 'phone-portrait-outline' },
  ];

  useEffect(() => {
    if (Platform.OS === 'android') {
      setSmsAvailable(isSmsListenerAvailable());
      checkSmsPermission().then(setSmsPermissionGranted);
    }
  }, []);

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          queryClient.clear();
          stopSmsListener();
          clearAllPending();
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const handleToggleSmsListener = async (value: boolean) => {
    if (value && !smsAvailable) {
      showSmsSetupInstructions();
      return;
    }

    if (value && !smsPermissionGranted) {
      const success = await initializeSmsListener();
      if (success) {
        setSmsPermissionGranted(true);
        setSmsListenerEnabled(true);
      } else {
        Alert.alert(
          'Permission Required',
          'SMS permission is required to detect payments automatically. Please grant the permission in Settings.',
          [{ text: 'OK' }]
        );
      }
    } else {
      setSmsListenerEnabled(value);
      if (!value) {
        stopSmsListener();
      } else {
        initializeSmsListener();
      }
    }
  };

  const handleTestParser = () => {
    Alert.prompt(
      'Test SMS Parser',
      'Paste a bank/UPI SMS message to test the parser:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Test',
          onPress: (text) => {
            if (text) {
              testPaymentParser(text);
            }
          },
        },
      ],
      'plain-text',
      'Rs.500 debited from A/c XX1234 to Amazon on 01-04-26'
    );
  };

  const settingsItems = [
    {
      icon: 'wallet-outline',
      title: 'Accounts',
      subtitle: 'Manage your bank accounts and wallets',
      onPress: () => router.push('/(tabs)/sections'),
    },
    {
      icon: 'pricetags-outline',
      title: 'Categories',
      subtitle: 'Manage expense categories and keywords',
      onPress: () => router.push('/(tabs)/categories'),
    },
    {
      icon: 'airplane-outline',
      title: 'Trips',
      subtitle: 'View and manage your trips',
      onPress: () => router.push('/(tabs)/trips'),
    },
  ];

  const aboutItems = [
    {
      icon: 'information-circle-outline',
      title: 'About',
      subtitle: 'Personal Finance Tracker v2.1.0',
      onPress: () =>
        Alert.alert('About', 'Personal Finance Tracker\n\nVersion 2.1.0\nBuilt with React Native & Expo'),
    },
    {
      icon: 'code-slash-outline',
      title: 'Source Code',
      subtitle: 'Self-hosted financial management',
      onPress: () =>
        Alert.alert(
          'Self-Hosted',
          'This app is designed for self-hosting.\n\nAll your data stays on your own server.'
        ),
    },
  ];

  return (
    <ScrollView style={{ backgroundColor: colors.background }} className="flex-1">
      <View className="p-4">
        {/* User Profile */}
        <View style={{ backgroundColor: colors.card }} className="rounded-2xl p-5 shadow-sm mb-4">
          <View className="flex-row items-center">
            <View className="w-16 h-16 bg-sky-100 rounded-full items-center justify-center">
              <Text className="text-sky-600 text-2xl font-bold">
                {user?.name?.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View className="ml-4 flex-1">
              <Text style={{ color: colors.text }} className="text-xl font-bold">{user?.name}</Text>
              <Text style={{ color: colors.textSecondary }}>{user?.email}</Text>
            </View>
          </View>
        </View>

        {/* Appearance Settings */}
        <Text style={{ color: colors.textSecondary }} className="text-sm font-medium mb-2 ml-1">
          APPEARANCE
        </Text>
        <View style={{ backgroundColor: colors.card }} className="rounded-xl shadow-sm mb-4">
          {themeOptions.map((option, index) => (
            <TouchableOpacity
              key={option.value}
              className={`flex-row items-center justify-between p-4 ${
                index < themeOptions.length - 1 ? 'border-b' : ''
              }`}
              style={{ borderColor: colors.border }}
              onPress={() => setMode(option.value)}
            >
              <View className="flex-row items-center">
                <View 
                  className="w-10 h-10 rounded-full items-center justify-center"
                  style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6' }}
                >
                  <Ionicons 
                    name={option.icon as any} 
                    size={22} 
                    color={mode === option.value ? colors.primary : colors.icon} 
                  />
                </View>
                <Text style={{ color: colors.text }} className="ml-3 font-medium">
                  {option.label}
                </Text>
              </View>
              {mode === option.value && (
                <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Auto-Detection Settings (Android Only) */}
        {Platform.OS === 'android' && (
          <>
            <Text style={{ color: colors.textSecondary }} className="text-sm font-medium mb-2 ml-1">
              PAYMENT AUTO-DETECTION
            </Text>
            <View style={{ backgroundColor: colors.card }} className="rounded-xl shadow-sm mb-4">
              <View className="flex-row items-center justify-between p-4 border-b" style={{ borderColor: colors.border }}>
                <View className="flex-row items-center flex-1">
                  <View className="w-10 h-10 bg-green-100 rounded-full items-center justify-center">
                    <Ionicons name="chatbubble-outline" size={22} color="#22c55e" />
                  </View>
                  <View className="ml-3 flex-1">
                    <Text style={{ color: colors.text }} className="font-medium">SMS Detection</Text>
                    <Text style={{ color: colors.textMuted }} className="text-xs">
                      {smsAvailable
                        ? smsPermissionGranted
                          ? 'Auto-detect payments from SMS'
                          : 'Permission required'
                        : 'Library not installed'}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={smsListenerEnabled && smsAvailable && smsPermissionGranted}
                  onValueChange={handleToggleSmsListener}
                  trackColor={{ false: isDark ? '#374151' : '#e5e7eb', true: '#bae6fd' }}
                  thumbColor={
                    smsListenerEnabled && smsAvailable && smsPermissionGranted
                      ? '#0ea5e9'
                      : isDark ? '#6b7280' : '#f4f4f5'
                  }
                />
              </View>

              {pendingCount > 0 && (
                <TouchableOpacity
                  className="flex-row items-center justify-between p-4 border-b"
                  style={{ borderColor: colors.border }}
                  onPress={() => {
                    Alert.alert(
                      'Clear Pending',
                      `Clear ${pendingCount} pending payment(s)?`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Clear', onPress: clearAllPending, style: 'destructive' },
                      ]
                    );
                  }}
                >
                  <View className="flex-row items-center">
                    <View className="w-10 h-10 bg-yellow-100 rounded-full items-center justify-center">
                      <Ionicons name="time-outline" size={22} color="#f59e0b" />
                    </View>
                    <View className="ml-3">
                      <Text style={{ color: colors.text }} className="font-medium">Pending Payments</Text>
                      <Text style={{ color: colors.textMuted }} className="text-xs">
                        {pendingCount} payment{pendingCount !== 1 ? 's' : ''} waiting
                      </Text>
                    </View>
                  </View>
                  <View className="bg-yellow-100 px-2 py-1 rounded-full">
                    <Text className="text-yellow-700 font-medium">{pendingCount}</Text>
                  </View>
                </TouchableOpacity>
              )}

              {!smsAvailable && (
                <TouchableOpacity
                  className="flex-row items-center p-4"
                  onPress={showSmsSetupInstructions}
                >
                  <View className="w-10 h-10 bg-blue-100 rounded-full items-center justify-center">
                    <Ionicons name="help-circle-outline" size={22} color="#3b82f6" />
                  </View>
                  <View className="ml-3 flex-1">
                    <Text style={{ color: colors.text }} className="font-medium">Setup Instructions</Text>
                    <Text style={{ color: colors.textMuted }} className="text-xs">How to enable auto-detection</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              )}

              {smsAvailable && (
                <TouchableOpacity className="flex-row items-center p-4" onPress={handleTestParser}>
                  <View className="w-10 h-10 bg-purple-100 rounded-full items-center justify-center">
                    <Ionicons name="bug-outline" size={22} color="#8b5cf6" />
                  </View>
                  <View className="ml-3 flex-1">
                    <Text style={{ color: colors.text }} className="font-medium">Test Parser</Text>
                    <Text style={{ color: colors.textMuted }} className="text-xs">Test SMS parsing with sample message</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          </>
        )}

        {/* Quick Payment Entry (iOS & Android) */}
        <Text style={{ color: colors.textSecondary }} className="text-sm font-medium mb-2 ml-1">
          QUICK PAYMENT ENTRY
        </Text>
        <View style={{ backgroundColor: colors.card }} className="rounded-xl shadow-sm mb-4">
          <TouchableOpacity
            className="flex-row items-center p-4 border-b"
            style={{ borderColor: colors.border }}
            onPress={parseFromClipboard}
          >
            <View className="w-10 h-10 bg-indigo-100 rounded-full items-center justify-center">
              <Ionicons name="clipboard-outline" size={22} color="#6366f1" />
            </View>
            <View className="ml-3 flex-1">
              <Text style={{ color: colors.text }} className="font-medium">Paste from Clipboard</Text>
              <Text style={{ color: colors.textMuted }} className="text-xs">Parse payment from copied text</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-row items-center p-4"
            onPress={() => {
              showManualEntryPrompt((amount, merchant) => {
                createManualPayment(amount, merchant);
              });
            }}
          >
            <View className="w-10 h-10 bg-emerald-100 rounded-full items-center justify-center">
              <Ionicons name="flash-outline" size={22} color="#10b981" />
            </View>
            <View className="ml-3 flex-1">
              <Text style={{ color: colors.text }} className="font-medium">Quick Add Payment</Text>
              <Text style={{ color: colors.textMuted }} className="text-xs">Manually enter payment amount</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Pending Payments (iOS) */}
        {Platform.OS === 'ios' && pendingCount > 0 && (
          <TouchableOpacity
            style={{ backgroundColor: colors.card }}
            className="rounded-xl shadow-sm mb-4 flex-row items-center justify-between p-4"
            onPress={() => {
              Alert.alert(
                'Clear Pending',
                `Clear ${pendingCount} pending payment(s)?`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Clear', onPress: clearAllPending, style: 'destructive' },
                ]
              );
            }}
          >
            <View className="flex-row items-center">
              <View className="w-10 h-10 bg-yellow-100 rounded-full items-center justify-center">
                <Ionicons name="time-outline" size={22} color="#f59e0b" />
              </View>
              <View className="ml-3">
                <Text style={{ color: colors.text }} className="font-medium">Pending Payments</Text>
                <Text style={{ color: colors.textMuted }} className="text-xs">
                  {pendingCount} payment{pendingCount !== 1 ? 's' : ''} waiting
                </Text>
              </View>
            </View>
            <View className="bg-yellow-100 px-2 py-1 rounded-full">
              <Text className="text-yellow-700 font-medium">{pendingCount}</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Quick Access */}
        <Text style={{ color: colors.textSecondary }} className="text-sm font-medium mb-2 ml-1">QUICK ACCESS</Text>
        <View style={{ backgroundColor: colors.card }} className="rounded-xl shadow-sm mb-4">
          {settingsItems.map((item, index) => (
            <TouchableOpacity
              key={item.title}
              className={`flex-row items-center p-4 ${
                index < settingsItems.length - 1 ? 'border-b' : ''
              }`}
              style={{ borderColor: colors.border }}
              onPress={item.onPress}
            >
              <View 
                className="w-10 h-10 rounded-full items-center justify-center"
                style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6' }}
              >
                <Ionicons name={item.icon as any} size={22} color={colors.icon} />
              </View>
              <View className="ml-3 flex-1">
                <Text style={{ color: colors.text }} className="font-medium">{item.title}</Text>
                <Text style={{ color: colors.textMuted }} className="text-sm">{item.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        {/* About */}
        <Text style={{ color: colors.textSecondary }} className="text-sm font-medium mb-2 ml-1">ABOUT</Text>
        <View style={{ backgroundColor: colors.card }} className="rounded-xl shadow-sm mb-4">
          {aboutItems.map((item, index) => (
            <TouchableOpacity
              key={item.title}
              className={`flex-row items-center p-4 ${
                index < aboutItems.length - 1 ? 'border-b' : ''
              }`}
              style={{ borderColor: colors.border }}
              onPress={item.onPress}
            >
              <View 
                className="w-10 h-10 rounded-full items-center justify-center"
                style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6' }}
              >
                <Ionicons name={item.icon as any} size={22} color={colors.icon} />
              </View>
              <View className="ml-3 flex-1">
                <Text style={{ color: colors.text }} className="font-medium">{item.title}</Text>
                <Text style={{ color: colors.textMuted }} className="text-sm">{item.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout */}
        <TouchableOpacity
          style={{ backgroundColor: colors.card }}
          className="rounded-xl p-4 shadow-sm flex-row items-center mb-4"
          onPress={handleLogout}
        >
          <View className="w-10 h-10 bg-red-50 rounded-full items-center justify-center">
            <Ionicons name="log-out-outline" size={22} color="#ef4444" />
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-red-500 font-medium">Logout</Text>
            <Text style={{ color: colors.textMuted }} className="text-sm">Sign out of your account</Text>
          </View>
        </TouchableOpacity>

        {/* Footer */}
        <View className="items-center py-6">
          <Text style={{ color: colors.textMuted }} className="text-sm">Personal Finance Tracker</Text>
          <Text style={{ color: isDark ? '#4b5563' : '#d1d5db' }} className="text-xs mt-1">Version 2.1.0 • Self-Hosted</Text>
        </View>
      </View>
    </ScrollView>
  );
}
