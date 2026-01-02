import { atom } from 'nanostores';

export interface User {
  id: string;
  email: string;
  username: string;
  display_name: string;
  created_at?: string;
  updated_at?: string;
}

export interface AuthState {
  user: User | null;
  session: AuthSession | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
}

export interface SignupResponse {
  user: User;
  session: AuthSession;
  workspace?: any;
  error?: string;
}

export interface LoginResponse {
  user: User;
  session: AuthSession;
  workspaces?: any[];
  error?: string;
}

export interface SessionResponse {
  user: User | null;
  session: AuthSession | null;
  workspaces?: any[];
  error?: string;
}

const storage =
  typeof globalThis !== 'undefined' &&
  typeof globalThis.localStorage !== 'undefined' &&
  typeof globalThis.localStorage.getItem === 'function'
    ? globalThis.localStorage
    : null;

// Load initial state from localStorage
const savedAuth = storage ? storage.getItem('bolt_auth') : null;
const initialState: AuthState = savedAuth
  ? JSON.parse(savedAuth)
  : {
      user: null,
      session: null,
      isLoading: false,
      isAuthenticated: false,
    };

export const authState = atom<AuthState>(initialState);

export const isAuthenticated = atom(initialState.isAuthenticated);
export const currentUser = atom<User | null>(initialState.user);

// Update derived atoms when auth state changes
authState.subscribe((state) => {
  isAuthenticated.set(state.isAuthenticated);
  currentUser.set(state.user);

  // Persist to localStorage
  if (storage) {
    if (state.user && state.session) {
      storage.setItem('bolt_auth', JSON.stringify(state));
    } else {
      storage.removeItem('bolt_auth');
    }
  }
});

export function setAuthState(state: Partial<AuthState>) {
  const current = authState.get();
  const newState = { ...current, ...state };
  authState.set(newState);
}

export async function signup(email: string, password: string, username: string, displayName?: string) {
  setAuthState({ isLoading: true });

  try {
    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, username, displayName }),
    });

    const data: SignupResponse = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to sign up');
    }

    setAuthState({
      user: data.user,
      session: data.session,
      isLoading: false,
      isAuthenticated: true,
    });

    return { user: data.user, session: data.session, workspace: data.workspace };
  } catch (error) {
    setAuthState({ isLoading: false, isAuthenticated: false });
    throw error;
  }
}

export async function login(email: string, password: string) {
  setAuthState({ isLoading: true });

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data: LoginResponse = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to log in');
    }

    setAuthState({
      user: data.user,
      session: data.session,
      isLoading: false,
      isAuthenticated: true,
    });

    return { user: data.user, session: data.session, workspaces: data.workspaces || [] };
  } catch (error) {
    setAuthState({ isLoading: false, isAuthenticated: false });
    throw error;
  }
}

export async function logout() {
  const state = authState.get();

  if (!state.session) {
    return;
  }

  setAuthState({ isLoading: true });

  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.session.access_token}`,
      },
    });
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    setAuthState({
      user: null,
      session: null,
      isLoading: false,
      isAuthenticated: false,
    });
  }
}

export async function checkSession() {
  const state = authState.get();

  if (!state.session) {
    return null;
  }

  try {
    const response = await fetch('/api/auth/session', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${state.session.access_token}`,
      },
    });

    const data: SessionResponse = await response.json();

    if (response.ok && data.user) {
      setAuthState({
        user: data.user,
        session: data.session || state.session,
        isLoading: false,
        isAuthenticated: true,
      });
      return { user: data.user, session: data.session, workspaces: data.workspaces || [] };
    } else {
      setAuthState({
        user: null,
        session: null,
        isLoading: false,
        isAuthenticated: false,
      });
      return null;
    }
  } catch (error) {
    console.error('Session check error:', error);
    setAuthState({
      user: null,
      session: null,
      isLoading: false,
      isAuthenticated: false,
    });

    return null;
  }
}

// Initialize session check on load
if (typeof window !== 'undefined' && initialState.session) {
  checkSession().catch(console.error);
}
