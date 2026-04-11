import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { View } from 'react-native';
import { useThemeStore, ThemeMode } from '../store/themeStore';

interface ThemeColors {
  background: string;
  card: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  primary: string;
  icon: string;
}

interface ThemeContextType {
  mode: ThemeMode;
  colorScheme: 'light' | 'dark';
  isDark: boolean;
  colors: ThemeColors;
  setMode: (mode: ThemeMode) => Promise<void>;
}

const lightColors: ThemeColors = {
  background: '#f9fafb',
  card: '#ffffff',
  text: '#111827',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  border: '#f3f4f6',
  primary: '#0ea5e9',
  icon: '#6b7280',
};

const darkColors: ThemeColors = {
  background: '#111827',
  card: '#1f2937',
  text: '#f9fafb',
  textSecondary: '#9ca3af',
  textMuted: '#6b7280',
  border: '#374151',
  primary: '#0ea5e9',
  icon: '#9ca3af',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { mode, colorScheme, setMode, initialize, isLoading } = useThemeStore();

  useEffect(() => {
    initialize();
  }, []);

  const isDark = colorScheme === 'dark';
  const colors = isDark ? darkColors : lightColors;

  if (isLoading) {
    return null;
  }

  return (
    <ThemeContext.Provider value={{ mode, colorScheme, isDark, colors, setMode }}>
      <View className={`flex-1 ${isDark ? 'dark' : ''}`}>
        {children}
      </View>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
