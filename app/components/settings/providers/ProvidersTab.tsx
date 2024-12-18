import React, { useEffect, useState } from 'react';
import { Switch } from '~/components/ui/Switch';
import { useSettings } from '~/lib/hooks/useSettings';
import { LOCAL_PROVIDERS, URL_CONFIGURABLE_PROVIDERS } from '~/lib/stores/settings';
import type { IProviderConfig } from '~/types/model';
import { logStore } from '~/lib/stores/logs';

// Import a default fallback icon
import DefaultIcon from '/icons/Default.svg';

// List of advanced providers with correct casing
const ADVANCED_PROVIDERS = ['Ollama', 'OpenAILike', 'LMStudio'];

export default function ProvidersTab() {
  const { providers, updateProviderSettings, isLocalModel } = useSettings();
  const [filteredProviders, setFilteredProviders] = useState<IProviderConfig[]>([]);
  const [advancedProviders, setAdvancedProviders] = useState<IProviderConfig[]>([]);
  const [regularProviders, setRegularProviders] = useState<IProviderConfig[]>([]);

  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    let newFilteredProviders: IProviderConfig[] = Object.entries(providers).map(([key, value]) => ({
      ...value,
      name: key,
    }));

    if (searchTerm && searchTerm.length > 0) {
      newFilteredProviders = newFilteredProviders.filter((provider) =>
        provider.name.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    if (!isLocalModel) {
      newFilteredProviders = newFilteredProviders.filter((provider) => !LOCAL_PROVIDERS.includes(provider.name));
    }

    // Split providers into regular and advanced
    const regular = newFilteredProviders.filter(
      (provider) => !ADVANCED_PROVIDERS.includes(provider.name)
    );
    const advanced = newFilteredProviders.filter(
      (provider) => ADVANCED_PROVIDERS.includes(provider.name)
    );

    // Sort advanced providers in specific order - OpenAILike at the end
    const advancedOrder = ['Ollama', 'LMStudio', 'OpenAILike'];
    advanced.sort((a, b) => {
      return advancedOrder.indexOf(a.name) - advancedOrder.indexOf(b.name);
    });

    // Sort regular providers alphabetically
    regular.sort((a, b) => a.name.localeCompare(b.name));

    setRegularProviders(regular);
    setAdvancedProviders(advanced);
    setFilteredProviders(newFilteredProviders);
  }, [providers, searchTerm, isLocalModel]);

  const ProviderCard = ({ provider }: { provider: IProviderConfig }) => (
    <div className="flex flex-col provider-item hover:bg-bolt-elements-bg-depth-3 p-4 rounded-lg border border-bolt-elements-borderColor">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <img
            src={`/icons/${provider.name}.svg`}
            onError={(e) => {
              e.currentTarget.src = DefaultIcon;
            }}
            alt={`${provider.name} icon`}
            className="w-6 h-6 dark:invert"
          />
          <span className="text-bolt-elements-textPrimary">{provider.name}</span>
        </div>
        <Switch
          className="ml-auto"
          checked={provider.settings.enabled}
          onCheckedChange={(enabled) => {
            updateProviderSettings(provider.name, { ...provider.settings, enabled });
            if (enabled) {
              logStore.logProvider(`Provider ${provider.name} enabled`, { provider: provider.name });
            } else {
              logStore.logProvider(`Provider ${provider.name} disabled`, { provider: provider.name });
            }
          }}
        />
      </div>
      {URL_CONFIGURABLE_PROVIDERS.includes(provider.name) && provider.settings.enabled && (
        <div className="mt-2">
          <label className="block text-sm text-bolt-elements-textSecondary mb-1">Base URL:</label>
          <input
            type="text"
            value={provider.settings.baseUrl || ''}
            onChange={(e) => {
              const newBaseUrl = e.target.value;
              updateProviderSettings(provider.name, { ...provider.settings, baseUrl: newBaseUrl });
              logStore.logProvider(`Base URL updated for ${provider.name}`, {
                provider: provider.name,
                baseUrl: newBaseUrl,
              });
            }}
            placeholder={`Enter ${provider.name} base URL`}
            className="w-full bg-white dark:bg-bolt-elements-background-depth-4 relative px-2 py-1.5 rounded-md focus:outline-none placeholder-bolt-elements-textTertiary text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary border border-bolt-elements-borderColor"
          />
        </div>
      )}
    </div>
  );

  return (
    <div className="p-4">
      <div className="flex mb-4">
        <input
          type="text"
          placeholder="Search providers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-white dark:bg-bolt-elements-background-depth-4 relative px-2 py-1.5 rounded-md focus:outline-none placeholder-bolt-elements-textTertiary text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary border border-bolt-elements-borderColor"
        />
      </div>

      {/* Regular Providers Grid */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {regularProviders.map((provider) => (
          <ProviderCard key={provider.name} provider={provider} />
        ))}
      </div>

      {/* Advanced Providers Section */}
      {advancedProviders.length > 0 && (
        <div className="mb-4 border-t border-bolt-elements-borderColor pt-4">
          <h3 className="text-bolt-elements-textSecondary text-lg font-medium mb-2">Experimental Providers</h3>
          <p className="text-bolt-elements-textSecondary mb-6">
            These providers are experimental features that allow you to run AI models locally or connect to your own infrastructure.
            They require additional setup but offer more flexibility for advanced users.
          </p>
          <div className="grid grid-cols-2 gap-4">
            {advancedProviders.map((provider) => (
              <ProviderCard key={provider.name} provider={provider} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
