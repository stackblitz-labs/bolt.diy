import type { ActionFunctionArgs } from '@remix-run/cloudflare';
import { json } from '@remix-run/cloudflare';
import { getUserByUsername, updateLastLogin, logSecurityEvent } from '~/lib/utils/fileUserStorage';
import { verifyPassword, generateToken } from '~/lib/utils/crypto';

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const body = (await request.json()) as { username?: string; password?: string };
    const { username, password } = body;

    if (!username || !password) {
      return json({ error: 'Username and password are required' }, { status: 400 });
    }

    // Get user from storage
    const user = await getUserByUsername(username);

    if (!user) {
      // Log failed login attempt
      await logSecurityEvent({
        timestamp: new Date().toISOString(),
        username,
        action: 'failed_login',
        details: `Failed login attempt for non-existent user: ${username}`,
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      });

      return json({ error: 'Invalid username or password' }, { status: 401 });
    }

    // Verify password
    const isValid = await verifyPassword(password, user.passwordHash);

    if (!isValid) {
      // Log failed login attempt
      await logSecurityEvent({
        timestamp: new Date().toISOString(),
        userId: user.id,
        username: user.username,
        action: 'failed_login',
        details: `Failed login attempt with incorrect password`,
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      });

      return json({ error: 'Invalid username or password' }, { status: 401 });
    }

    // Update last login time
    await updateLastLogin(user.id);

    // Generate JWT token
    const token = generateToken({
      userId: user.id,
      username: user.username,
      firstName: user.firstName,
    });

    // Log successful login
    await logSecurityEvent({
      timestamp: new Date().toISOString(),
      userId: user.id,
      username: user.username,
      action: 'login',
      details: 'Successful login',
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
    });

    // Return user data without password
    const { passwordHash, ...userWithoutPassword } = user;

    return json({
      success: true,
      user: userWithoutPassword,
      token,
    });
  } catch (error) {
    console.error('Login error:', error);

    await logSecurityEvent({
      timestamp: new Date().toISOString(),
      action: 'error',
      details: `Login error: ${error}`,
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
    });

    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
