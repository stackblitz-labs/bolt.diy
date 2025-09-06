import type { LoaderFunctionArgs } from '@remix-run/cloudflare';
import { json } from '@remix-run/cloudflare';
import { verifyToken } from '~/lib/utils/crypto';
import { getAllUsers } from '~/lib/utils/fileUserStorage';

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);

    if (!payload) {
      return json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get all users (without passwords)
    const users = await getAllUsers();

    return json({ users });
  } catch (error) {
    console.error('Failed to fetch users:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
