import { json } from '~/lib/remix-types';
import type { ActionFunction, LoaderFunction } from '~/lib/remix-types';
import { generateIntercomJWT } from '~/lib/intercom';
import { createClient } from '@supabase/supabase-js';

// 🔒 SECURITY: Get user from Authorization header if present
async function getAuthenticatedUser(request: Request) {
  // Try to get from Authorization header first (for API calls)
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (!error && user) {
      return user;
    }
  }

  // If no valid token, return null (endpoint will return empty response)
  return null;
}

export const loader: LoaderFunction = async ({ request }) => {
  if (request.method !== 'GET') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  // 🔒 SECURITY: Try to get authenticated user
  const user = await getAuthenticatedUser(request);

  // If no user, return empty response (Intercom simply won't load)
  if (!user) {
    return json({ jwt: null });
  }

  if (!process.env.INTERCOM_APP_SECRET || !process.env.INTERCOM_APP_ID || !process.env.INTERCOM_SIGNING_KEY) {
    console.error('Intercom environment variables not configured');
    // Return empty JWT so Intercom simply doesn't load
    return json({ jwt: null });
  }

  try {
    // Use the authenticated user's data (prevent spoofing)
    const jwtResponse = await generateIntercomJWT(
      {
        user_id: user.id,
        email: user.email || undefined,
        name: user.user_metadata?.name || user.email || undefined,
      },
      process.env.INTERCOM_APP_SECRET!,
      process.env.INTERCOM_APP_ID!,
      process.env.INTERCOM_SIGNING_KEY!,
      1, // 1 hour expiration
    );

    return json(jwtResponse);
  } catch (error) {
    console.error('Failed to generate Intercom JWT:', error);
    // Return empty JWT on error instead of throwing 500
    return json({ jwt: null });
  }
};

export const action: ActionFunction = async ({ request }) => {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  // 🔒 SECURITY: Try to get authenticated user
  const user = await getAuthenticatedUser(request);

  // If no user, return empty response
  if (!user) {
    return json({ jwt: null });
  }

  if (!process.env.INTERCOM_APP_SECRET || !process.env.INTERCOM_APP_ID || !process.env.INTERCOM_SIGNING_KEY) {
    console.error('Intercom environment variables not configured');
    // Return empty JWT so Intercom simply doesn't load
    return json({ jwt: null });
  }

  try {
    // Use the authenticated user's data (prevent spoofing)
    const jwtResponse = await generateIntercomJWT(
      {
        user_id: user.id,
        email: user.email || undefined,
        name: user.user_metadata?.name || user.email || undefined,
      },
      process.env.INTERCOM_APP_SECRET!,
      process.env.INTERCOM_APP_ID!,
      process.env.INTERCOM_SIGNING_KEY!,
      1, // 1 hour expiration
    );

    return json(jwtResponse);
  } catch (error) {
    console.error('Failed to generate Intercom JWT:', error);
    // Return empty JWT on error instead of throwing 500
    return json({ jwt: null });
  }
};
