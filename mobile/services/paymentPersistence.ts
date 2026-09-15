import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ParsedPayment } from './paymentParser';

const PENDING_KEY = 'pendingPayments';
const SMS_ENABLED_KEY = 'smsListenerEnabled';

export interface PendingPayment extends ParsedPayment {
  id: string;
  timestamp: number;
  dismissed: boolean;
}

function revivePayment(raw: any): PendingPayment | null {
  if (!raw || typeof raw !== 'object') return null;
  if (!raw.id || typeof raw.amount !== 'number') return null;

  return {
    ...raw,
    date: raw.date ? new Date(raw.date) : new Date(raw.timestamp || Date.now()),
    type: raw.type === 'credit' ? 'credit' : 'debit',
    dismissed: Boolean(raw.dismissed),
    timestamp: typeof raw.timestamp === 'number' ? raw.timestamp : Date.now(),
  } as PendingPayment;
}

export async function loadPendingPayments(): Promise<PendingPayment[]> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(revivePayment).filter(Boolean) as PendingPayment[];
  } catch (error) {
    console.error('Failed to load pending payments:', error);
    return [];
  }
}

export async function savePendingPayments(payments: PendingPayment[]): Promise<void> {
  try {
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(payments.slice(0, 10)));
  } catch (error) {
    console.error('Failed to save pending payments:', error);
  }
}

export async function loadSmsListenerEnabled(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(SMS_ENABLED_KEY);
    if (raw === null) return true;
    return raw === 'true';
  } catch {
    return true;
  }
}

export async function saveSmsListenerEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(SMS_ENABLED_KEY, enabled ? 'true' : 'false');
  } catch (error) {
    console.error('Failed to save SMS listener preference:', error);
  }
}
