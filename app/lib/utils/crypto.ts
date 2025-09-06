import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Use a secure secret key (in production, this should be an environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'bolt-multi-user-secret-key-2024-secure';
const SALT_ROUNDS = 10;

export interface JWTPayload {
  userId: string;
  username: string;
  firstName: string;
  exp?: number;
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a JWT token
 */
export function generateToken(payload: Omit<JWTPayload, 'exp'>): string {
  return jwt.sign(
    {
      ...payload,
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days
    },
    JWT_SECRET,
  );
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

/**
 * Generate a secure user ID
 */
export function generateUserId(): string {
  return `user_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
