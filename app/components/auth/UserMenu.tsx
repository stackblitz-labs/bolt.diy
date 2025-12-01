/**
 * User Menu Component
 *
 * Displays authenticated user information and sign-out button.
 * Uses Better Auth's useSession hook for reactive session state.
 *
 * Based on specs/002-better-auth/tasks.md (T014)
 */

import { useSession, signOut } from '~/lib/auth/auth.client';
import { useNavigate } from '@remix-run/react';

/**
 * User Menu Component
 *
 * Shows user avatar, name, and sign-out option when authenticated.
 * Shows sign-in link when not authenticated.
 */
export function UserMenu() {
  const { data: session, isPending } = useSession();
  const navigate = useNavigate();

  // Loading state
  if (isPending) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200" />
        <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
      </div>
    );
  }

  // Not authenticated
  if (!session) {
    return (
      <a
        href="/auth/login"
        className="text-sm font-medium text-gray-700 hover:text-gray-900"
      >
        Sign in
      </a>
    );
  }

  // Authenticated - show user info and sign-out
  const handleSignOut = async () => {
    await signOut({
      fetchOptions: {
        onSuccess: () => {
          navigate('/');
        },
      },
    });
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        {session.user.image && (
          <img
            src={session.user.image}
            alt={session.user.name || session.user.email || 'User'}
            className="h-8 w-8 rounded-full"
          />
        )}
        <span className="text-sm font-medium text-gray-700">
          {session.user.name || session.user.email}
        </span>
      </div>
      <button
        onClick={handleSignOut}
        className="text-sm text-gray-500 hover:text-gray-700"
        type="button"
      >
        Sign out
      </button>
    </div>
  );
}

