import { atom } from 'nanostores';
import { chatStore } from './chat';

export class SidebarMenuStore {
  isOpen = atom<boolean>(false);

  constructor() {
    if (import.meta.hot) {
      import.meta.hot.data.isOpen = this.isOpen;
    }

    // Initialize sidebar state: open on homepage (no appId), closed when chat starts
    if (typeof window !== 'undefined') {
      // Check if we're on homepage (no appId in URL)
      const isHomepage = !window.location.pathname.startsWith('/app/');
      const hasMessages = chatStore.messages.get().length > 0;

      // Open on homepage if no messages yet, closed if chat has started
      this.isOpen.set(isHomepage && !hasMessages);

      // Watch for navigation changes
      const checkPath = () => {
        const isHomepageNow = !window.location.pathname.startsWith('/app/');
        const hasMessagesNow = chatStore.messages.get().length > 0;

        // Open on homepage if no messages, close if navigating to app page
        if (isHomepageNow && !hasMessagesNow) {
          this.isOpen.set(true);
        } else if (!isHomepageNow) {
          this.isOpen.set(false);
        }
      };

      // Listen for popstate (back/forward navigation)
      window.addEventListener('popstate', checkPath);
    }

    // Watch for chat starting
    chatStore.messages.subscribe((messages) => {
      // Close sidebar when first message is sent
      if (messages.length > 0 && this.isOpen.get()) {
        this.isOpen.set(false);
      }
    });
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
