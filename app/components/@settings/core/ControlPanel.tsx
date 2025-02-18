import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@nanostores/react';
import { Switch } from '@radix-ui/react-switch';
import * as RadixDialog from '@radix-ui/react-dialog';
import { classNames } from '~/utils/classNames';
import { TabManagement } from '~/components/@settings/shared/components/TabManagement';
import { TabTile } from '~/components/@settings/shared/components/TabTile';
import { useUpdateCheck } from '~/lib/hooks/useUpdateCheck';
import { useFeatures } from '~/lib/hooks/useFeatures';
import { useNotifications } from '~/lib/hooks/useNotifications';
import { useConnectionStatus } from '~/lib/hooks/useConnectionStatus';
import { useDebugStatus } from '~/lib/hooks/useDebugStatus';
import {
  tabConfigurationStore,
  developerModeStore,
  setDeveloperMode,
  resetTabConfiguration,
} from '~/lib/stores/settings';
import { profileStore } from '~/lib/stores/profile';
import type { TabType, TabVisibilityConfig, Profile } from './types';
import { TAB_LABELS, DEFAULT_TAB_CONFIG } from './constants';
import { DialogTitle } from '~/components/ui/Dialog';
import { AvatarDropdown } from './AvatarDropdown';
import BackgroundRays from '~/components/ui/BackgroundRays';

// Import all tab components
import ProfileTab from '~/components/@settings/tabs/profile/ProfileTab';
import SettingsTab from '~/components/@settings/tabs/settings/SettingsTab';
import NotificationsTab from '~/components/@settings/tabs/notifications/NotificationsTab';
import FeaturesTab from '~/components/@settings/tabs/features/FeaturesTab';
import DataTab from '~/components/@settings/tabs/data/DataTab';
import DebugTab from '~/components/@settings/tabs/debug/DebugTab';
import { EventLogsTab } from '~/components/@settings/tabs/event-logs/EventLogsTab';
import UpdateTab from '~/components/@settings/tabs/update/UpdateTab';
import ConnectionsTab from '~/components/@settings/tabs/connections/ConnectionsTab';
import CloudProvidersTab from '~/components/@settings/tabs/providers/cloud/CloudProvidersTab';
import ServiceStatusTab from '~/components/@settings/tabs/providers/status/ServiceStatusTab';
import LocalProvidersTab from '~/components/@settings/tabs/providers/local/LocalProvidersTab';
import TaskManagerTab from '~/components/@settings/tabs/task-manager/TaskManagerTab';

interface ControlPanelProps {
  open: boolean;
  onClose: () => void;
}

interface TabWithDevType extends TabVisibilityConfig {
  isExtraDevTab?: boolean;
}

interface ExtendedTabConfig extends TabVisibilityConfig {
  isExtraDevTab?: boolean;
}

interface BaseTabConfig {
  id: TabType;
  visible: boolean;
  window: 'user' | 'developer';
  order: number;
}

interface AnimatedSwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id: string;
  label: string;
}

const TAB_DESCRIPTIONS: Record<TabType, string> = {
  profile: 'Manage your profile and account settings',
  settings: 'Configure application preferences',
  notifications: 'View and manage your notifications',
  features: 'Explore new and upcoming features',
  data: 'Manage your data and storage',
  'cloud-providers': 'Configure cloud AI providers and models',
  'local-providers': 'Configure local AI providers and models',
  'service-status': 'Monitor cloud LLM service status',
  connection: 'Check connection status and settings',
  debug: 'Debug tools and system information',
  'event-logs': 'View system events and logs',
  update: 'Check for updates and release notes',
  'task-manager': 'Monitor system resources and processes',
  'tab-management': 'Configure visible tabs and their order',
};

// Beta status for experimental features
const BETA_TABS = new Set<TabType>(['task-manager', 'service-status', 'update', 'local-providers']);

const BetaLabel = () => (
  <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full bg-purple-500/10 dark:bg-purple-500/20">
    <span className="text-[10px] font-medium text-purple-600 dark:text-purple-400">BETA</span>
  </div>
);

