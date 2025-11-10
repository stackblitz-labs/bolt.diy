import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppCard } from '~/components/chat/Messages/components/AppCard';
import { Switch } from '~/components/ui/Switch';
import { type AppSummary } from '~/lib/persistence/messageAppSummary';
import { chatStore, onChatResponse } from '~/lib/stores/chat';
import { callNutAPI } from '~/lib/replay/NutAPI';
import { toast } from 'react-toastify';
import { assert } from '~/utils/nut';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import WithTooltip from '~/components/ui/Tooltip';
import { Skeleton } from '~/components/ui/Skeleton';
import { Globe, Lock, Trash2, Plus, ShieldCheck, MessageSquare } from '~/components/ui/Icon';

interface AuthSelectorComponentProps {
  appSummary: AppSummary;
}

const AuthRequiredSecret = 'VITE_AUTH_REQUIRED';
const AppMessagesSecret = 'VITE_ENABLE_APP_MESSAGES';

function isValidDomain(domain: string): boolean {
  const value = domain.trim();
  if (value.length === 0) {
    return false;
  }
  // Disallow protocol, path, or spaces
  if (value.includes('://') || value.includes('/') || value.includes(' ')) {
    return false;
  }
  // Basic domain regex: label(.label)+ with TLD >= 2
  const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
  return domainRegex.test(value);
}

