import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { useAuthStore } from '../store/authStore';
import { usePaymentStore } from '../store/paymentStore';
import { ThemeProvider, useTheme } from '../components/ThemeProvider';
import { QuickAddOverlay } from '../components/QuickAddOverlay';
import { initializeSmsListener, stopSmsListener } from '../services/smsListener';
import { refreshDashboardWidget } from '../services/widgetRefresh';
import {
  ensurePaymentNotificationChannel,
  getPaymentIdFromNotificationResponse,
  requestPaymentNotificationPermission,
} from '../services/paymentNotifications';
import { startOfflineQueueSync } from '../services/offlineQueue';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
});

function openPaymentFromNotification(
  response: Notifications.NotificationResponse | null
) {
  const paymentId = getPaymentIdFromNotificationResponse(response);
  if (!paymentId) return;

  void (async () => {
    const store = usePaymentStore.getState();
    if (!store.hydrated) {
      await store.hydrate();
    }

    if (!usePaymentStore.getState().showPaymentById(paymentId)) {
      await usePaymentStore.getState().hydrate();
      usePaymentStore.getState().showPaymentById(paymentId);
    }
  })();
}

function RootLayoutContent() {
  const { initialize, isLoading, isAuthenticated } = useAuthStore();
  const { isDark, colors } = useTheme();
  const hydratePayments = usePaymentStore((state) => state.hydrate);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    initialize();
    void hydratePayments();
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    void ensurePaymentNotificationChannel();
    void requestPaymentNotificationPermission();

    // Cold start: user tapped a payment notification while app was killed
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      openPaymentFromNotification(response);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      openPaymentFromNotification(response);
    });

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void usePaymentStore.getState().hydrate();
      }
    });

    return () => {
      responseListener.current?.remove();
      appStateSub.remove();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    if (isAuthenticated) {
      initializeSmsListener().then((success) => {
        if (success) {
          console.log('SMS listener initialized successfully');
        }
      });
      startOfflineQueueSync();
      refreshDashboardWidget().catch(() => undefined);
    } else {
      stopSmsListener();
    }

    return () => {
      stopSmsListener();
    };
  }, [isAuthenticated]);

  if (isLoading) {
    return null;
  }

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="trip/[id]"
          options={{
            headerShown: true,
            headerBackTitle: 'Trips',
            headerStyle: { backgroundColor: colors.card },
            headerTitleStyle: { fontWeight: 'bold', color: colors.text },
            headerTintColor: colors.text,
          }}
        />
      </Stack>
      <QuickAddOverlay />
    </>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <RootLayoutContent />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
