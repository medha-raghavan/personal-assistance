# Mobile App Build Guide

## Changing the API Base URL

The API URL is configured in `services/api.ts` (line 4):

```typescript
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001/api';
```

### Method 1: Environment Variable (Recommended)

Create a `.env` file in the `mobile` directory:

```bash
EXPO_PUBLIC_API_URL=http://YOUR_SERVER_IP:3001/api
```

Examples:
- Local network: `EXPO_PUBLIC_API_URL=http://192.168.1.100:3001/api`
- Production: `EXPO_PUBLIC_API_URL=https://api.yourdomain.com/api`

### Method 2: Direct Edit

Edit `services/api.ts` line 4 directly:

```typescript
const API_URL = 'http://YOUR_SERVER_IP:3001/api';
```

---

## Building the APK

### Prerequisites

```bash
npm install -g eas-cli
eas login
```

### Quick Build

```bash
cd mobile
eas build -p android --profile preview
```

### Full Build (If Issues Occur)

```bash
cd mobile

# 1. Clean everything
rm -rf node_modules android .expo

# 2. Install dependencies
npm install

# 3. Fix Expo dependencies
npx expo install --fix

# 4. Generate native code
npx expo prebuild --platform android --clean

# 5. Build
eas build -p android --profile preview
```

### Download the APK

```bash
# List builds
eas build:list

# Download latest
eas build:download --latest --platform android
```

Or use the URL from the build output.

---

## Build Profiles

| Profile | Command | Output |
|---------|---------|--------|
| Preview (testing) | `eas build -p android --profile preview` | APK |
| Production | `eas build -p android --profile production` | AAB |

---

## Current Configuration

- Expo SDK: 52
- React Native: 0.76.x
- NativeWind: 2.0.11

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Metro errors | `npx expo start --clear` |
| Dependency conflicts | `npx expo install --fix` |
| Missing assets | Ensure `assets/` has icon.png, splash.png, adaptive-icon.png |
| Build queue delay | Free tier can take 10-20 min in queue |
