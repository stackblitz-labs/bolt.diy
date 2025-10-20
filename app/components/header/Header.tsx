import { useStore } from '@nanostores/react';
import { ClientOnly } from 'remix-utils/client-only';
import { chatStore } from '~/lib/stores/chat';
import { classNames } from '~/utils/classNames';
import { Suspense, useState } from 'react';
import { ClientAuth } from '~/components/auth/ClientAuth';
import { sidebarMenuStore } from '~/lib/stores/sidebarMenu';
import { IconButton } from '~/components/ui/IconButton';
import { userStore } from '~/lib/stores/userAuth';
import { ThemeSwitch } from '~/components/ui/ThemeSwitch';
import { ChatDescription } from '~/lib/persistence/ChatDescription.client';
import { DeployChatButton } from './DeployChat/DeployChatButton';
import { AppSettingsButton } from './AppSettings/AppSettingsButton';
import { DownloadButton } from './DownloadButton';
import ViewVersionHistoryButton from '~/components/workbench/VesionHistory/ViewVersionHistoryButton';
import useViewport from '~/lib/hooks';
import { workbenchStore } from '~/lib/stores/workbench';
import { database } from '~/lib/persistence/apps';
import { type AppSummary } from '~/lib/persistence/messageAppSummary';
import { includeHistorySummary } from '~/components/workbench/VesionHistory/AppHistory';
import { PanelLeft } from '~/components/ui/Icon';
import { useEffect } from 'react';
import { useLocation } from '@remix-run/react';

export function Header() {
  const chatStarted = useStore(chatStore.started);
  const user = useStore(userStore.user);
  const appSummary = useStore(chatStore.appSummary);
  const appId = useStore(chatStore.currentAppId);
  const isSmallViewport = useViewport(800);
  const repositoryId = useStore(workbenchStore.pendingRepositoryId);
  const [history, setHistory] = useState<AppSummary[]>([]);
  const location = useLocation();

  const fetchHistory = async () => {
    try {
      const history = await database.getAppHistory(appId!);
      setHistory(history.filter(includeHistorySummary));
    } catch (err) {
      console.error('Failed to fetch app history:', err);
    }
  };

  useEffect(() => {
    if (appId) {
      fetchHistory();
    }
  }, [appSummary, appId]);

  return (
    <header
      className={classNames(
        'flex items-center justify-between px-4 py-4 border-b h-[var(--header-height)] bg-bolt-elements-background-depth-1 bg-opacity-80 transition-all duration-300 z-10',
        {
          'border-transparent shadow-none': !chatStarted,
          'border-bolt-elements-borderColor border-opacity-50 shadow-sm backdrop-blur-md': chatStarted,
        },
      )}
    >
      <div className="flex items-center gap-4 text-bolt-elements-textPrimary">
        {user && (
          <IconButton
            onClick={() => sidebarMenuStore.toggle()}
            data-testid="sidebar-icon"
            icon={<PanelLeft />}
            size="xl"
            title="Toggle Sidebar"
          />
        )}
        {!user && location.pathname !== '/rebuild-broken-dreams' && <ThemeSwitch />}
        {appSummary && !isSmallViewport && <ChatDescription />}
      </div>

      {appSummary && !isSmallViewport && (
        <div className="flex-1 flex justify-center">
          <div className="flex items-center gap-3">
            {history.length > 0 && <ViewVersionHistoryButton />}
            {repositoryId && <DownloadButton />}
            {repositoryId && appId && <AppSettingsButton />}
            {repositoryId && appId && <DeployChatButton />}
          </div>
        </div>
      )}

      <ClientOnly>
        {() => (
          <Suspense
            fallback={
              <div className="w-10 h-10 rounded-xl bg-bolt-elements-background-depth-2 animate-pulse border border-bolt-elements-borderColor gap-2" />
            }
          >
            <div className="flex items-center gap-3">
              {(user || location.pathname === '/rebuild-broken-dreams') && <ThemeSwitch />}
              <ClientAuth />
            </div>
          </Suspense>
        )}
      </ClientOnly>
    </header>
  );
}