const AnimatedSwitch = ({ checked, onCheckedChange, id, label }: AnimatedSwitchProps) => {
  return (
    <div className="flex items-center gap-2">
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className={classNames(
          'relative inline-flex h-6 w-11 items-center rounded-full',
          'transition-all duration-300 ease-[cubic-bezier(0.87,_0,_0.13,_1)]',
          'bg-gray-200 dark:bg-gray-700',
          'data-[state=checked]:bg-purple-500',
          'focus:outline-none focus:ring-2 focus:ring-purple-500/20',
          'cursor-pointer',
          'group',
        )}
      >
        <motion.span
          className={classNames(
            'absolute left-[2px] top-[2px]',
            'inline-block h-5 w-5 rounded-full',
            'bg-white shadow-lg',
            'transition-shadow duration-300',
            'group-hover:shadow-md group-active:shadow-sm',
            'group-hover:scale-95 group-active:scale-90',
          )}
          initial={false}
          transition={{
            type: 'spring',
            stiffness: 500,
            damping: 30,
            duration: 0.2,
          }}
          animate={{
            x: checked ? '1.25rem' : '0rem',
          }}
        >
          <motion.div
            className="absolute inset-0 rounded-full bg-white"
            initial={false}
            animate={{
              scale: checked ? 1 : 0.8,
            }}
            transition={{ duration: 0.2 }}
          />
        </motion.span>
        <span className="sr-only">Toggle {label}</span>
      </Switch>
      <div className="flex items-center gap-2">
        <label
          htmlFor={id}
          className="text-sm text-gray-500 dark:text-gray-400 select-none cursor-pointer whitespace-nowrap w-[88px]"
        >
          {label}
        </label>
      </div>
    </div>
  );
};

