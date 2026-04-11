import { create } from 'zustand';
import { ParsedPayment } from '../services/paymentParser';

interface PendingPayment extends ParsedPayment {
  id: string;
  timestamp: number;
  dismissed: boolean;
}

interface PaymentStore {
  pendingPayments: PendingPayment[];
  showQuickAdd: boolean;
  currentPayment: PendingPayment | null;
  smsListenerEnabled: boolean;
  
  addPendingPayment: (payment: ParsedPayment) => void;
  dismissPayment: (id: string) => void;
  clearCurrentPayment: () => void;
  showPaymentOverlay: (payment: PendingPayment) => void;
  hidePaymentOverlay: () => void;
  setSmsListenerEnabled: (enabled: boolean) => void;
  getPendingCount: () => number;
  clearAllPending: () => void;
}

export const usePaymentStore = create<PaymentStore>((set, get) => ({
  pendingPayments: [],
  showQuickAdd: false,
  currentPayment: null,
  smsListenerEnabled: true,

  addPendingPayment: (payment: ParsedPayment) => {
    const newPayment: PendingPayment = {
      ...payment,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      dismissed: false,
    };

    const isDuplicate = get().pendingPayments.some(
      (p) =>
        p.amount === payment.amount &&
        p.merchant === payment.merchant &&
        Date.now() - p.timestamp < 60000
    );

    if (!isDuplicate) {
      set((state) => ({
        pendingPayments: [newPayment, ...state.pendingPayments].slice(0, 10),
        showQuickAdd: true,
        currentPayment: newPayment,
      }));
    }
  },

  dismissPayment: (id: string) => {
    set((state) => ({
      pendingPayments: state.pendingPayments.map((p) =>
        p.id === id ? { ...p, dismissed: true } : p
      ),
      showQuickAdd: state.currentPayment?.id === id ? false : state.showQuickAdd,
      currentPayment: state.currentPayment?.id === id ? null : state.currentPayment,
    }));
  },

  clearCurrentPayment: () => {
    set({ showQuickAdd: false, currentPayment: null });
  },

  showPaymentOverlay: (payment: PendingPayment) => {
    set({ showQuickAdd: true, currentPayment: payment });
  },

  hidePaymentOverlay: () => {
    set({ showQuickAdd: false });
  },

  setSmsListenerEnabled: (enabled: boolean) => {
    set({ smsListenerEnabled: enabled });
  },

  getPendingCount: () => {
    return get().pendingPayments.filter((p) => !p.dismissed).length;
  },

  clearAllPending: () => {
    set({ pendingPayments: [], showQuickAdd: false, currentPayment: null });
  },
}));
