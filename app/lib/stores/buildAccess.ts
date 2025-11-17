import { atom } from 'nanostores';
import type { Subscription } from '~/lib/stripe/client';

export const buildAccessStore = {
  // Whether user has any active subscription
  hasAccess: atom<boolean>(false),

  // Track if we've loaded access data (to distinguish null = "not loaded" vs null = "no access")
  isLoaded: atom<boolean>(false),

  // Helper methods
  setAccess(subscription: Subscription, listLength: number) {
    this.hasAccess.set(subscription?.tier === 'builder' || listLength <= 1);
    this.isLoaded.set(true);
  },

  clearAccess() {
    this.hasAccess.set(false);
    this.isLoaded.set(false);
  },
};