export const ControlPanel = ({ open, onClose }: ControlPanelProps) => {
  // State
  const [activeTab, setActiveTab] = useState<TabType | null>(null);
  const [loadingTab, setLoadingTab] = useState<TabType | null>(null);
  const [showTabManagement, setShowTabManagement] = useState(false);

  // Store values
  const tabConfiguration = useStore(tabConfigurationStore);
  const developerMode = useStore(developerModeStore);
  const profile = useStore(profileStore) as Profile;

  // Status hooks
  const { hasUpdate, currentVersion, acknowledgeUpdate } = useUpdateCheck();
  const { hasNewFeatures, unviewedFeatures, acknowledgeAllFeatures } = useFeatures();
  const { hasUnreadNotifications, unreadNotifications, markAllAsRead } = useNotifications();
  const { hasConnectionIssues, currentIssue, acknowledgeIssue } = useConnectionStatus();
  const { hasActiveWarnings, activeIssues, acknowledgeAllIssues } = useDebugStatus();

  // Memoize the base tab configurations to avoid recalculation
  const baseTabConfig = useMemo(() => {
    return new Map(DEFAULT_TAB_CONFIG.map((tab) => [tab.id, tab]));
  }, []);

  // Add visibleTabs logic using useMemo with optimized calculations
  const visibleTabs = useMemo(() => {
    if (!tabConfiguration?.userTabs || !Array.isArray(tabConfiguration.userTabs)) {
      console.warn('Invalid tab configuration, resetting to defaults');
      resetTabConfiguration();

      return [];
    }

    const notificationsDisabled = profile?.preferences?.notifications === false;

    // In developer mode, show ALL tabs without restrictions
    if (developerMode) {
      const seenTabs = new Set<TabType>();
      const devTabs: ExtendedTabConfig[] = [];

      // Process tabs in order of priority: developer, user, default
      const processTab = (tab: BaseTabConfig) => {
        if (!seenTabs.has(tab.id)) {
          seenTabs.add(tab.id);
          devTabs.push({
            id: tab.id,
            visible: true,
            window: 'developer',
            order: tab.order || devTabs.length,
          });
        }
      };

      // Process tabs in priority order
      tabConfiguration.developerTabs?.forEach((tab) => processTab(tab as BaseTabConfig));
      tabConfiguration.userTabs.forEach((tab) => processTab(tab as BaseTabConfig));
      DEFAULT_TAB_CONFIG.forEach((tab) => processTab(tab as BaseTabConfig));

      // Add Tab Management tile
      devTabs.push({
        id: 'tab-management' as TabType,
        visible: true,
        window: 'developer',
        order: devTabs.length,
        isExtraDevTab: true,
      });

      return devTabs.sort((a, b) => a.order - b.order);
    }

    // Optimize user mode tab filtering
    return tabConfiguration.userTabs
      .filter((tab) => {
        if (!tab?.id) {
          return false;
        }

        if (tab.id === 'notifications' && notificationsDisabled) {
          return false;
        }

        return tab.visible && tab.window === 'user';
      })
      .sort((a, b) => a.order - b.order);
  }, [tabConfiguration, developerMode, profile?.preferences?.notifications, baseTabConfig]);

  // Optimize animation performance with layout animations
  const gridLayoutVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        type: 'spring',
        stiffness: 200,
        damping: 20,
        mass: 0.6,
      },
    },
  };

  // Reset to default view when modal opens/closes
  useEffect(() => {
    if (!open) {
      // Reset when closing
      setActiveTab(null);
      setLoadingTab(null);
      setShowTabManagement(false);
    } else {
      // When opening, set to null to show the main view
      setActiveTab(null);
    }
  }, [open]);

  // Handle closing
  const handleClose = () => {
    setActiveTab(null);
    setLoadingTab(null);
    setShowTabManagement(false);
    onClose();
  };

  // Handlers
  const handleBack = () => {
    if (showTabManagement) {
      setShowTabManagement(false);
    } else if (activeTab) {
      setActiveTab(null);
    }
  };

  const handleDeveloperModeChange = (checked: boolean) => {
    console.log('Developer mode changed:', checked);
    setDeveloperMode(checked);
  };

  // Add effect to log developer mode changes
  useEffect(() => {
    console.log('Current developer mode:', developerMode);
  }, [developerMode]);

  const getTabComponent = (tabId: TabType | 'tab-management') => {
    if (tabId === 'tab-management') {
      return <TabManagement />;
    }

    switch (tabId) {
      case 'profile':
        return <ProfileTab />;
      case 'settings':
        return <SettingsTab />;
      case 'notifications':
        return <NotificationsTab />;
      case 'features':
        return <FeaturesTab />;
      case 'data':
        return <DataTab />;
      case 'cloud-providers':
        return <CloudProvidersTab />;
      case 'local-providers':
        return <LocalProvidersTab />;
      case 'connection':
        return <ConnectionsTab />;
      case 'debug':
        return <DebugTab />;
      case 'event-logs':
        return <EventLogsTab />;
      case 'update':
        return <UpdateTab />;
      case 'task-manager':
        return <TaskManagerTab />;
      case 'service-status':
        return <ServiceStatusTab />;
      default:
        return null;
    }
  };

  const getTabUpdateStatus = (tabId: TabType): boolean => {
    switch (tabId) {
      case 'update':
        return hasUpdate;
      case 'features':
        return hasNewFeatures;
      case 'notifications':
        return hasUnreadNotifications;
      case 'connection':
        return hasConnectionIssues;
      case 'debug':
        return hasActiveWarnings;
      default:
        return false;
    }
  };

  const getStatusMessage = (tabId: TabType): string => {
    switch (tabId) {
      case 'update':
        return `New update available (v${currentVersion})`;
      case 'features':
        return `${unviewedFeatures.length} new feature${unviewedFeatures.length === 1 ? '' : 's'} to explore`;
      case 'notifications':
        return `${unreadNotifications.length} unread notification${unreadNotifications.length === 1 ? '' : 's'}`;
      case 'connection':
        return currentIssue === 'disconnected'
          ? 'Connection lost'
          : currentIssue === 'high-latency'
            ? 'High latency detected'
            : 'Connection issues detected';
      case 'debug': {
        const warnings = activeIssues.filter((i) => i.type === 'warning').length;
        const errors = activeIssues.filter((i) => i.type === 'error').length;

        return `${warnings} warning${warnings === 1 ? '' : 's'}, ${errors} error${errors === 1 ? '' : 's'}`;
      }
      default:
        return '';
    }
  };

  const handleTabClick = (tabId: TabType) => {
    setLoadingTab(tabId);
    setActiveTab(tabId);
    setShowTabManagement(false);

    // Acknowledge notifications based on tab
    switch (tabId) {
      case 'update':
        acknowledgeUpdate();
        break;
      case 'features':
        acknowledgeAllFeatures();
        break;
      case 'notifications':
        markAllAsRead();
        break;
      case 'connection':
        acknowledgeIssue();
        break;
      case 'debug':
        acknowledgeAllIssues();
        break;
    }

    // Clear loading state after a delay
    setTimeout(() => setLoadingTab(null), 500);
  };

  return (
    <RadixDialog.Root open={open}>
      <RadixDialog.Portal>
        <div className="fixed inset-0 flex items-center justify-center z-[100]">
          <RadixDialog.Overlay asChild>
            <motion.div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            />
          </RadixDialog.Overlay>

          <RadixDialog.Content
            aria-describedby={undefined}
            onEscapeKeyDown={handleClose}
            onPointerDownOutside={handleClose}
            className="relative z-[101]"
          >
            <motion.div
              className={classNames(
                'w-[1200px] h-[90vh]',
                'bg-[#FAFAFA] dark:bg-[#0A0A0A]',
                'rounded-2xl shadow-2xl',
                'border border-[#E5E5E5] dark:border-[#1A1A1A]',
                'flex flex-col overflow-hidden',
                'relative',
              )}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="absolute inset-0 overflow-hidden rounded-2xl">
                <BackgroundRays />
              </div>
              <div className="relative z-10 flex flex-col h-full">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center space-x-4">
                    {(activeTab || showTabManagement) && (
                      <button
                        onClick={handleBack}
                        className="flex items-center justify-center w-8 h-8 rounded-full bg-transparent hover:bg-purple-500/10 dark:hover:bg-purple-500/20 group transition-all duration-200"
                      >
                        <div className="i-ph:arrow-left w-4 h-4 text-gray-500 dark:text-gray-400 group-hover:text-purple-500 transition-colors" />
                      </button>
                    )}
                    <DialogTitle className="text-xl font-semibold text-gray-900 dark:text-white">
                      {showTabManagement ? 'Tab Management' : activeTab ? TAB_LABELS[activeTab] : 'Control Panel'}
                    </DialogTitle>
                  </div>

                  <div className="flex items-center gap-6">
                    {/* Mode Toggle */}
                    <div className="flex items-center gap-2 min-w-[140px] border-r border-gray-200 dark:border-gray-800 pr-6">
                      <AnimatedSwitch
                        id="developer-mode"
                        checked={developerMode}
                        onCheckedChange={handleDeveloperModeChange}
                        label={developerMode ? 'Developer Mode' : 'User Mode'}
                      />
                    </div>

                    {/* Avatar and Dropdown */}
                    <div className="border-l border-gray-200 dark:border-gray-800 pl-6">
                      <AvatarDropdown onSelectTab={handleTabClick} />
                    </div>

                    {/* Close Button */}
                    <button
                      onClick={handleClose}
                      className="flex items-center justify-center w-8 h-8 rounded-full bg-transparent hover:bg-purple-500/10 dark:hover:bg-purple-500/20 group transition-all duration-200"
                    >
                      <div className="i-ph:x w-4 h-4 text-gray-500 dark:text-gray-400 group-hover:text-purple-500 transition-colors" />
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div
                  className={classNames(
                    'flex-1',
                    'overflow-y-auto',
                    'hover:overflow-y-auto',
                    'scrollbar scrollbar-w-2',
                    'scrollbar-track-transparent',
                    'scrollbar-thumb-[#E5E5E5] hover:scrollbar-thumb-[#CCCCCC]',
                    'dark:scrollbar-thumb-[#333333] dark:hover:scrollbar-thumb-[#444444]',
                    'will-change-scroll',
                    'touch-auto',
                  )}
                >
                  <motion.div
                    key={activeTab || 'home'}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="p-6"
                  >
                    {showTabManagement ? (
                      <TabManagement />
                    ) : activeTab ? (
                      getTabComponent(activeTab)
                    ) : (
                      <motion.div
                        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative"
                        variants={gridLayoutVariants}
                        initial="hidden"
                        animate="visible"
                      >
                        <AnimatePresence mode="popLayout">
                          {(visibleTabs as TabWithDevType[]).map((tab: TabWithDevType) => (
                            <motion.div key={tab.id} layout variants={itemVariants} className="aspect-[1.5/1]">
                              <TabTile
                                tab={tab}
                                onClick={() => handleTabClick(tab.id as TabType)}
                                isActive={activeTab === tab.id}
                                hasUpdate={getTabUpdateStatus(tab.id)}
                                statusMessage={getStatusMessage(tab.id)}
                                description={TAB_DESCRIPTIONS[tab.id]}
                                isLoading={loadingTab === tab.id}
                                className="h-full relative"
                              >
                                {BETA_TABS.has(tab.id) && <BetaLabel />}
                              </TabTile>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </motion.div>
                    )}
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </RadixDialog.Content>
        </div>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
};
