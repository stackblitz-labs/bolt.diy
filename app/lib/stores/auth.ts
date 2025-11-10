import { atom } from 'nanostores';
import { getSupabase } from '~/lib/supabase/client';
import { type User, type Session, AuthError } from '@supabase/supabase-js';
import { logStore } from './logs';
import { useEffect, useState } from 'react';
import { isAuthenticated } from '~/lib/supabase/client';
import { pingTelemetry } from '~/lib/hooks/pingTelemetry';
import { subscriptionStore } from './subscriptionStatus';

export const userStore = atom<User | null>(null);
export const sessionStore = atom<Session | null>(null);
export const isLoadingStore = atom<boolean>(true);

export const authStatusStore = {
  isLoggedIn: atom<boolean | null>(null),

  // Initialize auth status store
  init() {
    // subscribe to the userStore
    userStore.listen((user) => {
      this.isLoggedIn.set(!!user);
    });

    // Check initial auth state (now synchronous!)
    const authenticated = isAuthenticated();
    this.isLoggedIn.set(authenticated);
  },
};

export async function initializeAuth() {
  try {
    authStatusStore.init();

    isLoadingStore.set(true);

    // We've seen Supabase Auth hang when there are multiple tabs open.
    // Handle this by using a timeout to ensure we don't wait indefinitely.
    const timeoutPromise = new Promise<{ data: { session: Session | null }; error?: AuthError }>((resolve) => {
      setTimeout(() => {
        resolve({
          data: { session: null },
          error: new AuthError('Timed out initializing auth'),
        });
      }, 5000);
    });

    const authRes = await Promise.race([getSupabase().auth.getSession(), timeoutPromise]);

    // Get initial session
    const {
      data: { session },
      error,
    } = authRes;

    if (error) {
      pingTelemetry('Auth.Error', { message: error.message });
      throw error;
    }

    if (session) {
      userStore.set(session.user);
      sessionStore.set(session);
      logStore.logSystem('Auth initialized with existing session', {
        userId: session.user.id,
        email: session.user.email,
      });
    } else {
      // No session - user is not logged in (this is normal)
      userStore.set(null);
      sessionStore.set(null);
      logStore.logSystem('Auth initialized - no active session');
    }

    // Listen for auth changes
    const {
      data: { subscription },
    } = getSupabase().auth.onAuthStateChange(async (event, session) => {
      logStore.logSystem('Auth state changed', { event });

      // Handle token refresh errors - clear invalid sessions
      if (event === 'TOKEN_REFRESHED' && !session) {
        logStore.logSystem('Token refresh failed - clearing auth state');
        userStore.set(null);
        sessionStore.set(null);
        return;
      }

      if (session) {
        userStore.set(session.user);
        sessionStore.set(session);
        logStore.logSystem('User authenticated', {
          userId: session.user.id,
          email: session.user.email,
        });
      } else {
        userStore.set(null);
        sessionStore.set(null);
        subscriptionStore.clearSubscription();
        logStore.logSystem('User signed out');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  } catch (error) {
    logStore.logError('Failed to initialize auth', error);
    throw error;
  } finally {
    isLoadingStore.set(false);
  }
}

export async function signInWithEmail(email: string, password: string) {
  try {
    isLoadingStore.set(true);

    const { data, error } = await getSupabase().auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    logStore.logError('Failed to sign in', error);
    throw error;
  } finally {
    isLoadingStore.set(false);
  }
}

export async function signUp(email: string, password: string) {
  try {
    isLoadingStore.set(true);

    const { data, error } = await getSupabase().auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined,
      },
    });

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    logStore.logError('Failed to sign up', error);
    throw error;
  } finally {
    isLoadingStore.set(false);
  }
}

export async function updatePassword(newPassword: string) {
  try {
    isLoadingStore.set(true);

    const { error } = await getSupabase().auth.updateUser({
      password: newPassword,
    });

    if (error) {
      throw error;
    }
  } catch (error) {
    logStore.logError('Failed to update password', error);
    throw error;
  } finally {
    isLoadingStore.set(false);
  }
}

export async function signOut() {
  try {
    isLoadingStore.set(true);

    // Try to sign out from Supabase, but don't fail if there's no session
    try {
      const { error } = await getSupabase().auth.signOut();

      // Ignore session missing errors - just means user was already signed out
      if (error) {
        const isSessionMissingError =
          error.message?.includes('Auth session missing') ||
          error.message?.includes('session_missing') ||
          error.name === 'AuthSessionMissingError';

        if (!isSessionMissingError) {
          logStore.logError('Error during Supabase sign out', error);
        }
      }
    } catch (supabaseError) {
      // Ignore Supabase errors - we'll clear local state anyway
      logStore.logSystem(
        'Supabase sign out error (continuing anyway)',
        supabaseError instanceof Error ? { message: supabaseError.message } : {},
      );
    }

    // Always clear local state, regardless of Supabase API result
    userStore.set(null);
    sessionStore.set(null);
  } catch (error) {
    logStore.logError('Failed to sign out', error);
    // Still clear local state even if something went wrong
    userStore.set(null);
    sessionStore.set(null);
    throw error;
  } finally {
    isLoadingStore.set(false);
  }
}

export function useAuthStatus() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(authStatusStore.isLoggedIn.get());

  useEffect(() => {
    const unsubscribeIsLoggedIn = authStatusStore.isLoggedIn.listen(setIsLoggedIn);

    return () => {
      unsubscribeIsLoggedIn();
    };
  }, []);

  return { isLoggedIn };
}
