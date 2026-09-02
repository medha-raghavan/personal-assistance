import { Platform } from 'react-native';
import { requestWidgetUpdate } from 'react-native-android-widget';
import {
  fetchAndCacheWidgetDashboard,
  getEmptyWidgetData,
  loadWidgetDashboardData,
} from './widgetData';
import { renderDashboardWidget } from '../widgets/DashboardWidget';

export async function refreshDashboardWidget(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  try {
    await fetchAndCacheWidgetDashboard();
  } catch {
    // Fall back to cached widget data.
  }

  await requestWidgetUpdate({
    widgetName: 'Dashboard',
    renderWidget: async () => {
      const data = (await loadWidgetDashboardData()) ?? getEmptyWidgetData();
      return renderDashboardWidget(data);
    },
  });
}
