/**
 * Auth Guard Component
 *
 * Client-side wrapper that checks session status and redirects to login
 * if session expires. Used for protecting client-side routes.
 *
 * Based on specs/002-better-auth/tasks.md (T021)
 */

import { useSession } from '~/lib/auth/auth.client';
import { useEffect } from 'react';
import { useNavigate } from '@remix-run/react';

interface AuthGuardProps {
  children: React.ReactNode;
  /**
   * Redirect to login if not authenticated
   */
  requireAuth?: boolean;
  /**
   * Fallback component to show while checking session
   */
  fallback?: React.ReactNode;
}

/**
 * Auth Guard Component
 *
 * Wraps children and handles client-side session validation.
 * Redirects to login if session expires and requireAuth is true.
 */
export function AuthGuard({
  children,
  requireAuth = true,
  fallback,
}: AuthGuardProps) {
  const { data: session, isPending } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isPending && requireAuth && !session) {
      const currentPath = window.location.pathname;
      navigate(`/auth/login?returnTo=${encodeURIComponent(currentPath)}`);
    }
  }, [session, isPending, requireAuth, navigate]);

  // Show fallback while loading
  if (isPending) {
    return <>{fallback || <div className="p-4">Loading...</div>}</>;
  }

  // If auth required but no session, don't render children
  // (redirect will happen in useEffect)
  if (requireAuth && !session) {
    return <>{fallback || null}</>;
  }

  return <>{children}</>;
}

