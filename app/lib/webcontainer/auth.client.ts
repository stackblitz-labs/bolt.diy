/**
 * This client-only module that contains everything related to auth and is used
 * to avoid importing `@webcontainer/api` in the server bundle.
 */

// Client-side authentication helper

interface LoginResponse {
  success: boolean;
  user?: {
    id: string;
    email: string;
    name: string;
  };
  token?: string;
  error?: string;
}

interface User {
  id: string;
  email: string;
  name: string;
}

class AuthClient {
  private _token: string | null = null;
  private _user: User | null = null;

  constructor() {
    // Load token from localStorage on init
    if (typeof window !== 'undefined') {
      this._token = localStorage.getItem('auth_token');

      const userStr = localStorage.getItem('auth_user');

      if (userStr) {
        try {
          this._user = JSON.parse(userStr);
        } catch (e) {
          console.error('Failed to parse user data:', e);
        }
      }
    }
  }

  /**
   * Login with email and password
   */
  async login(email: string, password: string): Promise<LoginResponse> {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (typeof data !== 'object' || data === null) {
        return {
          success: false,
          error: 'Invalid response from server',
        };
      }

      const token = 'token' in data && typeof data.token === 'string' ? data.token : undefined;
      const user = 'user' in data && typeof data.user === 'object' ? (data.user as User) : undefined;
      const error = 'error' in data && typeof data.error === 'string' ? data.error : undefined;

      if (!response.ok) {
        return { success: false, error: error || 'Đăng nhập thất bại' };
      }

      if (token && user) {
        this._token = token;
        this._user = user;

        if (typeof window !== 'undefined') {
          localStorage.setItem('auth_token', token);
          localStorage.setItem('auth_user', JSON.stringify(user));
        }
      }

      return { success: true, token, user };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: 'Không thể kết nối đến server',
      };
    }
  }

  /**
   * Logout
   */
  async logout(): Promise<boolean> {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this._token}`,
        },
      });

      // Clear local data
      this._token = null;
      this._user = null;

      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
      }

      return true;
    } catch (error) {
      console.error('Logout error:', error);
      return false;
    }
  }

  /**
   * Check if user is authenticated
   */
  async checkAuth(): Promise<boolean> {
    if (!this._token) {
      return false;
    }

    try {
      const response = await fetch('/api/auth/session', {
        headers: {
          Authorization: `Bearer ${this._token}`,
        },
      });

      if (!response.ok) {
        // Token invalid, clear local data
        this._token = null;
        this._user = null;

        if (typeof window !== 'undefined') {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('auth_user');
        }

        return false;
      }

      return true;
    } catch (error) {
      console.error('Auth check error:', error);
      return false;
    }
  }

  /**
   * Get current user
   */
  getUser(): User | null {
    return this._user;
  }

  /**
   * Get current token
   */
  getToken(): string | null {
    return this._token;
  }

  /**
   * Check if user is logged in (from local data)
   */
  isAuthenticated(): boolean {
    return !!this._token && !!this._user;
  }
}

// Export singleton instance
export const authClient = new AuthClient();
