import { useStore } from '@nanostores/react';

import { useState } from 'react';

import { MessageCircle, Palette, History, Settings, Rocket } from '~/components/ui/Icon';

import { activeSidebarTab, sidebarNavStore, type SidebarNavTab } from '~/lib/stores/sidebarNav';

import { classNames } from '~/utils/classNames';

import { chatStore } from '~/lib/stores/chat';

import { workbenchStore } from '~/lib/stores/workbench';

import { userStore } from '~/lib/stores/auth';

import { UserProfileMenu } from '~/components/header/UserProfileMenu';

import type { LucideIcon } from 'lucide-react';

import { themeChangesStore, resetThemeChanges } from '~/lib/stores/themeChanges';

import { UnsavedChangesDialog } from '~/components/panels/UnsavedChangesDialog';

import { versionHistoryStore } from '~/lib/stores/versionHistory';
import { deployModalStore } from '~/lib/stores/deployModal';

interface NavItem {
  id: SidebarNavTab;
  label: string;
  icon: LucideIcon;
  requiresApp?: boolean;
  requiresData?: boolean; // Whether the tab requires data to be loaded before enabling
}

const navItems: NavItem[] = [
  {
    id: 'chat',
    label: 'Chat',
    icon: MessageCircle,
  },
  {
    id: 'design-system',
    label: 'Design',
    icon: Palette,
    requiresApp: true,
  },
  {
    id: 'version-history',
    label: 'History',
    icon: History,
    requiresApp: true,
    requiresData: true,
  },
  {
    id: 'app-settings',
    label: 'Settings',
    icon: Settings,
    requiresApp: true,
  },
  {
    id: 'deploy',
    label: 'Deploy',
    icon: Rocket,
    requiresApp: true,
    requiresData: true,
  },
];

export const VerticalNav = () => {
  const activeTab = useStore(activeSidebarTab);
  const appId = useStore(chatStore.currentAppId);
  const repositoryId = useStore(workbenchStore.repositoryId);
  const user = useStore(userStore);
  const themeChanges = useStore(themeChangesStore);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingTab, setPendingTab] = useState<SidebarNavTab | null>(null);
  const versionHistory = useStore(versionHistoryStore.history);
  const versionHistoryLoaded = useStore(versionHistoryStore.lastFetched) !== null;
  const deployDataLoaded = useStore(deployModalStore.hasLoadedData);

  const handleTabClick = (tabId: SidebarNavTab) => {
    // Check if we're leaving the design-system tab and there are unsaved changes
    if (activeTab === 'design-system' && tabId !== 'design-system' && themeChanges.hasChanges) {
      setPendingTab(tabId);
      setShowUnsavedDialog(true);
      return;
    }

    sidebarNavStore.setActiveTab(tabId);
  };

  const handleConfirmLeave = () => {
    // Reset theme changes and switch to the pending tab
    resetThemeChanges();
    if (pendingTab) {
      sidebarNavStore.setActiveTab(pendingTab);
    }
    setShowUnsavedDialog(false);
    setPendingTab(null);
  };

  const handleCancelLeave = () => {
    setShowUnsavedDialog(false);
    setPendingTab(null);
  };

  // Get version count from store
  const versionCount = versionHistory.length;

  return (
    <div className="flex flex-col w-16 bg-bolt-elements-background-depth-1 py-2.5 h-full">
      {/* Nut Logo - Link to Homepage */}
      <a
        href="/"
        className="flex items-center justify-center mb-4 px-2 hover:opacity-80 transition-opacity"
        title="Nut - Home"
      >
        <svg width="29" height="29" viewBox="0 0 29 29" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M14.3333 3.66667V1M14.3333 3.66667C9 3.66667 4.33333 6.33333 3.66667 9C3.34267 10.2933 2.44133 11.6027 1 13C2.74667 12.8907 3.62933 12.6133 5 11.6667M14.3333 3.66667C19.6667 3.66667 24.3333 6.33333 25 9C25.3227 10.2933 25.9373 11.6187 27.6667 13C25.9107 13.2093 25.0427 12.888 23.6667 11.6667M5 11.6667V17C5.00022 19.0758 5.69206 21.0924 6.96623 22.7312C8.2404 24.37 10.0243 25.5375 12.036 26.0493C12.5853 26.188 13.1053 26.4387 13.5053 26.8387L14.3333 27.6667L15.1613 26.8387C15.5613 26.4387 16.0813 26.188 16.6307 26.0493C18.6425 25.5377 20.4265 24.3702 21.7007 22.7314C22.9749 21.0926 23.6667 19.0759 23.6667 17V11.6667M5 11.6667C5.72 12.8933 6.30933 13.4747 7.66667 14.3333C9.60267 13.4707 10.272 12.8693 11 11.6667C11.7933 12.9933 12.5347 13.5693 14.3333 14.3333C16.08 13.5053 16.816 12.9227 17.6667 11.6667C18.5053 12.9693 19.216 13.564 21 14.3333C22.612 13.6027 23.24 13.044 23.6667 11.6667"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-bolt-elements-textPrimary"
          />
        </svg>
      </a>

      <div className="flex flex-col gap-2 px-2 flex-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          // Determine if tab should be disabled
          let isDisabled = false;
          if (item.requiresApp) {
            if (!appId) {
              isDisabled = true;
            } else if (item.requiresData) {
              // For tabs that require data, check if data has been loaded
              if (item.id === 'version-history') {
                isDisabled = !versionHistoryLoaded;
              } else if (item.id === 'deploy') {
                isDisabled = !deployDataLoaded;
              }
            } else if (item.id === 'app-settings') {
              // Settings only needs appId, not repositoryId
              isDisabled = false;
            } else {
              // Other tabs need both appId and repositoryId
              isDisabled = !repositoryId;
            }
          }

          const showBadge = item.id === 'version-history' && versionCount > 0;

          return (
            <button
              key={item.id}
              onClick={() => !isDisabled && handleTabClick(item.id)}
              disabled={isDisabled}
              className={classNames(
                'flex flex-col items-center justify-center gap-1 p-2 rounded-lg transition-all duration-200 relative',
                isActive
                  ? 'bg-bolt-elements-background-depth-3 text-bolt-elements-textPrimary shadow-sm'
                  : isDisabled
                    ? 'text-bolt-elements-textTertiary opacity-40 cursor-not-allowed'
                    : 'text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-3 hover:bg-opacity-50',
              )}
              title={item.label}
            >
              <div className="relative">
                <Icon size={20} />
                {showBadge && (
                  <span className="absolute -top-2 -right-4 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-semibold text-white bg-blue-500 rounded-full border-2 border-bolt-elements-background-depth-1">
                    {versionCount > 99 ? '99+' : versionCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium leading-tight text-center">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* User Profile Menu at bottom */}
      {user && (
        <div className="px-2 pt-2 flex justify-center">
          <UserProfileMenu />
        </div>
      )}

      {/* Unsaved Changes Dialog */}
      <UnsavedChangesDialog isOpen={showUnsavedDialog} onConfirm={handleConfirmLeave} onCancel={handleCancelLeave} />
    </div>
  );
};
