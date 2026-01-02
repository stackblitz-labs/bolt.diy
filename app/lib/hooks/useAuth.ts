import { useEffect } from 'react';
import { useStore } from '@nanostores/react';
import {
  authState,
  signup as signupAction,
  login as loginAction,
  logout as logoutAction,
  checkSession,
} from '~/lib/stores/auth';

export function useAuth() {
  const state = useStore(authState);

  useEffect(() => {
    // Check session on mount if we have a stored session
    if (state.session && !state.user) {
      checkSession().catch(console.error);
    }
  }, []);

  const signup = async (email: string, password: string, username: string, displayName?: string) => {
    return signupAction(email, password, username, displayName);
  };

  const login = async (email: string, password: string) => {
    return loginAction(email, password);
  };

  const logout = async () => {
    return logoutAction();
  };

  return {
    user: state.user,
    session: state.session,
    isLoading: state.isLoading,
    isAuthenticated: state.isAuthenticated,
    signup,
    login,
    logout,
  };
}
