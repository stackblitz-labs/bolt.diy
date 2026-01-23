import { atom } from 'nanostores';

// Check if we're on mobile (viewport width < 800px) on initialization
const isMobileOnInit = typeof window !== 'undefined' && window.innerWidth < 800;

export class SidebarMenuStore {
  isOpen = atom<boolean>(!isMobileOnInit);
  isCollapsed = atom<boolean>(false);

  constructor() {
    if (import.meta.hot) {
      import.meta.hot.data.isOpen = this.isOpen;
      import.meta.hot.data.isCollapsed = this.isCollapsed;
    }
  }

  setOpen(open: boolean) {
    this.isOpen.set(open);
  }

  toggle() {
    this.isOpen.set(!this.isOpen.get());
  }

  open() {
    this.isOpen.set(true);
  }

  close() {
    this.isOpen.set(false);
  }

  setCollapsed(collapsed: boolean) {
    this.isCollapsed.set(collapsed);
  }

  toggleCollapsed() {
    this.isCollapsed.set(!this.isCollapsed.get());
  }
}

export const sidebarMenuStore = new SidebarMenuStore();
