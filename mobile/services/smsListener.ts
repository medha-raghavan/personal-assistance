import { Platform, PermissionsAndroid, Alert, Linking } from 'react-native';
import { parsePaymentSMS, isPaymentSender } from './paymentParser';
import { usePaymentStore } from '../store/paymentStore';

let smsSubscription: any = null;
let SmsListener: any = null;

export async function initializeSmsListener(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    console.log('SMS listening is only available on Android');
    return false;
  }

  try {
    SmsListener = require('react-native-android-sms-listener').default;
  } catch (error) {
    console.log('SMS listener library not installed. Install with: npm install react-native-android-sms-listener');
    return false;
  }

  const hasPermission = await requestSmsPermission();
  if (!hasPermission) {
    console.log('SMS permission denied');
    return false;
  }

  return startListening();
}

async function requestSmsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;

  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
      {
        title: 'SMS Permission',
        message:
          'This app needs access to your SMS messages to automatically detect payment transactions from banks and UPI apps.',
        buttonNeutral: 'Ask Me Later',
        buttonNegative: 'Cancel',
        buttonPositive: 'OK',
      }
    );

    if (granted === PermissionsAndroid.RESULTS.GRANTED) {
      const readGranted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_SMS,
        {
          title: 'Read SMS Permission',
          message: 'This app needs to read SMS messages to parse payment details.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );

      return readGranted === PermissionsAndroid.RESULTS.GRANTED;
    }

    return false;
  } catch (err) {
    console.error('SMS permission error:', err);
    return false;
  }
}

function startListening(): boolean {
  if (!SmsListener) {
    console.log('SMS Listener not available');
    return false;
  }

  if (smsSubscription) {
    smsSubscription.remove();
  }

  try {
    smsSubscription = SmsListener.addListener((message: { originatingAddress: string; body: string }) => {
      handleIncomingSms(message.originatingAddress, message.body);
    });

    console.log('SMS listener started');
    return true;
  } catch (error) {
    console.error('Failed to start SMS listener:', error);
    return false;
  }
}

function handleIncomingSms(sender: string, body: string) {
  const { smsListenerEnabled, addPendingPayment } = usePaymentStore.getState();

  if (!smsListenerEnabled) {
    return;
  }

  if (!isPaymentSender(sender)) {
    return;
  }

  const payment = parsePaymentSMS(body, sender);

  if (payment && payment.amount > 0) {
    console.log('Payment detected:', {
      amount: payment.amount,
      merchant: payment.merchant,
      type: payment.type,
      bank: payment.bank,
    });

    addPendingPayment(payment);
  }
}

export function stopSmsListener() {
  if (smsSubscription) {
    smsSubscription.remove();
    smsSubscription = null;
    console.log('SMS listener stopped');
  }
}

export function isSmsListenerAvailable(): boolean {
  if (Platform.OS !== 'android') return false;

  try {
    require('react-native-android-sms-listener');
    return true;
  } catch {
    return false;
  }
}

export async function checkSmsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;

  try {
    const receiveGranted = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.RECEIVE_SMS
    );
    const readGranted = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.READ_SMS
    );
    return receiveGranted && readGranted;
  } catch {
    return false;
  }
}

export function showSmsSetupInstructions() {
  Alert.alert(
    'SMS Auto-Detection Setup',
    'To enable automatic payment detection:\n\n' +
      '1. Install the SMS library:\n' +
      '   npm install react-native-android-sms-listener\n\n' +
      '2. Rebuild the app with EAS:\n' +
      '   eas build -p android --profile preview\n\n' +
      '3. Grant SMS permissions when prompted\n\n' +
      'Note: This feature only works on Android.',
    [
      { text: 'OK', style: 'default' },
      {
        text: 'Learn More',
        onPress: () => Linking.openURL('https://github.com/andreyvital/react-native-android-sms-listener'),
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
