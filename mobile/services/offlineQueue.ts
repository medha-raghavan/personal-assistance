import { AppState, Platform } from 'react-native';
import { transactionService } from './api';
import {
  loadOfflineQueuedTransactions,
  saveOfflineQueuedTransactions,
  OfflineQueuedTransaction,
} from './lookupCache';

let syncing = false;
let appStateSub: { remove: () => void } | null = null;

export async function flushOfflineTransactionQueue(): Promise<number> {
  if (syncing) return 0;
  syncing = true;

  try {
    const queue = await loadOfflineQueuedTransactions();
    if (queue.length === 0) return 0;

    const remaining: OfflineQueuedTransaction[] = [];
    let synced = 0;

    for (const item of queue) {
      try {
        await transactionService.create({
          sectionId: item.sectionId,
          amount: item.amount,
          type: item.type,
          description: item.description,
          categoryId: item.categoryId,
          transactionDate: item.transactionDate,
        });
        synced += 1;
      } catch {
        remaining.push(item);
      }
    }

    await saveOfflineQueuedTransactions(remaining);
    return synced;
  } finally {
    syncing = false;
  }
}

export function startOfflineQueueSync(): void {
  if (Platform.OS === 'web') return;

  void flushOfflineTransactionQueue();

  if (appStateSub) return;
  appStateSub = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      void flushOfflineTransactionQueue();
    }
  });
}
