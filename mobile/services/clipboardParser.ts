import * as Clipboard from 'expo-clipboard';
import { Alert, Platform } from 'react-native';
import { parsePaymentSMS } from './paymentParser';
import { usePaymentStore } from '../store/paymentStore';

export async function parseFromClipboard(): Promise<boolean> {
  try {
    const text = await Clipboard.getStringAsync();
    
    if (!text || text.trim().length === 0) {
      Alert.alert(
        'No Text Found',
        'Copy a payment message or notification text first, then try again.'
      );
      return false;
    }

    const payment = parsePaymentSMS(text);
    
    if (payment && payment.amount > 0) {
      usePaymentStore.getState().addPendingPayment(payment);
      return true;
    } else {
      Alert.alert(
        'No Payment Detected',
        'Could not find payment details in the clipboard text. Make sure you copied a bank/UPI payment message.',
        [{ text: 'OK' }]
      );
      return false;
    }
  } catch (error) {
    console.error('Clipboard read error:', error);
    Alert.alert('Error', 'Could not read from clipboard.');
    return false;
  }
}

export function showManualEntryPrompt(onSubmit: (amount: number, merchant: string) => void) {
  Alert.prompt(
    'Quick Add Payment',
    'Enter payment amount:',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Next',
        onPress: (amountText) => {
          const amount = parseFloat(amountText || '0');
          if (amount <= 0) {
            Alert.alert('Invalid Amount', 'Please enter a valid amount.');
            return;
          }
          
          Alert.prompt(
            'Merchant/Description',
            'Who did you pay? (optional)',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Add Payment',
                onPress: (merchant) => {
                  onSubmit(amount, merchant || 'Payment');
                },
              },
            ],
            'plain-text',
            ''
          );
        },
      },
    ],
    'plain-text',
    ''
  );
}

export function createManualPayment(amount: number, merchant: string, type: 'debit' | 'credit' = 'debit') {
  usePaymentStore.getState().addPendingPayment({
    amount,
    merchant,
    type,
    date: new Date(),
    rawMessage: `Manual entry: ${merchant} - ${amount}`,
  });
}
