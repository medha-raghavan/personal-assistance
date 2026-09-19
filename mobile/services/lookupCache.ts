import AsyncStorage from '@react-native-async-storage/async-storage';

const SECTIONS_KEY = 'cachedSections';
const CATEGORIES_KEY = 'cachedCategories';
const OFFLINE_TX_KEY = 'offlineQueuedTransactions';

export interface CachedSection {
  _id: string;
  name: string;
  type: string;
}

export interface CachedCategory {
  _id: string;
  name: string;
  color: string;
}

export interface OfflineQueuedTransaction {
  id: string;
  paymentId?: string;
  sectionId: string;
  amount: number;
  type: 'credit' | 'debit';
  description: string;
  categoryId?: string;
  transactionDate: string;
  createdAt: number;
}

export async function cacheSections(sections: CachedSection[]): Promise<void> {
  try {
    const slim = sections.map((s) => ({ _id: s._id, name: s.name, type: s.type }));
    await AsyncStorage.setItem(SECTIONS_KEY, JSON.stringify(slim));
  } catch (error) {
    console.error('Failed to cache sections:', error);
  }
}

export async function loadCachedSections(): Promise<CachedSection[]> {
  try {
    const raw = await AsyncStorage.getItem(SECTIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function cacheCategories(categories: CachedCategory[]): Promise<void> {
  try {
    const slim = categories.map((c) => ({
      _id: c._id,
      name: c.name,
      color: c.color || '#6b7280',
    }));
    await AsyncStorage.setItem(CATEGORIES_KEY, JSON.stringify(slim));
  } catch (error) {
    console.error('Failed to cache categories:', error);
  }
}

export async function loadCachedCategories(): Promise<CachedCategory[]> {
  try {
    const raw = await AsyncStorage.getItem(CATEGORIES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function loadOfflineQueuedTransactions(): Promise<OfflineQueuedTransaction[]> {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_TX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveOfflineQueuedTransactions(
  items: OfflineQueuedTransaction[]
): Promise<void> {
  try {
    await AsyncStorage.setItem(OFFLINE_TX_KEY, JSON.stringify(items.slice(0, 50)));
  } catch (error) {
    console.error('Failed to save offline queue:', error);
  }
}

export async function enqueueOfflineTransaction(
  item: Omit<OfflineQueuedTransaction, 'id' | 'createdAt'>
): Promise<OfflineQueuedTransaction> {
  const queued: OfflineQueuedTransaction = {
    ...item,
    id: `offline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  };
  const existing = await loadOfflineQueuedTransactions();
  await saveOfflineQueuedTransactions([queued, ...existing]);
  return queued;
}
