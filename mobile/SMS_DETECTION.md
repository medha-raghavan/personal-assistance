# Payment Auto-Detection Setup Guide

This feature automatically detects payments from bank/UPI SMS messages and prompts you to record them as transactions.

## How It Works

1. **SMS Listener**: The app monitors incoming SMS messages
2. **Payment Parser**: Identifies and extracts payment details from bank/UPI messages
3. **Quick Add Overlay**: Shows a popup with pre-filled transaction details
4. **One-Tap Save**: Select account, category, and save instantly

## Setup Instructions

### Step 1: Install SMS Listener Library

```bash
cd mobile
npm install react-native-android-sms-listener
```

### Step 2: Add Permissions to AndroidManifest.xml

The library should automatically add these, but verify they exist in `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.RECEIVE_SMS" />
<uses-permission android:name="android.permission.READ_SMS" />
```

### Step 3: Rebuild the App

Since this requires native modules, you need to rebuild with EAS:

```bash
# Development build
eas build -p android --profile development

# OR Preview/Production build
eas build -p android --profile preview
```

### Step 4: Grant Permissions

When you first open the app:
1. Go to Settings tab
2. Enable "SMS Detection"
3. Grant SMS permissions when prompted

## Supported SMS Formats

### Major Banks
- **HDFC**: Rs.500 debited from A/c XX1234 to Amazon on 01-04-26
- **ICICI**: Your A/c XXXX is debited for Rs.500 on 01-Apr for Swiggy
- **SBI**: Rs.1000 debited from A/c XX5678 to Flipkart
- **Axis**: INR 750 spent on A/c XX9012 at BigBasket
- **Kotak**: Rs.300 withdrawn from A/c XX3456

### UPI Payments
- Generic: Paid Rs.250 to merchant@upi
- GPay style: Rs.100 paid to Store Name
- PhonePe style: Sent Rs.500 to friend@ybl

### Credit Messages
- Rs.5000 credited to A/c XX1234 from ABC Company

## Testing the Parser

1. Open Settings tab
2. Tap "Test Parser"
3. Paste a sample SMS message
4. See parsed results

## Troubleshooting

### SMS Detection Not Working

1. **Check permissions**: Go to Android Settings > Apps > Personal Finance > Permissions > SMS
2. **Check if enabled**: Settings > Payment Auto-Detection > SMS Detection toggle
3. **Verify library**: Run `npm list react-native-android-sms-listener`

### Parser Not Recognizing SMS

The parser looks for specific patterns. If your bank uses a different format:
1. Use "Test Parser" to check if it's detected
2. Open an issue with the SMS format (redact personal info)

### Overlay Not Showing

1. Make sure you're logged in
2. Check if SMS detection is enabled in Settings
3. The SMS must be from a recognized sender (bank sender IDs)

## Privacy & Security

- **Local Processing**: SMS parsing happens entirely on your device
- **No Cloud Upload**: SMS content is never sent to any server
- **Selective Listening**: Only processes SMS from bank/payment senders
- **OTP Filtered**: OTP and promotional messages are ignored

## Limitations

- **Android Only**: iOS does not allow SMS reading
- **Requires Rebuild**: Changes to native modules require app rebuild
- **Google Play**: READ_SMS permission requires justification for Play Store

## Files

| File | Description |
|------|-------------|
| `services/paymentParser.ts` | SMS parsing logic and regex patterns |
| `services/smsListener.ts` | SMS listener initialization and handling |
| `store/paymentStore.ts` | State management for detected payments |
| `components/QuickAddOverlay.tsx` | Quick add UI component |
