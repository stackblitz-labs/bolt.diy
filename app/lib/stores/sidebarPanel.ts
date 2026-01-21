import { atom } from 'nanostores';

export type SidebarPanel = 'chat' | 'design' | 'settings' | 'history' | null;

export class SidebarPanelStore {
  activePanel = atom<SidebarPanel>('chat');

  constructor() {
    if (import.meta.hot) {
      import.meta.hot.data.activePanel = this.activePanel;
    }
  }

  setActivePanel(panel: SidebarPanel) {
    this.activePanel.set(panel);
  }

  togglePanel(panel: SidebarPanel) {
    const current = this.activePanel.get();
    if (current === panel) {
      // If clicking the same panel, keep it open (or close if desired)
      // For now, we'll keep it open since we always want a panel visible
      return;
    }
    this.activePanel.set(panel);
  }

  isActive(panel: SidebarPanel): boolean {
    return this.activePanel.get() === panel;
  }
}

export const sidebarPanelStore = new SidebarPanelStore();
