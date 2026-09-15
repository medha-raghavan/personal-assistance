import { create } from 'zustand';
import { ParsedPayment } from '../services/paymentParser';
import {
  loadPendingPayments,
  loadSmsListenerEnabled,
  PendingPayment,
  savePendingPayments,
  saveSmsListenerEnabled,
} from '../services/paymentPersistence';

export type { PendingPayment };

interface PaymentStore {
  pendingPayments: PendingPayment[];
  showQuickAdd: boolean;
  currentPayment: PendingPayment | null;
  smsListenerEnabled: boolean;
  hydrated: boolean;

  hydrate: () => Promise<void>;
  addPendingPayment: (payment: ParsedPayment, options?: { showOverlay?: boolean }) => PendingPayment | null;
  dismissPayment: (id: string) => void;
  clearCurrentPayment: () => void;
  showPaymentOverlay: (payment: PendingPayment) => void;
  showPaymentById: (id: string) => boolean;
  hidePaymentOverlay: () => void;
  setSmsListenerEnabled: (enabled: boolean) => void;
  getPendingCount: () => number;
  clearAllPending: () => void;
}

async function persistPayments(payments: PendingPayment[]) {
  await savePendingPayments(payments);
}

export const usePaymentStore = create<PaymentStore>((set, get) => ({
  pendingPayments: [],
  showQuickAdd: false,
  currentPayment: null,
  smsListenerEnabled: true,
  hydrated: false,

  hydrate: async () => {
    const [payments, smsEnabled] = await Promise.all([
      loadPendingPayments(),
      loadSmsListenerEnabled(),
    ]);

    const prev = get();
    const newestActive = payments.find((payment) => !payment.dismissed) ?? null;
    const isNewPayment =
      !!newestActive && !prev.pendingPayments.some((payment) => payment.id === newestActive.id);

    set({
      pendingPayments: payments,
      smsListenerEnabled: smsEnabled,
      hydrated: true,
      ...(!prev.hydrated
        ? {
            currentPayment: newestActive,
            showQuickAdd: !!newestActive,
          }
        : isNewPayment
          ? {
              currentPayment: newestActive,
              showQuickAdd: true,
            }
          : {}),
    });
  },

  addPendingPayment: (payment, options = {}) => {
    const showOverlay = options.showOverlay !== false;
    const newPayment: PendingPayment = {
      ...payment,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      dismissed: false,
    };

    const isDuplicate = get().pendingPayments.some(
      (existing) =>
        !existing.dismissed &&
        existing.amount === payment.amount &&
        existing.merchant === payment.merchant &&
        Date.now() - existing.timestamp < 60000
    );

    if (isDuplicate) {
      return null;
    }

    const pendingPayments = [newPayment, ...get().pendingPayments].slice(0, 10);
    set({
      pendingPayments,
      showQuickAdd: showOverlay ? true : get().showQuickAdd,
      currentPayment: showOverlay ? newPayment : get().currentPayment ?? newPayment,
    });
    void persistPayments(pendingPayments);
    return newPayment;
  },

  dismissPayment: (id) => {
    const pendingPayments = get().pendingPayments.map((payment) =>
      payment.id === id ? { ...payment, dismissed: true } : payment
    );
    const nextActive = pendingPayments.find((payment) => !payment.dismissed) ?? null;
    const wasCurrent = get().currentPayment?.id === id;

    set({
      pendingPayments,
      showQuickAdd: wasCurrent ? !!nextActive : get().showQuickAdd,
      currentPayment: wasCurrent ? nextActive : get().currentPayment,
    });
    void persistPayments(pendingPayments);
  },

  clearCurrentPayment: () => {
    set({ showQuickAdd: false, currentPayment: null });
  },

  showPaymentOverlay: (payment) => {
    set({ showQuickAdd: true, currentPayment: payment });
  },

  showPaymentById: (id) => {
    const payment = get().pendingPayments.find((item) => item.id === id && !item.dismissed);
    if (!payment) return false;
    set({ showQuickAdd: true, currentPayment: payment });
    return true;
  },

  hidePaymentOverlay: () => {
    set({ showQuickAdd: false });
  },

  setSmsListenerEnabled: (enabled) => {
    set({ smsListenerEnabled: enabled });
    void saveSmsListenerEnabled(enabled);
  },

  getPendingCount: () => {
    return get().pendingPayments.filter((payment) => !payment.dismissed).length;
  },

  clearAllPending: () => {
    set({ pendingPayments: [], showQuickAdd: false, currentPayment: null });
    void persistPayments([]);
  },
}));
