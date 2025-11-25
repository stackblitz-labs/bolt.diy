import { atom } from 'nanostores';

export interface DesignPanelHandlers {
  onSave?: () => void;
  onDiscard?: () => void;
  isSaving?: boolean;
}

export const designPanelStore = {
  isVisible: atom(false),
  handlers: atom<DesignPanelHandlers>({}),
};
