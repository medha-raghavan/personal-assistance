import type { WidgetTaskHandler } from 'react-native-android-widget';
import {
  fetchAndCacheWidgetDashboard,
  getEmptyWidgetData,
  loadWidgetDashboardData,
} from '../services/widgetData';
import { renderDashboardWidget } from './DashboardWidget';

export const widgetTaskHandler: WidgetTaskHandler = async ({
  widgetAction,
  renderWidget,
}) => {
  if (widgetAction === 'WIDGET_DELETED') {
    return;
  }

  const cached = (await loadWidgetDashboardData()) ?? getEmptyWidgetData();
  renderWidget(renderDashboardWidget(cached));

  try {
    const fresh = await fetchAndCacheWidgetDashboard();
    renderWidget(renderDashboardWidget(fresh));
  } catch {
    // Keep cached snapshot when offline or unauthenticated.
  }
};
