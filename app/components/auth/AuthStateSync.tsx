/**
 * Auth State Sync Component
 *
 * Synchronizes Better Auth session state to the global auth store.
 * This allows synchronous auth checks without reading HttpOnly cookies.
 *
 * Must be mounted at app root level to ensure auth state is always current.
 */

import { useEffect } from 'react';
import { useSession } from '~/lib/auth/auth.client';
import { setAuthState } from '~/lib/stores/auth';

export function AuthStateSync() {
  const { data: session } = useSession();

  useEffect(() => {
    setAuthState(!!session?.user, session?.user?.id ?? null);
  }, [session]);

  return null; // This component only syncs state
}
