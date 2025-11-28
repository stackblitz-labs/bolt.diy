import { json, type MetaFunction } from '@remix-run/cloudflare';
import { ClientOnly } from 'remix-utils/client-only';
import { BaseChat } from '~/components/chat/BaseChat';
import { Chat } from '~/components/chat/Chat.client';
import { Header } from '~/components/header/Header';
import BackgroundRays from '~/components/ui/BackgroundRays';
import { Login } from '~/components/auth/Login';
import { useEffect, useState } from 'react';
import { authClient } from '~/lib/webcontainer/auth.client';

export const meta: MetaFunction = () => {
  return [{ title: 'Bolt' }, { name: 'description', content: 'Talk with Bolt, an AI assistant from StackBlitz' }];
};

export const loader = () => json({});

/**
 * Landing page component for Bolt
 * Now with client-side authentication check
 */
export default function Index() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Check authentication on mount
    const checkAuth = async () => {
      const authenticated = authClient.isAuthenticated();

      if (authenticated) {
        // Verify with server
        const isValid = await authClient.checkAuth();
        setIsAuthenticated(isValid);
      } else {
        setIsAuthenticated(false);
      }

      setIsChecking(false);
    };

    checkAuth();
  }, []);

  // Show loading while checking auth
  if (isChecking) {
    return (
      <div className="flex flex-col h-full w-full bg-bolt-elements-background-depth-1 items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        <p className="mt-4 text-gray-400">Đang kiểm tra xác thực...</p>
      </div>
    );
  }

  // Show login if not authenticated
  if (!isAuthenticated) {
    return (
      <ClientOnly fallback={<div>Loading...</div>}>
        {() => <Login onLoginSuccess={() => setIsAuthenticated(true)} />}
      </ClientOnly>
    );
  }

  // Show app if authenticated
  return (
    <div className="flex flex-col h-full w-full bg-bolt-elements-background-depth-1">
      <BackgroundRays />
      <Header />
      <ClientOnly fallback={<BaseChat />}>{() => <Chat />}</ClientOnly>
    </div>
  );
}
