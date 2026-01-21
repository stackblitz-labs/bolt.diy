import { atom } from 'nanostores';

export class SidebarMenuStore {
  isOpen = atom<boolean>(true);

  constructor() {
    if (import.meta.hot) {
      import.meta.hot.data.isOpen = this.isOpen;
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
}

export const sidebarMenuStore = new SidebarMenuStore();