export const AuthSelectorComponent: React.FC<AuthSelectorComponentProps> = ({ appSummary }) => {
  // Only show for apps with template versions
  if (!appSummary.templateVersion) {
    return null;
  }

  const appId = chatStore.currentAppId.get();
  assert(appId, 'App ID is required');

  const [saving, setSaving] = useState(false);
  const authRequired = appSummary?.setSecrets?.includes(AuthRequiredSecret);
  const appMessagesEnabled = appSummary?.setSecrets?.includes(AppMessagesSecret);

  const handleAuthToggle = async () => {
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

  const handleAppMessagesToggle = async () => {
    setSaving(true);

    try {
      const { response } = await callNutAPI('set-app-secrets', {
        appId,
        secrets: [
          {
            key: AppMessagesSecret,
            value: appMessagesEnabled ? undefined : 'true',
          },
        ],
      });

      if (response) {
        onChatResponse(response, 'ToggleAppMessages');
      }

      toast.success('In-app feedback settings updated successfully');
    } catch (error) {
      toast.error('Failed to update in-app feedback settings');
      console.error('Failed to update in-app feedback settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const getDescription = () => {
    return authRequired
      ? 'Users must create accounts and log in to access the application'
      : 'Application is open to all users without requiring authentication';
  };

  const getAuthToggleControl = () => {
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
            onClick={!saving ? handleAuthToggle : undefined}
            disabled={saving}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {authRequired ? (
                  <Lock className="text-bolt-elements-icon-success" size={18} />
                ) : (
                  <Globe className="text-bolt-elements-textPrimary" size={18} />
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
                  onCheckedChange={!saving ? handleAuthToggle : undefined}
                  className={`${saving ? 'opacity-50' : 'group-hover:scale-110'} transition-all duration-200 pointer-events-none`}
                />
              </div>
            </div>
          </button>
        </WithTooltip>
      </TooltipProvider>
    );
  };

  const [domains, setDomains] = useState<string[]>(['']);
  const [touched, setTouched] = useState<boolean[]>([false]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    (async () => {
      try {
        setLoading(true);
        const { deploySettings } = await callNutAPI('get-app-deploy-settings', { appId });
        if (
          deploySettings?.authAllowList &&
          Array.isArray(deploySettings.authAllowList) &&
          deploySettings.authAllowList.length > 0
        ) {
          setDomains(deploySettings.authAllowList);
          setTouched(new Array(deploySettings.authAllowList.length).fill(false));
        } else {
          setDomains(['']);
          setTouched([false]);
        }
      } catch (error) {
        // If API fails, start with a single empty row
        setDomains(['']);
        setTouched([false]);
        console.error('Failed to fetch allowed domains', error);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, appId]);

  const haveAny = useMemo(() => domains.some((d) => d.trim().length > 0), [domains]);
  const allValid = useMemo(() => domains.filter((d) => d.trim().length > 0).every((d) => isValidDomain(d)), [domains]);

  const setDomainAt = useCallback((index: number, value: string) => {
    setDomains((prev) => {
      const copy = [...prev];
      copy[index] = value;
      return copy;
    });
  }, []);

  const setTouchedAt = useCallback((index: number, value: boolean) => {
    setTouched((prev) => {
      const copy = [...prev];
      copy[index] = value;
      return copy;
    });
  }, []);

  const addRow = useCallback(() => {
    setDomains((prev) => [...prev, '']);
    setTouched((prev) => [...prev, false]);
  }, []);

  const removeRow = useCallback((index: number) => {
    setDomains((prev) => prev.filter((_, i) => i !== index));
    setTouched((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSave = useCallback(async () => {
    if (!haveAny || !allValid) {
      return;
    }
    setSaving(true);
    try {
      const cleaned = domains.map((d) => d.trim()).filter((d) => d.length > 0);

      // Merge with existing deploy settings to avoid clobbering other fields
      const { deploySettings } = await callNutAPI('get-app-deploy-settings', { appId });
      const newDeploySettings = { ...(deploySettings || {}), authAllowList: cleaned };
      await callNutAPI('set-app-deploy-settings', { appId, deploySettings: newDeploySettings });

      toast.success('Allowed domains updated');
    } catch (error) {
      console.error('Failed to save allowed domains', error);
      toast.error('Failed to save allowed domains');
    } finally {
      setSaving(false);
    }
  }, [haveAny, allValid, domains, appId]);

  const getAppMessagesToggleControl = () => {
    const tooltipText = appMessagesEnabled
      ? 'Disable in-app updates and bug reporting'
      : 'Enable updating and reporting bugs directly from the app';

    return (
      <TooltipProvider>
        <WithTooltip tooltip={tooltipText}>
          <button
            className={`group p-4 bg-bolt-elements-background-depth-2 rounded-xl border transition-all duration-200 w-full shadow-sm ${
              saving
                ? 'border-bolt-elements-borderColor border-opacity-30 cursor-not-allowed opacity-60'
                : 'border-bolt-elements-borderColor hover:border-bolt-elements-focus/60 hover:bg-bolt-elements-background-depth-3 hover:shadow-md hover:scale-[1.02] cursor-pointer'
            }`}
            onClick={!saving ? handleAppMessagesToggle : undefined}
            disabled={saving}
            type="button"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MessageSquare
                  className={appMessagesEnabled ? 'text-bolt-elements-icon-success' : 'text-bolt-elements-textPrimary'}
                  size={18}
                />
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-bolt-elements-textPrimary transition-transform duration-200 group-hover:scale-105">
                    {appMessagesEnabled ? 'In-App Feedback Enabled' : 'Enable In-App Feedback'}
                  </span>
                  <span className="text-xs text-bolt-elements-textSecondary group-hover:text-bolt-elements-textPrimary transition-all duration-200">
                    {saving
                      ? 'Updating...'
                      : appMessagesEnabled
                        ? 'Users can report issues or request updates directly in the app'
                        : 'Allow users to send feedback without leaving the app'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {saving && (
                  <div className="w-4 h-4 rounded-full border-2 border-bolt-elements-borderColor border-t-blue-500 animate-spin" />
                )}
                <Switch
                  checked={appMessagesEnabled}
                  onCheckedChange={!saving ? handleAppMessagesToggle : undefined}
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
    <AppCard
      title="Authentication Settings"
      description={getDescription()}
      icon={<ShieldCheck className="text-white" size={18} />}
      iconColor="indigo"
      status="completed"
      progressText="Configured"
    >
      <div className="space-y-3">
        {getAuthToggleControl()}
        {authRequired && (
          <div className="p-5 space-y-4">
            <div>
              <div className="text-md font-medium text-bolt-elements-textHeading mb-1">Set Allowed Domains</div>
              <div className="text-xs text-bolt-elements-textSecondary">
                Users can sign in only with emails belonging to these domains.
              </div>
            </div>

            <div className="space-y-3">
              {loading ? (
                <>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex items-center gap-2 rounded-md border border-bolt-elements-borderColor px-3 py-2 bg-bolt-elements-background-depth-2">
                      <span className="text-bolt-elements-textSecondary select-none">@</span>
                      <Skeleton className="h-6 w-full" />
                    </div>
                    <Skeleton className="h-6 w-8" />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex items-center gap-2 rounded-md border border-bolt-elements-borderColor px-3 py-2 bg-bolt-elements-background-depth-2">
                      <span className="text-bolt-elements-textSecondary select-none">@</span>
                      <Skeleton className="h-6 w-full" />
                    </div>
                    <Skeleton className="h-6 w-8" />
                  </div>
                  <div>
                    <Skeleton className="h-9 6w-40 mt-2" />
                  </div>
                </>
              ) : (
                domains.map((domain, index) => {
                  const showInvalid = touched[index] && domain.trim().length > 0 && !isValidDomain(domain);
                  return (
                    <div key={index} className="flex items-center gap-2">
                      <div
                        className={
                          'flex-1 flex items-center gap-2 rounded-2xl border px-3 py-2 bg-bolt-elements-background-depth-2 ' +
                          (showInvalid
                            ? 'border-red-500 focus-within:border-red-500'
                            : 'border-bolt-elements-borderColor focus-within:border-bolt-elements-focus')
                        }
                      >
                        <span className="text-bolt-elements-textSecondary select-none">@</span>
                        <input
                          type="text"
                          value={domain}
                          onChange={(e) => setDomainAt(index, e.target.value)}
                          onBlur={() => setTouchedAt(index, true)}
                          placeholder="example.com"
                          className={
                            'w-full bg-transparent outline-none text-sm ' +
                            (showInvalid
                              ? 'text-red-600 placeholder-red-400'
                              : 'text-bolt-elements-textPrimary placeholder-bolt-elements-textSecondary')
                          }
                        />
                      </div>
                      {domains.length > 1 && (
                        <button
                          className="h-8 w-8 border-0 text-red-500 bg-transparent items-center justify-center"
                          onClick={() => removeRow(index)}
                          aria-label="Remove domain"
                          type="button"
                          disabled={loading}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
              <div className="ml-4 text-xs text-bolt-elements-textSecondary">
                Enter domains like <span className="font-mono">example.com</span> or{' '}
                <span className="font-mono">team.example.com</span>
              </div>
              {!loading && (
                <div>
                  <button
                    className="mt-1 inline-flex items-center gap-2 px-3 h-9 rounded-xl border border-bolt-elements-borderColor text-bolt-elements-textSecondary bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-background-depth-3 hover:scale-105"
                    onClick={addRow}
                    type="button"
                    disabled={loading}
                  >
                    <Plus size={16} />
                    <span>Add new domain</span>
                  </button>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                className="px-5 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 hover:shadow-md hover:scale-105 active:scale-95"
                onClick={handleSave}
                disabled={loading || saving || !haveAny || !allValid}
              >
                {saving ? 'Saving…' : loading ? 'Loading…' : 'Save'}
              </button>
            </div>
          </div>
        )}
        {getAppMessagesToggleControl()}
      </div>
    </AppCard>
  );
};
