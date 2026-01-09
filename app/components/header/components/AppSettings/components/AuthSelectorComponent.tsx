import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppCard } from '~/components/chat/Messages/components/AppCard';
import { Switch } from '~/components/ui/Switch';
import { type AppSummary } from '~/lib/persistence/messageAppSummary';
import { chatStore } from '~/lib/stores/chat';
import { callNutAPI } from '~/lib/replay/NutAPI';
import { toast } from 'react-toastify';
import { assert } from '~/utils/nut';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import WithTooltip from '~/components/ui/Tooltip';
import { Skeleton } from '~/components/ui/Skeleton';
import { Globe, Lock, Trash2, Plus, ShieldCheck, KeyRound, AlertCircle, Info } from '~/components/ui/Icon';
import { AuthRequiredSecret } from '~/lib/persistence/messageAppSummary';
import { getAppSetSecrets, setAppSecrets } from '~/lib/replay/Secrets';

interface AuthSelectorComponentProps {
  appSummary: AppSummary;
}

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
  const appId = chatStore.currentAppId.get();
  assert(appId, 'App ID is required');

  console.log('appSummary', appSummary);

  const [saving, setSaving] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);

  useEffect(() => {
    const fetchAuthRequired = async () => {
      const appSetSecrets = await getAppSetSecrets(appId);
      setAuthRequired(appSetSecrets.includes(AuthRequiredSecret));
    };
    fetchAuthRequired();
  }, [appSummary]);

  const handleAuthToggle = async () => {
    setSaving(true);

    try {
      await setAppSecrets(appId, [
        {
          key: AuthRequiredSecret,
          value: authRequired ? undefined : 'true',
        },
      ]);

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

  return (
    <AppCard
      title="Authentication Settings"
      description={getDescription()}
      icon={<ShieldCheck className="text-white" size={18} />}
      iconColor="indigo"
      status={null}
      progressText="Configured"
    >
      <div className="space-y-3">
        {getAuthToggleControl()}
        {authRequired && (
          <div className="p-5 space-y-5 bg-bolt-elements-background-depth-1 rounded-xl border border-bolt-elements-borderColor/50">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br from-indigo-500/20 to-blue-500/20 border border-indigo-500/30">
                <KeyRound className="text-indigo-500" size={18} />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-bolt-elements-textHeading mb-1.5">Set Allowed Domains</h3>
                <p className="text-xs text-bolt-elements-textSecondary leading-relaxed">
                  Users can sign in only with emails belonging to these domains.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {loading ? (
                <>
                  <div className="flex items-center gap-2.5">
                    <div className="flex-1 flex items-center gap-2.5 rounded-xl border border-bolt-elements-borderColor px-4 py-2.5 bg-bolt-elements-background-depth-2">
                      <span className="text-bolt-elements-textSecondary select-none text-sm font-medium">@</span>
                      <Skeleton className="h-5 w-full" />
                    </div>
                    <Skeleton className="h-9 w-9 rounded-lg" />
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="flex-1 flex items-center gap-2.5 rounded-xl border border-bolt-elements-borderColor px-4 py-2.5 bg-bolt-elements-background-depth-2">
                      <span className="text-bolt-elements-textSecondary select-none text-sm font-medium">@</span>
                      <Skeleton className="h-5 w-full" />
                    </div>
                    <Skeleton className="h-9 w-9 rounded-lg" />
                  </div>
                  <div>
                    <Skeleton className="h-10 w-32 rounded-xl" />
                  </div>
                </>
              ) : (
                <>
                  {domains.map((domain, index) => {
                    const showInvalid = touched[index] && domain.trim().length > 0 && !isValidDomain(domain);
                    const isValid = domain.trim().length > 0 && isValidDomain(domain);
                    return (
                      <div key={index} className="flex items-center gap-2.5">
                        <div
                          className={`group flex-1 flex items-center gap-2.5 rounded-xl border px-4 py-2.5 bg-bolt-elements-background-depth-2 transition-all duration-200 ${
                            showInvalid
                              ? 'border-red-500/60 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-500/20'
                              : isValid
                                ? 'border-green-500/40 focus-within:border-green-500/60'
                                : 'border-bolt-elements-borderColor focus-within:border-bolt-elements-focus focus-within:ring-2 focus-within:ring-bolt-elements-focus/20'
                          }`}
                        >
                          <span
                            className={`select-none text-sm font-medium transition-colors ${
                              showInvalid
                                ? 'text-red-500'
                                : isValid
                                  ? 'text-green-500'
                                  : 'text-bolt-elements-textSecondary group-focus-within:text-bolt-elements-textPrimary'
                            }`}
                          >
                            @
                          </span>
                          <input
                            type="text"
                            value={domain}
                            onChange={(e) => setDomainAt(index, e.target.value)}
                            onBlur={() => setTouchedAt(index, true)}
                            placeholder="example.com"
                            className={`w-full bg-transparent outline-none border-none focus:ring-0 text-sm transition-colors ${
                              showInvalid
                                ? 'text-red-600 placeholder-red-400/60'
                                : isValid
                                  ? 'text-bolt-elements-textPrimary placeholder-bolt-elements-textSecondary/50'
                                  : 'text-bolt-elements-textPrimary placeholder-bolt-elements-textSecondary'
                            }`}
                          />
                          {isValid && (
                            <div className="flex-shrink-0 w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center">
                              <div className="w-2 h-2 rounded-full bg-green-500" />
                            </div>
                          )}
                          {showInvalid && <AlertCircle className="flex-shrink-0 text-red-500" size={16} />}
                        </div>
                        {domains.length > 1 && (
                          <button
                            className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-bolt-elements-textSecondary hover:text-red-500 bg-bolt-elements-background-depth-2 hover:bg-red-500/10 border border-bolt-elements-borderColor hover:border-red-500/40 transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
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
                  })}
                  <div className="flex items-start gap-2 pt-1">
                    <Info className="text-bolt-elements-textSecondary flex-shrink-0 mt-0.5" size={14} />
                    <p className="text-xs text-bolt-elements-textSecondary leading-relaxed">
                      Enter domains like <span className="font-mono text-bolt-elements-textPrimary">example.com</span>{' '}
                      or <span className="font-mono text-bolt-elements-textPrimary">team.example.com</span>
                    </p>
                  </div>
                  {!loading && (
                    <button
                      className="inline-flex items-center gap-2 px-4 h-10 rounded-xl border border-bolt-elements-borderColor text-bolt-elements-textSecondary bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-background-depth-3 hover:text-bolt-elements-textPrimary hover:border-bolt-elements-focus/60 transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                      onClick={addRow}
                      type="button"
                      disabled={loading}
                    >
                      <Plus size={16} />
                      <span className="text-sm font-medium">Add new domain</span>
                    </button>
                  )}
                </>
              )}
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-bolt-elements-borderColor/50">
              <button
                className="px-6 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-indigo-500 to-blue-600 text-white hover:from-indigo-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 hover:shadow-md hover:scale-105 active:scale-95 disabled:hover:scale-100"
                onClick={handleSave}
                disabled={loading || saving || !haveAny || !allValid}
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Saving…
                  </span>
                ) : loading ? (
                  'Loading…'
                ) : (
                  'Save Domains'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </AppCard>
  );
};
