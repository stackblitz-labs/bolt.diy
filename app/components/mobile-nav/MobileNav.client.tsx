import { useStore } from '@nanostores/react';
import { classNames } from '~/utils/classNames';
import { workbenchStore } from '~/lib/stores/workbench';
import { mobileNavStore, type MobileNavTab } from '~/lib/stores/mobileNav';
import { sidebarPanelStore } from '~/lib/stores/sidebarPanel';
import { MessageCircle, Monitor, Settings, History } from 'lucide-react';

interface TabConfig {
  id: MobileNavTab;
  label: string;
  icon: React.ReactNode;
}

const tabs: TabConfig[] = [
  { id: 'chat', label: 'Chat', icon: <MessageCircle size={20} /> },
  { id: 'canvas', label: 'Canvas', icon: <Monitor size={20} /> },
  // { id: 'theme', label: 'Theme', icon: <Palette size={20} /> },
  { id: 'settings', label: 'Settings', icon: <Settings size={20} /> },
  { id: 'history', label: 'History', icon: <History size={20} /> },
];

export const MobileNav = () => {
  const showWorkbench = useStore(workbenchStore.showWorkbench);
  const activeTab = useStore(mobileNavStore.activeTab);

  const handleTabClick = (tab: MobileNavTab) => {
    mobileNavStore.setActiveTab(tab);

    // Handle workbench visibility
    if (tab === 'canvas') {
      if (!showWorkbench) {
        workbenchStore.showWorkbench.set(true);
      }
    } else {
      workbenchStore.showWorkbench.set(false);
    }

    // Map mobile tabs to sidebar panels
    switch (tab) {
      case 'chat':
        sidebarPanelStore.setActivePanel('chat');
        break;
      // case 'theme':
      //   sidebarPanelStore.setActivePanel('design');
      //   break;
      case 'settings':
        sidebarPanelStore.setActivePanel('settings');
        break;
      case 'history':
        sidebarPanelStore.setActivePanel('history');
        break;
      case 'canvas':
        // Keep current panel, just show workbench
        break;
    }
  };

  const getTabClasses = (tabId: MobileNavTab) => {
    const isActive = activeTab === tabId;
    return classNames(
      'flex-1 flex flex-col items-center justify-center py-2 gap-1 transition-colors',
      isActive
        ? 'text-bolt-elements-textPrimary bg-bolt-elements-background-depth-1'
        : 'text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary',
    );
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-bolt-elements-background-depth-2 border-t border-bolt-elements-borderColor safe-area-bottom">
      <div className="flex w-full">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => handleTabClick(tab.id)} className={getTabClasses(tab.id)}>
            {tab.icon}
            <span className="text-xs font-medium">{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
