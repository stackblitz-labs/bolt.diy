import React, { useState } from 'react';
import { Switch } from '~/components/ui/Switch';
import { type AppSummary } from '~/lib/persistence/messageAppSummary';
import { chatStore, onChatResponse } from '~/lib/stores/chat';
import { callNutAPI } from '~/lib/replay/NutAPI';
import { toast } from 'react-toastify';
import { assert } from '~/utils/nut';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import WithTooltip from '~/components/ui/Tooltip';
import AllowedDomainsDialog from '~/components/ui/AllowedDomainsDialog';
import { Lock, Globe, ShieldCheck, Check } from '~/components/ui/Icon';

interface AuthSelectorCardProps {
  appSummary: AppSummary;
}

const AuthRequiredSecret = 'VITE_AUTH_REQUIRED';

export const AuthSelectorCard: React.FC<AuthSelectorCardProps> = ({ appSummary }) => {
  // Only show for apps with template versions
  if (!appSummary.templateVersion) {
    return null;
  }

  const appId = chatStore.currentAppId.get();
  assert(appId, 'App ID is required');

  const [saving, setSaving] = useState(false);
  const [showDomains, setShowDomains] = useState(false);
  const authRequired = appSummary?.setSecrets?.includes(AuthRequiredSecret);

  const handleToggle = async () => {
    setSaving(true);

    try {
      const { response } = await callNutAPI('set-app-secrets', {
        appId,
        secrets: [
          {
            key: AuthRequiredSecret,
            value: authRequired ? undefined : 'true',
          },
        ],
      });

      if (response) {
        onChatResponse(response, 'ToggleRequireAuth');
      }

      toast.success('Authentication settings updated successfully');
    } catch (error) {
      toast.error('Failed to update authentication settings');
      console.error('Failed to update authentication settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const getDescription = () => {
    return authRequired
      ? 'Users must create accounts and log in to access the application'
      : 'Application is open to all users without requiring authentication';
  };

  const getToggleControl = () => {
    const tooltipText = authRequired
      ? 'Disable authentication - anyone can access your app'
      : 'Enable authentication - requires user accounts to access your app';

    return (
      <TooltipProvider>
        <WithTooltip tooltip={tooltipText}>
          <button
            className={`group p-4 bg-bolt-elements-background-depth-2 rounded-xl border transition-all duration-200 w-full shadow-sm ${
              saving
                ? 'border-bolt-elements-borderColor border-opacity-30 cursor-not-allowed opacity-60'
                : 'border-bolt-elements-borderColor hover:border-bolt-elements-focus/60 hover:bg-bolt-elements-background-depth-3 hover:shadow-md hover:scale-[1.02] cursor-pointer'
            }`}
            onClick={!saving ? handleToggle : undefined}
            disabled={saving}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {authRequired ? (
                  <Lock
                    className="transition-transform duration-200 group-hover:scale-110 text-bolt-elements-icon-success"
                    size={18}
                  />
                ) : (
                  <Globe
                    className="transition-transform duration-200 group-hover:scale-110 text-bolt-elements-textPrimary"
                    size={18}
                  />
                )}
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-bolt-elements-textPrimary transition-transform duration-200 group-hover:scale-105">
                    {authRequired ? 'Authentication Required' : 'Public Access'}
                  </span>
                  <span className="text-xs text-bolt-elements-textSecondary group-hover:text-bolt-elements-textPrimary transition-all duration-200">
                    {saving ? 'Updating...' : null}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {saving && (
                  <div className="w-4 h-4 rounded-full border-2 border-bolt-elements-borderColor border-t-blue-500 animate-spin" />
                )}
                <Switch
                  checked={authRequired}
                  onCheckedChange={!saving ? handleToggle : undefined}
                  className={`${saving ? 'opacity-50' : 'group-hover:scale-110'} transition-all duration-200 pointer-events-none`}
                />
              </div>
            </div>
          </button>
        </WithTooltip>
      </TooltipProvider>
    );
  };

  return (
    <div className="relative rounded-xl transition-all duration-300 shadow-sm">
      <div className="bg-bolt-elements-background-depth-2 rounded-xl transition-all duration-300 relative overflow-hidden p-5 border border-bolt-elements-borderColor">
        <div className="relative">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center shadow-sm bg-gradient-to-br from-indigo-500 to-indigo-600">
              <ShieldCheck className="text-white" size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold text-bolt-elements-textHeading truncate">
                Authentication Settings
              </h3>
              <div className="mt-1.5 flex items-center">
                <div className="flex items-center gap-2 text-bolt-elements-icon-success">
                  <Check size={14} strokeWidth={2.5} />
                  <span className="text-sm font-medium text-green-600">Configured</span>
                </div>
              </div>
            </div>
          </div>

          <div className="text-sm text-bolt-elements-textSecondary leading-relaxed mb-3">{getDescription()}</div>

          <div className="mt-3">
            <div className="space-y-3">
              {getToggleControl()}
              {authRequired && (
                <div>
                  <button
                    type="button"
                    className="w-full px-4 py-3 text-sm rounded-xl border text-bolt-elements-textHeading border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-background-depth-3 transition-all duration-200 hover:scale-[1.02] hover:shadow-md font-medium"
                    onClick={() => setShowDomains(true)}
                  >
                    Set Allowed Domains
                  </button>
                  <AllowedDomainsDialog open={showDomains} onOpenChange={setShowDomains} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
