import { atom } from 'nanostores';

export const elementPickerStore = {
  isEnabled: atom(false),
  isReady: atom(false),
};

// Helper functions for easier access
export const setIsElementPickerEnabled = (enabled: boolean) => {
  elementPickerStore.isEnabled.set(enabled);
};

export const setIsElementPickerReady = (ready: boolean) => {
  elementPickerStore.isReady.set(ready);
};
