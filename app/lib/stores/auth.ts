import { atom, map } from 'nanostores';
import type { UserProfile } from '~/lib/utils/fileUserStorage';
import Cookies from 'js-cookie';

export interface AuthState {
  isAuthenticated: boolean;
  user: Omit<UserProfile, 'passwordHash'> | null;
  token: string | null;
  loading: boolean;
}

// Authentication state store
export const authStore = map<AuthState>({
  isAuthenticated: false,
  user: null,
  token: null,
  loading: true,
});

// Remember me preference
export const rememberMeStore = atom<boolean>(false);

// Session timeout tracking
let sessionTimeout: NodeJS.Timeout | null = null;
const SESSION_TIMEOUT = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Initialize auth from stored token
 */
export async function initializeAuth(): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  authStore.setKey('loading', true);

  try {
    const token = Cookies.get('auth_token');

    if (token) {
      // Verify token with backend
      const response = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = (await response.json()) as { user: Omit<UserProfile, 'passwordHash'> };
        setAuthState({
          isAuthenticated: true,
          user: data.user,
          token,
          loading: false,
        });
        startSessionTimer();
      } else {
        // Token is invalid, clear it
        clearAuth();
      }
    } else {
      authStore.setKey('loading', false);
    }
  } catch (error) {
    console.error('Failed to initialize auth:', error);
    authStore.setKey('loading', false);
  }
}

/**
 * Set authentication state
 */
export function setAuthState(state: AuthState): void {
  authStore.set(state);

  if (state.token) {
    // Store token in cookie
    const cookieOptions = rememberMeStore.get()
      ? { expires: 7 } // 7 days
      : undefined; // Session cookie

    Cookies.set('auth_token', state.token, cookieOptions);

    // Store user preferences in localStorage
    if (state.user) {
      localStorage.setItem(`bolt_user_${state.user.id}`, JSON.stringify(state.user.preferences || {}));
    }
  }
}

/**
 * Login user
 */
export async function login(
  username: string,
  password: string,
  rememberMe: boolean = false,
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    const data = (await response.json()) as {
      success?: boolean;
      error?: string;
      user?: Omit<UserProfile, 'passwordHash'>;
      token?: string;
    };

    if (response.ok) {
      rememberMeStore.set(rememberMe);
      setAuthState({
        isAuthenticated: true,
        user: data.user || null,
        token: data.token || null,
        loading: false,
      });
      startSessionTimer();

      return { success: true };
    } else {
      return { success: false, error: data.error || 'Login failed' };
    }
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: 'Network error' };
  }
}

/**
 * Signup new user
 */
export async function signup(
  username: string,
  password: string,
  firstName: string,
  avatar?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password, firstName, avatar }),
    });

    const data = (await response.json()) as {
      success?: boolean;
      error?: string;
      user?: Omit<UserProfile, 'passwordHash'>;
      token?: string;
    };

    if (response.ok) {
      setAuthState({
        isAuthenticated: true,
        user: data.user || null,
        token: data.token || null,
        loading: false,
      });
      startSessionTimer();

      return { success: true };
    } else {
      return { success: false, error: data.error || 'Signup failed' };
    }
  } catch (error) {
    console.error('Signup error:', error);
    return { success: false, error: 'Network error' };
  }
}

/**
 * Logout user
 */
export async function logout(): Promise<void> {
  const state = authStore.get();

  if (state.token) {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${state.token}`,
        },
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  clearAuth();
}

/**
 * Clear authentication state
 */
function clearAuth(): void {
  authStore.set({
    isAuthenticated: false,
    user: null,
    token: null,
    loading: false,
  });

  Cookies.remove('auth_token');
  stopSessionTimer();

  // Clear user-specific localStorage
  const currentUser = authStore.get().user;

  if (currentUser?.id) {
    // Keep preferences but clear sensitive data
    const prefs = localStorage.getItem(`bolt_user_${currentUser.id}`);

    if (prefs) {
      try {
        const parsed = JSON.parse(prefs);
        delete parsed.deploySettings;
        delete parsed.githubSettings;
        localStorage.setItem(`bolt_user_${currentUser.id}`, JSON.stringify(parsed));
      } catch {}
    }
  }
}

/**
 * Start session timer
 */
function startSessionTimer(): void {
  stopSessionTimer();

  if (!rememberMeStore.get()) {
    sessionTimeout = setTimeout(() => {
      logout();

      if (typeof window !== 'undefined') {
        window.location.href = '/auth';
      }
    }, SESSION_TIMEOUT);
  }
}

/**
 * Stop session timer
 */
function stopSessionTimer(): void {
  if (sessionTimeout) {
    clearTimeout(sessionTimeout);
    sessionTimeout = null;
  }
}

/**
 * Update user profile
 */
export async function updateProfile(
  updates: Partial<Omit<UserProfile, 'passwordHash' | 'id' | 'username'>>,
): Promise<boolean> {
  const state = authStore.get();

  if (!state.token || !state.user) {
    return false;
  }

  try {
    const response = await fetch('/api/users/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.token}`,
      },
      body: JSON.stringify(updates),
    });

    if (response.ok) {
      const updatedUser = (await response.json()) as Omit<UserProfile, 'passwordHash'>;
      authStore.setKey('user', updatedUser);

      return true;
    }
  } catch (error) {
    console.error('Failed to update profile:', error);
  }

  return false;
}

// Initialize auth on load
if (typeof window !== 'undefined') {
  initializeAuth();
}
