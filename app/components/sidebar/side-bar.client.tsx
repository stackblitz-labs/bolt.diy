import { useStore } from '@nanostores/react';
import { MessageCircleMore, Palette, SlidersHorizontal, History } from 'lucide-react';
import { sidebarPanelStore, type SidebarPanel } from '~/lib/stores/sidebarPanel';
import { ClientAuth } from '~/components/auth/ClientAuth';
import { ClientOnly } from 'remix-utils/client-only';
import { Suspense, useEffect, useState } from 'react';
import { SideNavButton } from './SideNavButton';
import { workbenchStore } from '~/lib/stores/workbench';
import { chatStore } from '~/lib/stores/chat';
import { includeHistorySummary } from '~/components/panels/HistoryPanel/AppHistory';
import { database } from '~/lib/persistence/apps';
import type { AppSummary } from '~/lib/persistence/messageAppSummary';

export function SideBar() {
  const activePanel = useStore(sidebarPanelStore.activePanel);
  const previewURL = useStore(workbenchStore.previewURL);
  const previewLoading = useStore(chatStore.previewLoading);
  const isPreviewReady = previewURL && !previewLoading;
  const appSummary = useStore(chatStore.appSummary);
  const appId = useStore(chatStore.currentAppId) as string;
  const [history, setHistory] = useState<AppSummary[]>([]);

  const handlePanelClick = (panel: SidebarPanel) => {
    sidebarPanelStore.setActivePanel(panel);
  };

  useEffect(() => {
    fetchHistory();
  }, [appId]);

  const fetchHistory = async () => {
    try {
      const history = await database.getAppHistory(appId);
      setHistory(history.filter(includeHistorySummary).reverse());
    } catch (err) {
      console.error('Failed to fetch app history:', err);
    }
  };

  const navItems: { icon: React.ReactNode; label: string; panel: SidebarPanel; disabled?: boolean }[] = [
    { icon: <MessageCircleMore size={20} strokeWidth={1.5} />, label: 'Chat', panel: 'chat' },
    { icon: <Palette size={20} strokeWidth={1.5} />, label: 'Design', panel: 'design', disabled: !isPreviewReady },
    {
      icon: <SlidersHorizontal size={20} strokeWidth={1.5} />,
      label: 'Settings',
      panel: 'settings',
      disabled: !appSummary,
    },
    { icon: <History size={20} strokeWidth={1.5} />, label: 'History', panel: 'history', disabled: !history.length },
  ];

  return (
    <aside className="flex flex-col items-center h-full w-[72px] bg-bolt-elements-background-depth-2">
      {/* Logo */}
      <a href="/" className="flex items-center justify-center w-14 h-14 m-2">
        <img src="/logo.svg" alt="Logo" className="w-9 h-9" />
      </a>

      {/* Navigation Items */}
      <nav className="flex flex-col items-center gap-1 flex-1 w-full px-2 py-1">
        {navItems.map((item) => (
          <SideNavButton
            key={item.panel}
            icon={item.icon}
            label={item.label}
            isSelected={activePanel === item.panel}
            onClick={() => handlePanelClick(item.panel)}
            disabled={item.disabled ?? false}
          />
        ))}
      </nav>

      {/* User Avatar at Bottom */}
      <div className="flex justify-center items-center py-3 w-full px-2">
        <ClientOnly>
          {() => (
            <Suspense fallback={<div className="w-10 h-10 rounded-full bg-muted animate-pulse" />}>
              <ClientAuth />
            </Suspense>
          )}
        </ClientOnly>
      </div>
    </aside>
  );
}

export default SideBar;
