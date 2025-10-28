import { json } from '~/lib/remix-types';
import type { ActionFunction } from '~/lib/remix-types';

export const action: ActionFunction = async ({ request }: { request: Request }) => {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  if (!process.env.INTERCOM_ACCESS_TOKEN) {
    console.error('Intercom access token is not configured');
    return json({ error: 'Intercom configuration missing' }, { status: 500 });
  }

  let email;
  try {
    const body = await request.json();
    email = body.email;

    if (!email || typeof email !== 'string') {
      return json({ error: 'Valid email is required' }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(email)) {
      return json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Prevent email injection attacks by limiting length
    if (email.length > 254) {
      return json({ error: 'Email too long' }, { status: 400 });
    }
  } catch (error) {
    console.error('Invalid request body', error);
    return json({ error: 'Invalid request body' }, { status: 400 });
  }

  try {
    const response = await fetch('https://api.intercom.io/contacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Intercom-Version': '2.10',
        Authorization: `Bearer ${process.env.INTERCOM_ACCESS_TOKEN}`,
        Accept: 'application/json',
      },
      body: JSON.stringify({
        email,
        signed_up_at: Math.floor(Date.now() / 1000),
        created_at: Math.floor(Date.now() / 1000),
        last_seen_at: Math.floor(Date.now() / 1000),
      }),
    });

    const responseData = await response.json();

    if (!response.ok) {
      // Log error without exposing sensitive response data
      console.error('Intercom API error:', {
        status: response.status,
        statusText: response.statusText,
      });

      // Don't expose internal API response details to client
      return json({ error: 'Failed to create contact' }, { status: 500 });
    }

    return json({ success: true, data: responseData });
  } catch (error) {
    // Log error without sensitive details
    console.error('Failed to contact Intercom API', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};
