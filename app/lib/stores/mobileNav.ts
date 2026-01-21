import { atom } from 'nanostores';

export type MobileNavTab = 'chat' | 'canvas' | 'theme' | 'settings' | 'history';

export class MobileNavStore {
  activeTab = atom<MobileNavTab>('chat');
  showMobileNav = atom<boolean>(false);

  constructor() {
    if (import.meta.hot) {
      import.meta.hot.data.activeTab = this.activeTab;
    }
  }

  setActiveTab(tab: MobileNavTab) {
    this.activeTab.set(tab);
  }

  getActiveTab() {
    return this.activeTab.get();
  }

  setShowMobileNav(show: boolean) {
    this.showMobileNav.set(show);
  }
}

export const mobileNavStore = new MobileNavStore();
