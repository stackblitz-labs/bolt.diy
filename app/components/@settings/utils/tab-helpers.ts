import type { TabVisibilityConfig } from '~/components/@settings/core/types';
import { DEFAULT_TAB_CONFIG } from '~/components/@settings/core/constants';

export const getVisibleTabs = (
  tabConfiguration: { userTabs: TabVisibilityConfig[] },
  notificationsEnabled: boolean,
): TabVisibilityConfig[] => {
  if (!tabConfiguration?.userTabs || !Array.isArray(tabConfiguration.userTabs)) {
    console.warn('Invalid tab configuration, using defaults');
    return DEFAULT_TAB_CONFIG as TabVisibilityConfig[];
  }

  // In user mode, only show visible user tabs
  return tabConfiguration.userTabs
    .filter((tab) => {
      if (!tab || typeof tab.id !== 'string') {
        console.warn('Invalid tab entry:', tab);
        return false;
      }

      // Hide notifications tab if notifications are disabled
      if (tab.id === 'notifications' && !notificationsEnabled) {
        return false;
      }

      // Only show tabs that are explicitly visible and assigned to the user window
      return tab.visible && tab.window === 'user';
    })
    .sort((a, b) => a.order - b.order);
};

export const reorderTabs = (
  tabs: TabVisibilityConfig[],
  startIndex: number,
  endIndex: number,
): TabVisibilityConfig[] => {
  const result = Array.from(tabs);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);

  // Update order property
  return result.map((tab, index) => ({
    ...tab,
    order: index,
  }));
};

export const resetToDefaultConfig = (isDeveloperMode: boolean): TabVisibilityConfig[] => {
  return DEFAULT_TAB_CONFIG.map((tab) => ({
    ...tab,
    visible: isDeveloperMode ? true : tab.window === 'user',
    window: isDeveloperMode ? 'developer' : tab.window,
  })) as TabVisibilityConfig[];
};
