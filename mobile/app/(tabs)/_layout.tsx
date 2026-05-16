import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';
import { useTheme } from '../../components/ThemeProvider';

export default function TabLayout() {
  const { isDark, colors } = useTheme();
  const router = useRouter();
  
  const BackButton = () => (
    <TouchableOpacity 
      onPress={() => router.back()} 
      className="ml-4"
    >
      <Ionicons name="arrow-back" size={24} color={colors.text} />
    </TouchableOpacity>
  );
  
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: isDark ? '#1f2937' : 'white',
          borderTopWidth: 1,
          borderTopColor: isDark ? '#374151' : '#f3f4f6',
          paddingBottom: 5,
          paddingTop: 5,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
        headerStyle: {
          backgroundColor: isDark ? '#1f2937' : 'white',
        },
        headerTitleStyle: {
          fontWeight: 'bold',
          color: colors.text,
        },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Transactions',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="swap-horizontal-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="sections"
        options={{
          href: null,
          title: 'Accounts',
          headerShown: true,
          headerLeft: () => <BackButton />,
        }}
      />
      <Tabs.Screen
        name="categories"
        options={{
          href: null,
          title: 'Categories',
          headerShown: true,
          headerLeft: () => <BackButton />,
        }}
      />
      <Tabs.Screen
        name="trips"
        options={{
          title: 'Trips',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="airplane-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="tax"
        options={{
          title: 'Tax',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calculator-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
