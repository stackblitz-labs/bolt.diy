import { atom } from 'nanostores';

type TabType = 'account' | 'billing' | null;

export const accountModalStore = {
  isOpen: atom<boolean>(false),
  activeTab: atom<TabType>('account'),

  open(tab: TabType = 'account') {
    this.isOpen.set(true);
    this.activeTab.set(tab);
  },

  close() {
    this.isOpen.set(false);
  },

  toggle() {
    this.isOpen.set(!this.isOpen.get());
  },
};
