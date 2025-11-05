import { atom } from 'nanostores';
import type { Subscription, StripeStatus } from '~/lib/stripe/client';

// Store for tracking subscription status
export const subscriptionStore = {
  // Whether user has any active subscription
  hasSubscription: atom<boolean>(false),

  // Current subscription tier, if any
  subscription: atom<Subscription | null>(null),

  // Track if we've loaded subscription data (to distinguish null = "not loaded" vs null = "no subscription")
  isLoaded: atom<boolean>(false),

  // Helper methods
  setSubscription(stripeStatus: StripeStatus | null) {
    this.subscription.set(stripeStatus?.subscription ?? null);
    this.hasSubscription.set(stripeStatus?.hasSubscription ?? false);
    this.isLoaded.set(true);
  },

  clearSubscription() {
    this.subscription.set(null);
    this.hasSubscription.set(false);
    this.isLoaded.set(false);
  },
};
