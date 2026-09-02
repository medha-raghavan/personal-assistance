import * as FileSystem from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://raspberrypi.tail38a9a8.ts.net:3001/api';
const WIDGET_DATA_PATH = `${FileSystem.documentDirectory}widget-dashboard.json`;

export interface WidgetDashboardData {
  totalBalance: number;
  income: number;
  expense: number;
  net: number;
  accountCount: number;
  savingsRate: number;
  isLoggedIn: boolean;
  updatedAt: number;
}

export function getEmptyWidgetData(): WidgetDashboardData {
  return {
    totalBalance: 0,
    income: 0,
    expense: 0,
    net: 0,
    accountCount: 0,
    savingsRate: 0,
    isLoggedIn: false,
    updatedAt: Date.now(),
  };
}

function mapOverviewToWidget(data: {
  totalBalance: number;
  sections?: unknown[];
  thisMonth: {
    income: number;
    expense: number;
    net: number;
    savingsRate: number;
  };
}): WidgetDashboardData {
  return {
    totalBalance: data.totalBalance,
    income: data.thisMonth.income,
    expense: data.thisMonth.expense,
    net: data.thisMonth.net,
    accountCount: data.sections?.length ?? 0,
    savingsRate: data.thisMonth.savingsRate,
    isLoggedIn: true,
    updatedAt: Date.now(),
  };
}

export async function loadWidgetDashboardData(): Promise<WidgetDashboardData | null> {
  try {
    const info = await FileSystem.getInfoAsync(WIDGET_DATA_PATH);
    if (!info.exists) {
      return null;
    }

    const raw = await FileSystem.readAsStringAsync(WIDGET_DATA_PATH);
    return JSON.parse(raw) as WidgetDashboardData;
  } catch {
    return null;
  }
}

export async function saveWidgetDashboardData(data: WidgetDashboardData): Promise<void> {
  await FileSystem.writeAsStringAsync(WIDGET_DATA_PATH, JSON.stringify(data));
}

export async function fetchAndCacheWidgetDashboard(): Promise<WidgetDashboardData> {
  const token = await SecureStore.getItemAsync('accessToken');

  if (!token) {
    const empty = getEmptyWidgetData();
    await saveWidgetDashboardData(empty);
    return empty;
  }

  const response = await fetch(`${API_URL}/dashboard/overview`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Dashboard fetch failed: ${response.status}`);
  }

  const json = await response.json();
  const data = mapOverviewToWidget(json.data);
  await saveWidgetDashboardData(data);
  return data;
}
