import { Link, Server, Monitor, Globe } from 'lucide-react';
import React from 'react';
import { PROVIDER_DESCRIPTIONS } from './types';
import { Card } from '~/components/ui/Card';
import { Switch } from '~/components/ui/Switch';
import type { IProviderConfig } from '~/types/model';
import { classNames } from '~/utils/classNames';

// Provider Card Component
interface ProviderCardProps {
  provider: IProviderConfig;
  onToggle: (enabled: boolean) => void;
  onUpdateBaseUrl: (url: string) => void;
  isEditing: boolean;
  onStartEditing: () => void;
  onStopEditing: () => void;
}

function ProviderCard({
  provider,
  onToggle,
  onUpdateBaseUrl,
  isEditing,
  onStartEditing,
  onStopEditing,
}: ProviderCardProps) {
  const getIcon = (providerName: string) => {
    switch (providerName) {
      case 'Ollama':
        return Server;
      case 'LMStudio':
        return Monitor;
      case 'OpenAILike':
        return Globe;
      default:
        return Server;
    }
  };

  const Icon = getIcon(provider.name);

  return (
    <Card className="rounded-xl border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 transition-colors hover:border-bolt-elements-borderColorActive hover:bg-bolt-elements-background-depth-3">
      <div className="flex items-center justify-between gap-4 px-5 py-4">
        <div className="flex flex-1 items-center gap-4">
          <div
            className={classNames(
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors',
              provider.settings.enabled
                ? 'bg-purple-500/15 ring-1 ring-purple-500/30'
                : 'bg-bolt-elements-background-depth-3',
            )}
          >
            <Icon
              className={classNames(
                'h-5 w-5 transition-colors',
                provider.settings.enabled ? 'text-purple-400' : 'text-bolt-elements-textSecondary',
              )}
            />
          </div>
          <div className="flex-1">
            <div className="mb-1 flex items-center gap-2">
              <h3 className="text-sm font-semibold text-bolt-elements-textPrimary">{provider.name}</h3>
              <span className="rounded-full bg-bolt-elements-background-depth-3 px-2 py-0.5 text-[11px] text-bolt-elements-textSecondary">
                Local
              </span>
            </div>
            <p className="text-sm text-bolt-elements-textSecondary">
              {PROVIDER_DESCRIPTIONS[provider.name as keyof typeof PROVIDER_DESCRIPTIONS]}
            </p>

            {provider.settings.enabled && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-bolt-elements-textPrimary">API Endpoint</label>
                {isEditing ? (
                  <input
                    type="text"
                    defaultValue={provider.settings.baseUrl}
                    placeholder={`Enter ${provider.name} base URL`}
                    className="w-full rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 px-3 py-2.5 text-sm text-bolt-elements-textPrimary placeholder:text-bolt-elements-textTertiary focus:border-bolt-elements-borderColorActive focus:outline-none focus:ring-2 focus:ring-bolt-elements-borderColorActive/40"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        onUpdateBaseUrl(e.currentTarget.value);
                        onStopEditing();
                      } else if (e.key === 'Escape') {
                        onStopEditing();
                      }
                    }}
                    onBlur={(e) => {
                      onUpdateBaseUrl(e.target.value);
                      onStopEditing();
                    }}
                    autoFocus
                  />
                ) : (
                  <button
                    onClick={onStartEditing}
                    className="group w-full rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 px-3 py-2.5 text-left text-sm transition-colors hover:border-bolt-elements-borderColorActive hover:bg-bolt-elements-background-depth-3"
                  >
                    <div className="flex items-center gap-3 text-bolt-elements-textSecondary group-hover:text-bolt-elements-textPrimary">
                      <Link className="w-4 h-4 group-hover:text-purple-500 transition-colors" />
                      <span className="break-all font-mono text-xs">
                        {provider.settings.baseUrl || 'Click to set base URL'}
                      </span>
                    </div>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="shrink-0">
          <Switch
            checked={provider.settings.enabled}
            onCheckedChange={onToggle}
            aria-label={`Toggle ${provider.name} provider`}
          />
        </div>
      </div>
    </Card>
  );
}

export default ProviderCard;
