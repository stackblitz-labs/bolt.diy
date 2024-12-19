import React from 'react';
import { ProviderCard } from '~/lib/git/components/ProviderCard';
import { useGitProviders } from '~/lib/git';
import type { ProviderKey } from '~/lib/git';

export default function ConnectionsTab() {
  const {
    providers,
    credentials,
    expandedProviders,
    handleSaveConnection,
    handleDisconnect,
    updateProviderCredentials,
    toggleProvider,
  } = useGitProviders();

  return (
    <div className="space-y-4">
      {(Object.entries(providers) as [ProviderKey, any][]).map(([key, provider]) => (
        <ProviderCard
          key={key}
          provider={provider}
          credentials={credentials[key]}
          isExpanded={expandedProviders[key]}
          onToggle={() => toggleProvider(key)}
          onUpdateCredentials={(updates) => updateProviderCredentials(key, updates)}
          onSave={() => handleSaveConnection(key)}
          onDisconnect={() => handleDisconnect(key)}
        />
      ))}
    </div>
  );
}
