import { useEffect, useState } from 'react';
import { useNavigate } from '@remix-run/react';
import { ClientOnly } from 'remix-utils/client-only';
import { useStore } from '@nanostores/react';
import { authStore } from '~/lib/stores/auth';
import { BaseChat } from '~/components/chat/BaseChat';
import { Chat } from '~/components/chat/Chat.client';
import { Header } from '~/components/header/Header';
import BackgroundRays from '~/components/ui/BackgroundRays';
import { motion } from 'framer-motion';
import { UserMenu } from '~/components/header/UserMenu';

/**
 * Authenticated chat component that ensures user is logged in
 */
export function AuthenticatedChat() {
  const navigate = useNavigate();
  const authState = useStore(authStore);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Check authentication status after component mounts
    const checkAuth = async () => {
      // Give auth store time to initialize
      await new Promise((resolve) => setTimeout(resolve, 100));

      const state = authStore.get();

      if (!state.loading) {
        if (!state.isAuthenticated) {
          navigate('/auth');
        } else {
          setIsInitialized(true);
        }
      }
    };

    checkAuth();
  }, [navigate]);

  useEffect(() => {
    // Subscribe to auth changes
    const unsubscribe = authStore.subscribe((state) => {
      if (!state.loading && !state.isAuthenticated) {
        navigate('/auth');
      }
    });

    return () => {
      unsubscribe();
    };
  }, [navigate]);

  // Show loading state
  if (authState.loading || !isInitialized) {
    return (
      <div className="flex flex-col h-full w-full bg-bolt-elements-background-depth-1">
        <BackgroundRays />
        <div className="flex-1 flex items-center justify-center">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-bolt-elements-background-depth-2 flex items-center justify-center">
              <span className="i-svg-spinners:3-dots-scale text-2xl text-bolt-elements-textPrimary" />
            </div>
            <p className="text-bolt-elements-textSecondary">Initializing workspace...</p>
          </motion.div>
        </div>
      </div>
    );
  }

  // If not authenticated, don't render (will redirect)
  if (!authState.isAuthenticated) {
    return null;
  }

  // Render authenticated content with enhanced header
  return (
    <div className="flex flex-col h-full w-full bg-bolt-elements-background-depth-1">
      <BackgroundRays />
      <Header>
        <UserMenu />
      </Header>
      <ClientOnly fallback={<BaseChat />}>{() => <Chat />}</ClientOnly>
    </div>
  );
}
