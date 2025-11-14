import { atom } from 'nanostores';

export type SidebarNavTab = 'chat' | 'design-system' | 'version-history' | 'app-settings' | 'deploy';

export class SidebarNavStore {
  activeTab = atom<SidebarNavTab>('chat');

  constructor() {
    if (import.meta.hot) {
      import.meta.hot.data.activeTab = this.activeTab;
    }
  }

  setActiveTab(tab: SidebarNavTab) {
    this.activeTab.set(tab);
  }

  getActiveTab() {
    return this.activeTab.get();
  }
}

export const sidebarNavStore = new SidebarNavStore();
export const activeSidebarTab = sidebarNavStore.activeTab;
