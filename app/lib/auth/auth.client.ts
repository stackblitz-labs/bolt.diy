/**
 * Better Auth React client
 *
 * Provides client-side authentication hooks and methods for React components.
 * Used for sign-in, sign-out, and session state management.
 *
 * Based on specs/002-better-auth/research.md
 */

import { createAuthClient } from 'better-auth/react';

/**
 * Better Auth client instance for React
 */
export const authClient = createAuthClient({
  baseURL: typeof window !== 'undefined' ? window.location.origin : '',
});

/**
 * Export commonly used auth methods and hooks
 */
export const { signIn, signOut, useSession } = authClient;

/**
 * Session Management Utilities (FR-010)
 *
 * Better Auth provides built-in endpoints for session management:
 * - GET /api/auth/list-sessions - Lists all active sessions for the current user
 * - POST /api/auth/revoke-session - Revokes a specific session by session ID
 *
 * These endpoints are automatically handled by the catch-all route handler
 * in app/routes/api.auth.$.ts. Use fetch() to call these endpoints directly
 * when implementing session management UI.
 *
 * Example:
 * ```typescript
 * // List sessions
 * const response = await fetch('/api/auth/list-sessions');
 * const sessions = await response.json();
 *
 * // Revoke a session
 * await fetch('/api/auth/revoke-session', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({ sessionId: 'session-id-to-revoke' }),
 * });
 * ```
 */
