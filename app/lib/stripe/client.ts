import { loadStripe } from '@stripe/stripe-js';
import { getCurrentAccessToken } from '~/lib/supabase/client';

// Initialize Stripe with your publishable key (lazy loading)
let stripePromise: Promise<any> | null = null;

const getStripeKey = () => {
  if (typeof window === 'undefined') {
    return '';
  }

  const key = (window as any).ENV?.STRIPE_PUBLISHABLE_KEY;
  console.log('Stripe key from ENV:', key ? `${key.substring(0, 8)}...` : 'undefined');
  return key || '';
};

const initializeStripe = () => {
  if (!stripePromise) {
    const key = getStripeKey();
    if (!key) {
      console.error('Stripe publishable key not found in window.ENV');
      return Promise.resolve(null);
    }
    stripePromise = loadStripe(key);
  }
  return stripePromise;
};

export interface CreateCheckoutSessionParams {
  type: 'subscription' | 'topoff';
  tier?: 'free' | 'builder';
  returnUrl?: string; // Optional return URL to redirect to after checkout
}

export interface CheckoutSessionResponse {
  sessionId: string;
  url: string;
}

/**
 * Creates a Stripe checkout session and redirects the user
 */
export async function createCheckoutSession(params: CreateCheckoutSessionParams): Promise<void> {
  try {
    const accessToken = await getCurrentAccessToken();
    // Create checkout session via API
    const response = await fetch('/api/stripe/create-checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create checkout session');
    }

    const { url }: CheckoutSessionResponse = await response.json();
    if (!url) {
      throw new Error('No checkout URL received');
    }

    // Redirect to Stripe Checkout
    window.location.href = url;
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw error;
  }
}

/**
 * Create subscription checkout for a specific tier
 * User info is automatically extracted from JWT token
 */
export async function createSubscriptionCheckout(tier: 'free' | 'builder'): Promise<void> {
  return createCheckoutSession({
    type: 'subscription',
    tier,
    returnUrl: encodeURIComponent(window.location.href), // Return to current page after checkout, URL-encoded
  });
}

/**
 * Create peanut top-off checkout
 * User info is automatically extracted from JWT token
 */
export async function createTopoffCheckout(): Promise<void> {
  return createCheckoutSession({
    type: 'topoff',
    returnUrl: encodeURIComponent(window.location.href), // Return to current page after checkout, URL-encoded
  });
}

/**
 * Get Stripe instance for advanced usage
 */
export async function getStripe() {
  return await initializeStripe();
}

// Subscription tier information
export const SUBSCRIPTION_TIERS = {
  free: {
    name: 'Free',
    price: 0,
    peanuts: 500,
    description: 'Our free tier to get you started.',
    features: ['500 Peanuts per month'],
  },
  builder: {
    name: 'Builder',
    price: 20,
    peanuts: 2000,
    description: 'No limits on any features. Go nuts!',
    features: ['2000 Peanuts per month (rolls over)', 'Pay-as-you-go to top off balance'],
  },
} as const;

export type SubscriptionTier = keyof typeof SUBSCRIPTION_TIERS;

export interface Subscription {
  id: string;
  status: string;
  tier: SubscriptionTier;
  peanuts: number;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface StripeStatus {
  hasSubscription: boolean;
  subscription: Subscription | null;
}

/**
 * Check subscription status directly from Stripe
 */
export async function checkSubscriptionStatus() {
  try {
    const accessToken = await getCurrentAccessToken();
    const response = await fetch('/api/stripe/manage-subscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        action: 'get_status',
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to check subscription status');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error checking subscription status:', error);
    return { hasSubscription: false, subscription: null };
  }
}

/**
 * Cancel subscription
 */
export async function cancelSubscription(immediate: boolean = false) {
  try {
    const accessToken = await getCurrentAccessToken();
    const response = await fetch('/api/stripe/manage-subscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        action: 'cancel',
        immediate,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to cancel subscription');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error canceling subscription:', error);
    throw error;
  }
}

export async function manageBilling() {
  try {
    const accessToken = await getCurrentAccessToken();
    const response = await fetch('/api/stripe/manage-subscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        action: 'manage-billing',
        returnUrl: encodeURIComponent(window.location.href),
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to manage billing');
    }

    const data = await response.json();

    // If we got a portal URL, open it in a new tab
    if (data.success && data.url) {
      window.open(data.url, '_self', 'noopener,noreferrer');
      return; // Successfully opened portal
    }

    return data;
  } catch (error) {
    console.error('Error managing subscription:', error);
    throw error;
  }
}

export async function manageSubscription() {
  try {
    const accessToken = await getCurrentAccessToken();
    const response = await fetch('/api/stripe/manage-subscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        action: 'manage-subscription',
        returnUrl: encodeURIComponent(window.location.href),
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to manage subscription');
    }

    const data = await response.json();

    // If we got a portal URL, open it in a new tab
    if (data.success && data.url) {
      window.open(data.url, '_self', 'noopener,noreferrer');
      return; // Successfully opened portal
    }

    return data;
  } catch (error) {
    console.error('Error managing subscription:', error);
    throw error;
  }
}
