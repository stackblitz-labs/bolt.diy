import { atom } from 'nanostores';
import type { Subscription, StripeStatus } from '~/lib/stripe/client';

// Store for tracking subscription status
export const subscriptionStore = {
  // Whether user has any active subscription
  hasSubscription: atom<boolean>(false),

  // Current subscription tier, if any
  subscription: atom<Subscription | null>(null),

  // Helper methods
  setSubscription(stripeStatus: StripeStatus | null) {
    this.subscription.set(stripeStatus?.subscription ?? null);
    this.hasSubscription.set(stripeStatus?.hasSubscription ?? false);
  },

  clearSubscription() {
    this.subscription.set(null);
    this.hasSubscription.set(false);
  },
};
