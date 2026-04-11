import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { ThemeProvider } from '../components/ThemeProvider';
import { QuickAddOverlay } from '../components/QuickAddOverlay';
import { initializeSmsListener, stopSmsListener, isSmsListenerAvailable } from '../services/smsListener';

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
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';

  useEffect(() => {
    initialize();
  }, []);

  useEffect(() => {
    if (isAuthenticated && Platform.OS === 'android') {
      if (isSmsListenerAvailable()) {
        initializeSmsListener().then((success) => {
          if (success) {
            console.log('SMS listener initialized successfully');
          }
        });
      }
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
            headerStyle: { backgroundColor: isDark ? '#1f2937' : 'white' },
            headerTitleStyle: { fontWeight: 'bold', color: isDark ? '#f9fafb' : '#111827' },
            headerTintColor: isDark ? '#f9fafb' : '#111827',
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
