import type { ActionFunctionArgs } from '@remix-run/cloudflare';
import { json } from '@remix-run/cloudflare';
import { verifyToken } from '~/lib/utils/crypto';
import { deleteUser } from '~/lib/utils/fileUserStorage';

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    const { id } = params;

    if (!id) {
      return json({ error: 'User ID is required' }, { status: 400 });
    }

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

    // Prevent users from deleting themselves
    if (payload.userId === id) {
      return json({ error: 'Cannot delete your own account' }, { status: 400 });
    }

    if (request.method === 'DELETE') {
      // Delete the user
      const success = await deleteUser(id);

      if (success) {
        return json({ success: true });
      } else {
        return json({ error: 'User not found' }, { status: 404 });
      }
    }

    return json({ error: 'Method not allowed' }, { status: 405 });
  } catch (error) {
    console.error('User operation error:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
