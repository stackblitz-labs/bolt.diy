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
      fetch(`/api/intercom/jwt?user_id=${encodeURIComponent(user.id)}&email=${encodeURIComponent(user.email)}`)
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
        });
    }
  }, [user?.id, user?.email]);

  return user;
}
