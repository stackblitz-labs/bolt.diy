import { json, type MetaFunction } from '@remix-run/cloudflare';
import { useLoaderData } from '@remix-run/react';
import { ClientOnly } from 'remix-utils/client-only';
import { BaseChat } from '~/components/chat/BaseChat';
import { Chat } from '~/components/chat/Chat.client';
import { Header } from '~/components/header/Header';
import BackgroundRays from '~/components/ui/BackgroundRays';
import { useEffect, useState } from 'react';
import { providersStore } from '~/lib/stores/settings';
import { authStore } from '~/lib/stores/auth';
import { useNavigate } from '@remix-run/react';
import { motion, AnimatePresence } from 'framer-motion';

export const meta: MetaFunction = () => {
  return [
    { title: 'Bolt.gives' },
    {
      name: 'description',
      content: 'Build web applications with AI assistance - Enhanced fork with advanced features',
    },
  ];
};

export const loader = ({ context }: { context: any }) => {
  // Check which local providers are configured
  const configuredProviders: string[] = [];

  // Check Ollama
  if (context.cloudflare?.env?.OLLAMA_API_BASE_URL || process.env?.OLLAMA_API_BASE_URL) {
    configuredProviders.push('Ollama');
  }

  // Check LMStudio
  if (context.cloudflare?.env?.LMSTUDIO_API_BASE_URL || process.env?.LMSTUDIO_API_BASE_URL) {
    configuredProviders.push('LMStudio');
  }

  // Check OpenAILike
  if (context.cloudflare?.env?.OPENAI_LIKE_API_BASE_URL || process.env?.OPENAI_LIKE_API_BASE_URL) {
    configuredProviders.push('OpenAILike');
  }

  return json({ configuredProviders });
};

/**
 * Landing page component for Bolt.gives
 * Enhanced fork with multi-user authentication, advanced features, and provider auto-detection
 * Note: Settings functionality should ONLY be accessed through the sidebar menu.
 */
export default function Index() {
  const data = useLoaderData<{ configuredProviders: string[] }>();
  const [showMultiUserBanner, setShowMultiUserBanner] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Enable configured providers if they haven't been manually configured yet
    if (data?.configuredProviders && data.configuredProviders.length > 0) {
      const savedSettings = localStorage.getItem('provider_settings');

      if (!savedSettings) {
        // No saved settings, so enable the configured providers
        const currentProviders = providersStore.get();
        data.configuredProviders.forEach((providerName) => {
          if (currentProviders[providerName]) {
            providersStore.setKey(providerName, {
              ...currentProviders[providerName],
              settings: {
                ...currentProviders[providerName].settings,
                enabled: true,
              },
            });
          }
        });

        // Save to localStorage so this only happens once
        localStorage.setItem('provider_settings', JSON.stringify(providersStore.get()));
      }
    }
  }, [data?.configuredProviders]);

  useEffect(() => {
    // Check if user is authenticated
    const authState = authStore.get();

    // Show banner only if not authenticated and hasn't been dismissed
    const bannerDismissed = localStorage.getItem('multiUserBannerDismissed');

    if (!authState.isAuthenticated && !bannerDismissed) {
      setTimeout(() => setShowMultiUserBanner(true), 2000);
    }
  }, []);

  const handleActivateMultiUser = () => {
    navigate('/auth');
  };

  const handleDismissBanner = () => {
    setShowMultiUserBanner(false);
    localStorage.setItem('multiUserBannerDismissed', 'true');
  };

  return (
    <div className="flex flex-col h-full w-full bg-bolt-elements-background-depth-1">
      <BackgroundRays />
      <Header />
      <ClientOnly fallback={<BaseChat />}>{() => <Chat />}</ClientOnly>

      {/* Optional Multi-User Activation Banner */}
      <AnimatePresence>
        {showMultiUserBanner && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
            className="fixed bottom-6 right-6 max-w-sm z-50"
          >
            <div className="bg-bolt-elements-background-depth-2 backdrop-blur-xl rounded-xl border border-bolt-elements-borderColor shadow-2xl p-4">
              <button
                onClick={handleDismissBanner}
                className="absolute top-2 right-2 text-bolt-elements-textTertiary hover:text-bolt-elements-textSecondary transition-colors"
                aria-label="Close"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                      />
                    </svg>
                  </div>
                </div>

                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-bolt-elements-textPrimary mb-1">
                    Unlock Multi-User Features
                  </h3>
                  <p className="text-xs text-bolt-elements-textSecondary mb-3">
                    Save your projects, personalized settings, and collaborate with workspace isolation.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleActivateMultiUser}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl"
                    >
                      Activate Now
                    </button>
                    <button
                      onClick={handleDismissBanner}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-bolt-elements-button-secondary-background text-bolt-elements-button-secondary-text hover:bg-bolt-elements-button-secondary-backgroundHover transition-all"
                    >
                      Continue as Guest
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
