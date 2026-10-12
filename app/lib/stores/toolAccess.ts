import { create } from 'zustand';

export type ToolAccessMode = 'full-access' | 'ask-for-all';

const TOOL_ACCESS_MODE_KEY = 'tool_access_mode';

function getInitialMode(): ToolAccessMode {
  if (typeof window === 'undefined') {
    return 'ask-for-all';
  }

  return window.localStorage.getItem(TOOL_ACCESS_MODE_KEY) === 'full-access' ? 'full-access' : 'ask-for-all';
}

type ToolAccessStore = {
  mode: ToolAccessMode;
  setMode: (mode: ToolAccessMode) => void;
};

export const useToolAccessStore = create<ToolAccessStore>((set) => ({
  mode: getInitialMode(),
  setMode: (mode) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(TOOL_ACCESS_MODE_KEY, mode);
    }

    set({ mode });
  },
}));
