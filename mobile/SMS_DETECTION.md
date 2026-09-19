# Payment Auto-Detection Setup Guide

This feature automatically detects payments from bank/UPI SMS messages and prompts you to record them as transactions — including when the app is in the background or closed.

## How It Works

1. **SMS Listener**: The app monitors incoming SMS messages (foreground service + headless task)
2. **Payment Parser**: Identifies and extracts payment details from bank/UPI messages
3. **Heads-up notification**: If the app is not open, a high-priority popup notification appears
4. **Quick Add Overlay**: Tap the notification (or stay in-app) to review pre-filled details
5. **One-Tap Save**: Select account, category, and save instantly

Pending payments are stored on-device so a detection that happened while the app was closed is still available when you open it.

## Setup Instructions

### Step 1: Install Dependencies

```bash
cd mobile
npm install
```

Requires a native rebuild (`eas build` or `expo run:android` — not Expo Go).

### Step 2: Permissions

The app needs:

- `RECEIVE_SMS` / `READ_SMS` — detect bank messages
- `POST_NOTIFICATIONS` — show the payment popup when the app is closed (Android 13+)

### Step 3: Rebuild the App

```bash
# Development build
eas build -p android --profile development

# OR Preview/Production build
eas build -p android --profile preview
```

### Step 4: Grant Permissions

1. Open the app → Settings
2. Enable **SMS Detection**
3. Grant **SMS** and **Notifications** when prompted
4. On Android 13+, also allow notifications in system Settings if the popup does not appear

## What You See

| App state | What happens |
|-----------|--------------|
| App open | Quick Add sheet slides up immediately |
| App background / closed | Heads-up notification: “Payment detected — tap to save” |
| Tap notification | App opens with that payment in Quick Add |

## Supported SMS Formats

### Major Banks
- **HDFC**: Rs.500 debited from A/c XX1234 to Amazon on 01-04-26
- **HDFC UPI (multiline)**: Sent Rs.150.00 / From HDFC Bank A/C *1014 / To 7 Eleven… / On 11/09/26
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

### No Popup When App Is Closed

1. Grant notification permission (Android Settings → Apps → My Assistant → Notifications)
2. Ensure SMS Detection is enabled in-app
3. Rebuild after adding `expo-notifications` (native module)
4. Confirm the SMS is from a bank/UPI sender and matches a known pattern

### SMS Detection Not Working

1. **Check permissions**: Android Settings → Apps → My Assistant → Permissions → SMS
2. **Check if enabled**: Settings → Payment Auto-Detection → SMS Detection toggle
3. **Verify library**: `npm list expo-sms-listener`

### Overlay Not Showing After Tap

1. Make sure you're logged in
2. Pending payments are listed under Settings → Pending Payments
3. Force-close and reopen the app once after granting notification permission

## Privacy & Security

- **Local Processing**: SMS parsing happens entirely on your device
- **No Cloud Upload**: SMS content is never sent to any server
- **Selective Listening**: Only processes SMS from bank/payment senders
- **OTP Filtered**: OTP and promotional messages are ignored

## Limitations

- **Android Only**: iOS does not allow SMS reading
- **Requires Rebuild**: Changes to native modules require app rebuild
- **Google Play**: READ_SMS permission requires justification for Play Store
- **True system overlay** (draw over other apps) is not used; Android heads-up notifications are the supported popup UX

## Files

| File | Description |
|------|-------------|
| `services/paymentParser.ts` | SMS parsing logic and regex patterns |
| `services/smsListener.ts` | SMS listener + background detection |
| `services/paymentNotifications.ts` | Heads-up payment notifications |
| `services/paymentPersistence.ts` | On-device pending payment storage |
| `store/paymentStore.ts` | State management for detected payments |
| `components/QuickAddOverlay.tsx` | Quick add UI component |
| `index.ts` | Headless task registration for closed-app SMS |
