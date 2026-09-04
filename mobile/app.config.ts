import type { ConfigContext, ExpoConfig } from 'expo/config';
import type { WithAndroidWidgetsParams } from 'react-native-android-widget';

const widgetConfig: WithAndroidWidgetsParams = {
  widgets: [
    {
      name: 'Dashboard',
      label: 'My Assistant Dashboard',
      minWidth: '250dp',
      minHeight: '250dp',
      targetCellWidth: 4,
      targetCellHeight: 4,
      description: 'View balance, income, and expenses at a glance',
      previewImage: './assets/widget-preview.png',
      updatePeriodMillis: 1800000,
      resizeMode: 'horizontal|vertical',
    },
  ],
};

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'My Assistant',
  slug: 'personal-finance',
  version: '1.0.0',
  orientation: 'default',
  icon: './assets/icon.png',
  scheme: 'my-assistant',
  userInterfaceStyle: 'automatic',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#0ea5e9',
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.personalfinance.app',
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0ea5e9',
    },
    package: 'com.personalfinance.app',
    permissions: [
      'android.permission.RECEIVE_SMS',
      'android.permission.READ_SMS',
    ],
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-build-properties',
      {
        android: {
          compileSdkVersion: 35,
          targetSdkVersion: 34,
          minSdkVersion: 24,
          usesCleartextTraffic: true,
        },
      },
    ],
    '@react-native-community/datetimepicker',
    'expo-sms-listener',
    ['react-native-android-widget', widgetConfig],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    router: {
      origin: false,
    },
    eas: {
      projectId: '270b4091-8374-42c0-8e4c-b7beb7f62315',
    },
  },
});
