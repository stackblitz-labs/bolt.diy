import type { ActionFunctionArgs } from '@remix-run/cloudflare';
import { json } from '@remix-run/cloudflare';
import { verifyToken } from '~/lib/utils/crypto';
import { logSecurityEvent } from '~/lib/utils/fileUserStorage';

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    // Get token from Authorization header
    const authHeader = request.headers.get('Authorization');

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = verifyToken(token);

      if (payload) {
        // Log logout event
        await logSecurityEvent({
          timestamp: new Date().toISOString(),
          userId: payload.userId,
          username: payload.username,
          action: 'logout',
          details: 'User logged out',
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        });
      }
    }

    return json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
