import { Platform, Alert, Linking } from 'react-native';
import { parsePaymentSMS } from './paymentParser';
import { usePaymentStore } from '../store/paymentStore';

type SmsSubscription = { remove: () => void };

let smsSubscription: SmsSubscription | null = null;
let smsApi: typeof import('expo-sms-listener') | null = null;

function getSmsApi() {
  if (Platform.OS !== 'android') {
    return null;
  }
  if (!smsApi) {
    smsApi = require('expo-sms-listener');
  }
  return smsApi;
}

export function handleIncomingSms(sender: string, body: string) {
  const { smsListenerEnabled, addPendingPayment } = usePaymentStore.getState();

  if (!smsListenerEnabled) {
    return;
  }

  const payment = parsePaymentSMS(body, sender);

  if (payment && payment.amount > 0) {
    console.log('Payment detected:', {
      sender,
      amount: payment.amount,
      merchant: payment.merchant,
      type: payment.type,
      bank: payment.bank,
    });

    addPendingPayment(payment);
  }
}

export async function initializeSmsListener(): Promise<boolean> {
  const api = getSmsApi();
  if (!api) {
    console.log('SMS listening is only available on Android');
    return false;
  }

  const { granted } = await api.requestSmsPermissionAsync();
  if (!granted) {
    console.log('SMS permission denied');
    return false;
  }

  try {
    await api.startSmsListenerServiceAsync();
  } catch (error) {
    console.error('Failed to start SMS listener service:', error);
    return false;
  }

  return startListening();
}

function startListening(): boolean {
  const api = getSmsApi();
  if (!api) {
    console.log('SMS Listener not available');
    return false;
  }

  if (smsSubscription) {
    smsSubscription.remove();
  }

  try {
    smsSubscription = api.addSmsListener((message) => {
      handleIncomingSms(message.originatingAddress, message.body);
    });

    console.log('SMS listener started');
    return true;
  } catch (error) {
    console.error('Failed to start SMS listener:', error);
    return false;
  }
}

export function stopSmsListener() {
  if (smsSubscription) {
    smsSubscription.remove();
    smsSubscription = null;
    console.log('SMS listener stopped');
  }

  const api = getSmsApi();
  if (api) {
    api.stopSmsListenerServiceAsync().catch((error: unknown) => {
      console.error('Failed to stop SMS listener service:', error);
    });
  }
}

export function isSmsListenerAvailable(): boolean {
  return Platform.OS === 'android' && !!getSmsApi();
}

export async function checkSmsPermission(): Promise<boolean> {
  const api = getSmsApi();
  if (!api) return false;

  try {
    const { granted } = await api.checkSmsPermissionAsync();
    return granted;
  } catch {
    return false;
  }
}

export function showSmsSetupInstructions() {
  Alert.alert(
    'SMS Auto-Detection Setup',
    'To enable automatic payment detection:\n\n' +
      '1. Rebuild the app with EAS (native SMS module required)\n' +
      '2. Grant SMS permissions when prompted\n\n' +
      'Note: This feature only works on Android.',
    [
      { text: 'OK', style: 'default' },
      {
        text: 'Learn More',
        onPress: () => Linking.openURL('https://github.com/MULERx/expo-sms-listener'),
      },
    ]
  );
}

export function testPaymentParser(testMessage: string): void {
  const result = parsePaymentSMS(testMessage);
  if (result) {
    Alert.alert(
      'Parsed Payment',
      `Amount: ${result.amount}\n` +
        `Merchant: ${result.merchant}\n` +
        `Type: ${result.type}\n` +
        `Bank: ${result.bank || 'Unknown'}\n` +
        `Account: ${result.accountLast4 || 'N/A'}`
    );
  } else {
    Alert.alert('No Payment Detected', 'Could not parse payment details from this message.');
  }
}
