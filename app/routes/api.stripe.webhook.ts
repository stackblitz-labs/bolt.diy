import Stripe from 'stripe';
import { callNutAPI } from '~/lib/replay/NutAPI';
import { Analytics } from '@segment/analytics-node';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-07-30.basil',
});

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;
const TOPOFF_PEANUTS = 2000;

// Initialize Segment Analytics
const analytics = new Analytics({
  writeKey: process.env.SEGMENT_WRITE_KEY!,
  flushAt: 1, // Flush immediately for webhooks
  flushInterval: 1000, // Flush every second
});

const PLAN_MAPPING = {
  [process.env.STRIPE_PRICE_FREE!]: { name: 'Free', price: 0, peanuts: 500 },
  [process.env.STRIPE_PRICE_STARTER!]: { name: 'Builder', price: 20, peanuts: 2000 },
  [process.env.STRIPE_PRICE_PRO!]: { name: 'Pro', price: 120, peanuts: 12000 },
} as const;

async function getUserIdFromCustomer(customerId: string): Promise<string | null> {
  try {
    const customer = await stripe.customers.retrieve(customerId);

    if (!customer || customer.deleted) {
      console.error('❌ Customer not found or deleted:', customerId);
      return null;
    }

    let userId = customer.metadata?.userId;

    if (!userId && customer.email) {
      const customersWithEmail = await stripe.customers.list({
        email: customer.email,
        limit: 25,
      });

      const customerWithUserId = customersWithEmail.data
        .filter((c) => c.metadata?.userId)
        .sort((a, b) => b.created - a.created)[0];

      if (customerWithUserId) {
        userId = customerWithUserId.metadata.userId;
        const userEmail = customerWithUserId.metadata.userEmail || customer.email;

        await stripe.customers.update(customerId, {
          metadata: {
            ...customer.metadata,
            userId,
            userEmail,
            lastUpdated: new Date().toISOString(),
            source: 'webhook-consolidation',
          },
        });
      } else {
        console.error(`❌ Could not find userId for customer ${customerId} with email ${customer.email}`);
        console.error(
          `Available customers for email:`,
          customersWithEmail.data.map((c) => ({
            id: c.id,
            created: c.created,
            metadata: c.metadata,
          })),
        );
      }
    }

    return userId || null;
  } catch (error) {
    console.error('❌ Error getting userId from customer:', error);
    return null;
  }
}

function getPeanutsFromPriceId(priceId: string): number {
  return PLAN_MAPPING[priceId]?.peanuts || 0;
}

function getPlanNameFromPriceId(priceId: string): string {
  return PLAN_MAPPING[priceId]?.name || 'Unknown';
}

function getPlanPriceFromPriceId(priceId: string): number {
  return PLAN_MAPPING[priceId]?.price || 0;
}

export async function action({ request }: { request: Request }) {
  if (request.method !== 'POST') {
    console.error('❌ Method not allowed:', request.method);
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    console.error('❌ No Stripe signature found in headers');
    return new Response(JSON.stringify({ error: 'No signature' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!WEBHOOK_SECRET) {
    console.error('❌ STRIPE_WEBHOOK_SECRET environment variable not set');
    return new Response(JSON.stringify({ error: 'Webhook secret not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let event: Stripe.Event;

  try {
    if (process.env.NODE_ENV === 'development' && !WEBHOOK_SECRET) {
      console.log('⚠️ DEVELOPMENT MODE: Skipping webhook signature verification');
      event = JSON.parse(body);
    } else {
      event = stripe.webhooks.constructEvent(body, signature, WEBHOOK_SECRET);
      console.log('✅ Webhook signature verified successfully');
    }
  } catch (error) {
    console.error('❌ Webhook signature verification failed:', error);
    console.error('Signature received:', signature);
    console.error('Body preview:', body.substring(0, 200) + '...');
    return new Response(JSON.stringify({ error: 'Invalid signature' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    switch (event.type) {
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentSucceeded(invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice);
        break;
      }

      case 'checkout.session.completed': {
        const checkoutSession = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(checkoutSession);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`, event);
    }

    // Ensure all analytics events are flushed before responding
    try {
      await analytics.closeAndFlush();
      console.log('✅ Analytics events flushed successfully');
    } catch (flushError) {
      console.error('❌ Failed to flush analytics events:', flushError);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(JSON.stringify({ error: 'Webhook processing failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function handleCheckoutCompleted(checkoutSession: Stripe.Checkout.Session) {
  try {
    const userId = checkoutSession.metadata?.userId;
    const type = checkoutSession.metadata?.type;
    if (!userId) {
      console.error('No userId found in checkout session metadata');
      return;
    }
    if (!type) {
      console.error('No type found in checkout session metadata');
      return;
    }

    if (type === 'topoff') {
      await callNutAPI(
        'add-peanuts',
        {
          userId,
          peanuts: TOPOFF_PEANUTS,
        },
        undefined,
        userId,
      );

      analytics.track({
        userId,
        event: 'Peanut Purchase Completed',
        properties: {
          peanutsPurchased: TOPOFF_PEANUTS,
          purchaseType: 'topoff',
          timestamp: new Date().toISOString(),
        },
      });
    }
  } catch (error) {
    console.error('Error handling checkout completed:', error);
  }
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  try {
    const userId = await getUserIdFromCustomer(invoice.customer as string);
    if (!userId) {
      console.error(`No userId found for customer ${invoice.customer} in invoice ${invoice.id}`);
      return;
    }

    const priceId = invoice.lines.data[0]?.pricing?.price_details?.price;

    if (!priceId) {
      console.error('No price ID found in invoice lines for invoice:', invoice.id);
      return;
    }

    const peanuts = getPeanutsFromPriceId(priceId);

    if (peanuts === 0) {
      console.error(`❌ Unknown price ID for ${invoice.billing_reason}: ${priceId}`);
      return;
    }

    await callNutAPI(
      'add-peanuts',
      {
        userId,
        peanuts,
      },
      undefined,
      userId,
    );

    const planName = getPlanNameFromPriceId(priceId);
    const planPrice = getPlanPriceFromPriceId(priceId);

    analytics.track({
      userId,
      event: 'Subscription Completed',
      properties: {
        planName,
        planPrice,
        peanutsIncluded: peanuts,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error handling payment success:', error);
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  try {
    const userId = await getUserIdFromCustomer(invoice.customer as string);
    if (!userId) {
      return;
    }

    console.log(`❌ Payment failed for user ${userId}, invoice: ${invoice.id}`);
  } catch (error) {
    console.error('Error handling payment failure:', error);
  }
}
