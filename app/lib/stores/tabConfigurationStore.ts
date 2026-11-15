import { create } from 'zustand';

export interface TabConfig {
  id: string;
  visible: boolean;
  window: 'developer' | 'user';
  order: number;
  locked?: boolean;
}

interface TabConfigurationStore {
  userTabs: TabConfig[];
  get: () => { userTabs: TabConfig[] };
  set: (config: { userTabs: TabConfig[] }) => void;
  reset: () => void;
}

const DEFAULT_CONFIG = {
  userTabs: [],
};

export const tabConfigurationStore = create<TabConfigurationStore>((set, get) => ({
  ...DEFAULT_CONFIG,
  get: () => ({
    userTabs: get().userTabs,
  }),
  set: (config) => set(config),
  reset: () => set(DEFAULT_CONFIG),
}));
