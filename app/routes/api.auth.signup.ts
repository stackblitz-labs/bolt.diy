import type { ActionFunctionArgs } from '@remix-run/cloudflare';
import { json } from '@remix-run/cloudflare';
import { createUser, getUserByUsername, logSecurityEvent } from '~/lib/utils/fileUserStorage';
import { validatePassword, generateToken } from '~/lib/utils/crypto';

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const body = (await request.json()) as {
      username?: string;
      password?: string;
      firstName?: string;
      avatar?: string;
    };
    const { username, password, firstName, avatar } = body;

    // Validate required fields
    if (!username || !password || !firstName) {
      return json({ error: 'Username, password, and first name are required' }, { status: 400 });
    }

    // Validate username format
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return json(
        {
          error: 'Username must be 3-20 characters and contain only letters, numbers, and underscores',
        },
        { status: 400 },
      );
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);

    if (!passwordValidation.valid) {
      return json({ error: passwordValidation.errors.join('. ') }, { status: 400 });
    }

    // Check if username already exists
    const existingUser = await getUserByUsername(username);

    if (existingUser) {
      return json({ error: 'Username already exists' }, { status: 400 });
    }

    // Create new user
    const user = await createUser(username, password, firstName, avatar);

    if (!user) {
      return json({ error: 'Failed to create user' }, { status: 500 });
    }

    // Generate JWT token
    const token = generateToken({
      userId: user.id,
      username: user.username,
      firstName: user.firstName,
    });

    // Log successful signup
    await logSecurityEvent({
      timestamp: new Date().toISOString(),
      userId: user.id,
      username: user.username,
      action: 'signup',
      details: 'New user registration',
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
    console.error('Signup error:', error);

    await logSecurityEvent({
      timestamp: new Date().toISOString(),
      action: 'error',
      details: `Signup error: ${error}`,
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
    });

    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
