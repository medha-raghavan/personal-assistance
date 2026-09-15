import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { PendingPayment } from './paymentPersistence';

export const PAYMENT_CHANNEL_ID = 'payment-detected';
export const PAYMENT_NOTIFICATION_TYPE = 'payment_detected';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let channelReady = false;

export async function ensurePaymentNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android' || channelReady) return;

  await Notifications.setNotificationChannelAsync(PAYMENT_CHANNEL_ID, {
    name: 'Payment detected',
    description: 'Heads-up alerts when a bank/UPI payment SMS is detected',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 150, 250],
    lightColor: '#0ea5e9',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: false,
    enableVibrate: true,
    showBadge: false,
  });

  channelReady = true;
}

export async function requestPaymentNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;

  await ensurePaymentNotificationChannel();

  const current = await Notifications.getPermissionsAsync();
  if (current.granted || current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export async function showPaymentDetectedNotification(
  payment: PendingPayment
): Promise<string | null> {
  if (Platform.OS !== 'android') return null;

  try {
    await ensurePaymentNotificationChannel();

    const sign = payment.type === 'credit' ? '+' : '-';
    const title =
      payment.type === 'credit' ? 'Money received — tap to save' : 'Payment detected — tap to save';
    const body = `${sign}${formatAmount(payment.amount)} · ${payment.merchant}${
      payment.bank ? ` · ${payment.bank}` : ''
    }`;

    return await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
        data: {
          type: PAYMENT_NOTIFICATION_TYPE,
          paymentId: payment.id,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 1,
        channelId: PAYMENT_CHANNEL_ID,
      },
    });
  } catch (error) {
    console.error('Failed to show payment notification:', error);
    return null;
  }
}

export function getPaymentIdFromNotificationResponse(
  response: Notifications.NotificationResponse | null
): string | null {
  if (!response) return null;
  const data = response.notification.request.content.data as
    | { type?: string; paymentId?: string }
    | undefined;
  if (data?.type !== PAYMENT_NOTIFICATION_TYPE || !data.paymentId) {
    return null;
  }
  return String(data.paymentId);
}
