import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { ThemeProvider, useTheme } from '../components/ThemeProvider';
import { QuickAddOverlay } from '../components/QuickAddOverlay';
import { initializeSmsListener, stopSmsListener } from '../services/smsListener';
import { refreshDashboardWidget } from '../services/widgetRefresh';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
});

function RootLayoutContent() {
  const { initialize, isLoading, isAuthenticated } = useAuthStore();
  const { isDark, colors } = useTheme();

  useEffect(() => {
    initialize();
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
