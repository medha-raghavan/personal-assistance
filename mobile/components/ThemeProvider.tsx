import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { View } from 'react-native';
import { useThemeStore, ThemeMode } from '../store/themeStore';

export interface ThemeColors {
  background: string;
  card: string;
  panel: string;
  panel2: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  primary: string;
  icon: string;
  income: string;
  expense: string;
  savings: string;
  accent: string;
  danger: string;
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
  panel: '#ffffff',
  panel2: '#f3f4f6',
  text: '#111827',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  border: '#e5e7eb',
  primary: '#0ea5e9',
  icon: '#6b7280',
  income: '#16a34a',
  expense: '#dc2626',
  savings: '#d97706',
  accent: '#0ea5e9',
  danger: '#ef4444',
};

const darkColors: ThemeColors = {
  background: '#111827',
  card: '#1f2937',
  panel: '#1f2937',
  panel2: '#374151',
  text: '#f9fafb',
  textSecondary: '#9ca3af',
  textMuted: '#6b7280',
  border: '#374151',
  primary: '#0ea5e9',
  icon: '#9ca3af',
  income: '#4ade80',
  expense: '#f87171',
  savings: '#fbbf24',
  accent: '#7c8cf0',
  danger: '#f87171',
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
