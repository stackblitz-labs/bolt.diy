import type { ActionFunctionArgs } from '@remix-run/cloudflare';
import { json } from '@remix-run/cloudflare';
import { verifyToken } from '~/lib/utils/crypto';
import { getUserById } from '~/lib/utils/fileUserStorage';

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    // Get token from Authorization header
    const authHeader = request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return json({ error: 'No token provided' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);

    if (!payload) {
      return json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get user from storage
    const user = await getUserById(payload.userId);

    if (!user) {
      return json({ error: 'User not found' }, { status: 404 });
    }

    // Return user data without password
    const { passwordHash, ...userWithoutPassword } = user;

    return json({
      success: true,
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error('Token verification error:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
