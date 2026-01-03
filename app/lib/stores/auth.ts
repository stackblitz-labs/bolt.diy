/**
 * Auth State Store
 *
 * Global authentication state that can be accessed synchronously
 * without needing to read HttpOnly cookies.
 *
 * Updated by AuthStateSync component using Better Auth's useSession hook.
 */

import { atom } from 'nanostores';

export interface AuthState {
  isAuthenticated: boolean;
  userId: string | null;
}

export const authStore = atom<AuthState>({
  isAuthenticated: false,
  userId: null,
});

export function setAuthState(isAuthenticated: boolean, userId: string | null) {
  authStore.set({ isAuthenticated, userId });
}

