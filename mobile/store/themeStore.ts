import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { Appearance } from 'react-native';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  mode: ThemeMode;
  colorScheme: 'light' | 'dark';
  isLoading: boolean;
  initialize: () => Promise<void>;
  setMode: (mode: ThemeMode) => Promise<void>;
}

const getEffectiveColorScheme = (mode: ThemeMode): 'light' | 'dark' => {
  if (mode === 'system') {
    return Appearance.getColorScheme() || 'light';
  }
  return mode;
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: 'system',
  colorScheme: 'light',
  isLoading: true,

  initialize: async () => {
    try {
      const savedMode = await SecureStore.getItemAsync('themeMode');
      const mode = (savedMode as ThemeMode) || 'system';
      const colorScheme = getEffectiveColorScheme(mode);
      
      set({ mode, colorScheme, isLoading: false });

      // Listen for system theme changes
      Appearance.addChangeListener(({ colorScheme: systemScheme }) => {
        const currentMode = get().mode;
        if (currentMode === 'system') {
          set({ colorScheme: systemScheme || 'light' });
        }
      });
    } catch (error) {
      console.error('Failed to initialize theme:', error);
      set({ isLoading: false });
    }
  },

  setMode: async (mode: ThemeMode) => {
    try {
      await SecureStore.setItemAsync('themeMode', mode);
      const colorScheme = getEffectiveColorScheme(mode);
      set({ mode, colorScheme });
    } catch (error) {
      console.error('Failed to save theme mode:', error);
    }
  },
}));
