import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '~/utils/classNames';
import { BiChip } from 'react-icons/bi';
import { Switch } from '~/components/ui/Switch';
import OllamaProvider from './ollama/OllamaProvider';
import LMStudioProvider from './lmstudio/LMStudioProvider';
import OpenAILikeProvider from './openailike/OpenAILikeProvider';
import { useSettings } from '~/lib/hooks/useSettings';
import { LOCAL_PROVIDERS } from '~/lib/stores/settings';
import type { IProviderSetting } from '~/types/model';

export default function LocalProvidersTab() {
  const { providers, updateProviderSettings } = useSettings();
  const [categoryEnabled, setCategoryEnabled] = useState(false);

  // Check if all local providers are enabled
  useEffect(() => {
    if (!providers) {
      return;
    }

    const localProviders = Object.entries(providers)
      .filter(([key]) => LOCAL_PROVIDERS.includes(key))
      .map(([_, value]) => value);

    const allEnabled = localProviders.length > 0 && localProviders.every((provider) => provider.settings.enabled);
    setCategoryEnabled(allEnabled);
  }, [providers]);

  // Toggle all local providers
  const handleToggleCategory = (enabled: boolean) => {
    if (!providers) {
      return;
    }

    setCategoryEnabled(enabled);

    // Update all local providers with the new enabled state
    LOCAL_PROVIDERS.forEach((providerKey) => {
      if (providers[providerKey]) {
        const currentSettings = providers[providerKey].settings;
        const updatedSettings: IProviderSetting = {
          ...currentSettings,
          enabled,
        };
        updateProviderSettings(providerKey, updatedSettings);
      }
    });
  };

  return (
    <div
      className={cn(
        'rounded-lg bg-bolt-elements-background text-bolt-elements-textPrimary shadow-sm p-4',
        'hover:bg-bolt-elements-background-depth-2',
        'transition-all duration-200',
      )}
      role="region"
      aria-label="Local Providers Configuration"
    >
      <motion.div
        className="space-y-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Header section */}
        <div className="flex items-center justify-between gap-4 border-b border-bolt-elements-borderColor pb-4">
          <div className="flex items-center gap-3">
            <motion.div
              className={cn(
                'w-10 h-10 flex items-center justify-center rounded-xl',
                'bg-purple-500/10 text-purple-500',
              )}
              whileHover={{ scale: 1.05 }}
            >
              <BiChip className="w-6 h-6" />
            </motion.div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-bolt-elements-textPrimary">Local AI Models</h2>
              </div>
              <p className="text-sm text-bolt-elements-textSecondary">Configure and manage your local AI providers</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-bolt-elements-textSecondary">Enable All</span>
            <Switch
              checked={categoryEnabled}
              onCheckedChange={handleToggleCategory}
              aria-label="Toggle all local providers"
            />
          </div>
        </div>

        {/* Ollama Provider */}
        <OllamaProvider />

        {/* Other Providers Section */}
        <div className="border-t border-bolt-elements-borderColor pt-6 mt-8">
          <h3 className="text-lg font-semibold text-bolt-elements-textPrimary mb-4">Other Local Providers</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* LMStudio Provider */}
            <LMStudioProvider />
            {/* OpenAI-Like Provider */}
            <OpenAILikeProvider />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
