import { AppRegistry } from 'react-native';
import 'expo-router/entry';
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { widgetTaskHandler } from './widgets/widgetTaskHandler';

registerWidgetTaskHandler(widgetTaskHandler);

AppRegistry.registerHeadlessTask(
  'ExpoSmsListenerBackground',
  () => async (data: { originatingAddress?: string; body?: string }) => {
    if (!data?.originatingAddress || !data?.body) {
      return;
    }
    const { handleIncomingSms } = require('./services/smsListener');
    handleIncomingSms(data.originatingAddress, data.body);
  }
);
