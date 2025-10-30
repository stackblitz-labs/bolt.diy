import { useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { userStore } from '~/lib/stores/auth';

export function useUser() {
  const user = useStore(userStore);

  useEffect(() => {
    if (!user?.email || !user?.id) {
      return;
    }
    if (window.analytics) {
      window.analytics.identify(user.id, {
        name: user.user_metadata.full_name,
        email: user.email,
        userId: user.id,
        createdAt: user.created_at,
        lastSignIn: user.last_sign_in_at,
        updatedAt: user.updated_at,
      });
    }

    if (window.LogRocket) {
      window.LogRocket.identify(user.id, {
        name: user.user_metadata.full_name,
        email: user.email,
        userId: user.id,
        createdAt: user.created_at,
        lastSignIn: user.last_sign_in_at,
        updatedAt: user.updated_at,
      });
    }

    if (window.Intercom) {
      // Get the access token from localStorage (where Supabase stores it)
      const storageKey = `sb-${new URL(window.ENV.SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
      const authData = localStorage.getItem(storageKey);
      let accessToken = null;

      if (authData) {
        try {
          const parsed = JSON.parse(authData);
          accessToken = parsed.access_token;
        } catch (e) {
          console.error('Failed to parse auth token', e);
        }
      }

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      fetch(`/api/intercom/jwt`, {
        method: 'GET',
        headers,
      })
        .then((res) => res.json())
        .then((data) => {
          if (data && data.jwt && window.Intercom) {
            window.Intercom('boot', {
              api_base: 'https://api-iam.intercom.io',
              app_id: 'k7f741xx',
              intercom_user_jwt: data.jwt,
              user_id: user.id,
              email: user.email,
              name: user.user_metadata.full_name,
            });
          }
        })
        .catch((err) => {
          console.error('Failed to get Intercom JWT:', err);
        });
    }
  }, [user?.id, user?.email]);

  return user;
}
