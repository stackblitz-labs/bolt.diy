// import type { ActionFunctionArgs } from '@remix-run/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-07-30.basil',
});

// Product and Price mappings from environment variables
const SUBSCRIPTION_PRICES = {
  free: process.env.STRIPE_PRICE_FREE!,
  builder: process.env.STRIPE_PRICE_STARTER!,
  pro: process.env.STRIPE_PRICE_PRO!,
} as const;

const PEANUT_TOPOFF_PRICE = process.env.STRIPE_PRICE_TOPOFF!;

interface CreateCheckoutRequest {
  type: 'subscription' | 'topoff';
  tier?: 'free' | 'builder';
  returnUrl?: string; // The current page URL to return to after checkout
}

// Helper function to get authenticated user from JWT
async function getAuthenticatedUser(request: Request) {
  // Get the authorization header
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return null;
  }

  return user;
}

export async function action({ request }: { request: Request }) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 🔒 SECURITY: Authenticate the user via JWT
  const user = await getAuthenticatedUser(request);
  if (!user || !user.email) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const userId = user.id;
  const userEmail = user.email;

  try {
    const body = (await request.json()) as CreateCheckoutRequest;
    const { type, tier, returnUrl } = body;

    let priceId: string;
    let mode: 'subscription' | 'payment';
    let successUrl: string;
    let cancelUrl: string;

    const baseUrl = new URL(request.url).origin;
    // Use the provided return URL (decode it first if provided) or fallback to the base URL
    const targetUrl = returnUrl ? decodeURIComponent(returnUrl) : baseUrl;

    // Try to find existing customer by email or userId to avoid duplicates
    let customerId: string | undefined;
    try {
      // First try to find customer by email
      const existingCustomers = await stripe.customers.list({
        email: userEmail,
        limit: 10, // Get more results to check metadata
      });

      // Look for a customer with matching userId or use the first one
      let targetCustomer = existingCustomers.data.find((c) => c.metadata?.userId === userId);
      if (!targetCustomer && existingCustomers.data.length > 0) {
        targetCustomer = existingCustomers.data[0];
      }

      if (targetCustomer) {
        customerId = targetCustomer.id;

        // Always update customer metadata with userId to ensure webhooks work
        // This makes Stripe the authoritative source for user identification
        await stripe.customers.update(customerId, {
          metadata: {
            userId,
            userEmail,
          },
        });
      } else {
        // Create customer explicitly with metadata
        const newCustomer = await stripe.customers.create({
          email: userEmail,
          metadata: {
            userId,
            userEmail,
          },
        });
        customerId = newCustomer.id;
      }
    } catch (error) {
      console.error('Error checking for existing customer:', error);
    }

    // Ensure we have a customer ID
    if (!customerId) {
      throw new Error('Failed to create or find customer');
    }

    if (type === 'subscription') {
      if (!tier || !SUBSCRIPTION_PRICES[tier]) {
        return new Response(JSON.stringify({ error: 'Valid subscription tier is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      priceId = SUBSCRIPTION_PRICES[tier];
      mode = 'subscription';

      // Construct URLs with proper query parameter handling
      const successUrlObj = new URL(targetUrl);
      successUrlObj.searchParams.set('stripe_success', 'subscription');
      successUrlObj.searchParams.set('tier', tier);
      successUrl = successUrlObj.toString();

      const cancelUrlObj = new URL(targetUrl);
      cancelUrlObj.searchParams.set('stripe_canceled', 'subscription');
      cancelUrl = cancelUrlObj.toString();
    } else if (type === 'topoff') {
      priceId = PEANUT_TOPOFF_PRICE;
      mode = 'payment';

      // Construct URLs with proper query parameter handling
      const successUrlObj = new URL(targetUrl);
      successUrlObj.searchParams.set('stripe_success', 'topoff');
      successUrl = successUrlObj.toString();

      const cancelUrlObj = new URL(targetUrl);
      cancelUrlObj.searchParams.set('stripe_canceled', 'topoff');
      cancelUrl = cancelUrlObj.toString();
    } else {
      return new Response(JSON.stringify({ error: 'Invalid checkout type' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      allow_promotion_codes: true,
      // Always use customer ID (we ensure one exists above)
      customer: customerId,
      client_reference_id: userId,
      metadata: {
        userId,
        userEmail,
        type,
        ...(tier && { tier }),
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      billing_address_collection: 'auto',
      automatic_tax: {
        enabled: true,
      },
      customer_update: {
        address: 'auto',
        name: 'auto',
      },
    });

    // Customer is guaranteed to exist with metadata at this point

    return new Response(
      JSON.stringify({
        sessionId: session.id,
        url: session.url,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('Error creating Stripe checkout session:', error);
    return new Response(JSON.stringify({ error: 'Failed to create checkout session' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
