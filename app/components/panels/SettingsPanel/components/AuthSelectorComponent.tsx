import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Switch } from '~/components/ui/Switch';
import { type AppSummary } from '~/lib/persistence/messageAppSummary';
import { chatStore } from '~/lib/stores/chat';
import { callNutAPI } from '~/lib/replay/NutAPI';
import { toast } from 'react-toastify';
import { assert } from '~/utils/nut';
import { Skeleton } from '~/components/ui/Skeleton';
import { Trash2, Plus, AlertCircle, Info } from 'lucide-react';
import { AuthRequiredSecret } from '~/lib/persistence/messageAppSummary';
import { getAppSetSecrets, setAppSecrets } from '~/lib/replay/Secrets';
import { Button } from '~/components/ui/button';
// import {
//   DropdownMenu,
//   DropdownMenuContent,
//   DropdownMenuItem,
//   DropdownMenuTrigger,
// } from '~/components/ui/dropdown-menu';

interface AuthSelectorComponentProps {
  appSummary: AppSummary;
}

function isValidDomain(domain: string): boolean {
  const value = domain.trim();
  if (value.length === 0) {
    return false;
  }
  if (value.includes('://') || value.includes('/') || value.includes(' ')) {
    return false;
  }
  const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
  return domainRegex.test(value);
}

// type AccessType = 'private' | 'public';

export const AuthSelectorComponent: React.FC<AuthSelectorComponentProps> = ({ appSummary }) => {
  const appId = chatStore.currentAppId.get();
  assert(appId, 'App ID is required');

  const [saving, setSaving] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  // const [accessType, setAccessType] = useState<AccessType>('private');
  const [restrictedAccess, setRestrictedAccess] = useState(false);
  const [showRestrictedManage, setShowRestrictedManage] = useState(false);

  // Domain management state
  const [domains, setDomains] = useState<string[]>(['']);
  const [touched, setTouched] = useState<boolean[]>([false]);
  const [loading, setLoading] = useState(false);
  // const dropdownTriggerRef = useRef<HTMLButtonElement>(null);
  // const [dropdownWidth, setDropdownWidth] = useState<number | undefined>(undefined);

  useEffect(() => {
    const fetchAuthRequired = async () => {
      const appSetSecrets = await getAppSetSecrets(appId);
      setAuthRequired(appSetSecrets.includes(AuthRequiredSecret));
    };
    fetchAuthRequired();
  }, [appSummary, appId]);

  useEffect(() => {
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
          setRestrictedAccess(true);
        } else {
          setDomains(['']);
          setTouched([false]);
        }
      } catch (error) {
        setDomains(['']);
        setTouched([false]);
        console.error('Failed to fetch allowed domains', error);
      } finally {
        setLoading(false);
      }
    })();
  }, [appId]);

  const haveAny = useMemo(() => domains.some((d) => d.trim().length > 0), [domains]);
  const allValid = useMemo(() => domains.filter((d) => d.trim().length > 0).every((d) => isValidDomain(d)), [domains]);

  const handleAuthToggle = async () => {
    setSaving(true);
    try {
      await setAppSecrets(appId, [
        {
          key: AuthRequiredSecret,
          value: authRequired ? undefined : 'true',
        },
      ]);
      setAuthRequired(!authRequired);
      toast.success('Authentication settings updated');
    } catch (error) {
      toast.error('Failed to update authentication settings');
      console.error('Failed to update authentication settings:', error);
    } finally {
      setSaving(false);
    }
  };

  // const handleAccessTypeChange = (type: AccessType) => {
  //   setAccessType(type);
  // };

  const handleRestrictedAccessToggle = () => {
    if (!authRequired) {
      toast.info('Enable "Require Logging in" first');
      return;
    }
    setRestrictedAccess(!restrictedAccess);
    if (!restrictedAccess) {
      setShowRestrictedManage(true);
    }
  };

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

  const handleSaveDomains = useCallback(async () => {
    if (!haveAny || !allValid) {
      return;
    }
    setSaving(true);
    try {
      const cleaned = domains.map((d) => d.trim()).filter((d) => d.length > 0);
      const { deploySettings } = await callNutAPI('get-app-deploy-settings', { appId });
      const newDeploySettings = { ...(deploySettings || {}), authAllowList: cleaned };
      await callNutAPI('set-app-deploy-settings', { appId, deploySettings: newDeploySettings });
      toast.success('Allowed domains updated');
      setShowRestrictedManage(false);
    } catch (error) {
      console.error('Failed to save allowed domains', error);
      toast.error('Failed to save allowed domains');
    } finally {
      setSaving(false);
    }
  }, [haveAny, allValid, domains, appId]);

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div>
        <h3 className="text-base font-semibold text-bolt-elements-textPrimary">Application Visibility & Permissions</h3>
        <p className="text-sm text-bolt-elements-textSecondary mt-1">
          Control who can view or access your application.
        </p>
      </div>

      {/* Application Access Dropdown */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-bolt-elements-textPrimary">Application Access</label>
        {/* <DropdownMenu
          onOpenChange={(open) => {
            if (open && dropdownTriggerRef.current) {
              setDropdownWidth(dropdownTriggerRef.current.offsetWidth);
            }
          }}
        >
          <DropdownMenuTrigger asChild>
            <Button
              ref={dropdownTriggerRef}
              variant="outline"
              className="w-full justify-between h-10 text-sm font-normal"
            >
              <span className="flex items-center gap-2">
                {accessType === 'private' ? <Lock size={16} className="text-bolt-elements-textSecondary" /> : <Globe size={16} className="text-bolt-elements-textSecondary" />}
                {accessType === 'private' ? 'Private' : 'Public'}
              </span>
              <ChevronDown size={16} className="text-bolt-elements-textSecondary" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-[200px]"
            style={dropdownWidth ? { width: `${dropdownWidth}px` } : undefined}
          >
            <DropdownMenuItem onClick={() => handleAccessTypeChange('private')}>
              <Lock size={16} className="mr-2" />
              Private
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleAccessTypeChange('public')}>
              <Globe size={16} className="mr-2" />
              Public
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu> */}
        <p className="text-sm text-bolt-elements-textSecondary">
          Define whenever this application is public or has limited access
        </p>
      </div>

      {/* Require Logging in */}
      <div className="flex items-start gap-3">
        <Switch checked={authRequired} onCheckedChange={!saving ? handleAuthToggle : undefined} className="mt-0.5" />
        <div className="flex-1">
          <h4 className="text-sm font-medium text-bolt-elements-textPrimary">Require Logging in</h4>
          <p className="text-sm text-bolt-elements-textSecondary">
            Visitors are required sign up and login in order to access this application
          </p>
        </div>
      </div>

      {/* Restricted Access */}
      <div className="flex items-start gap-3">
        <Switch checked={restrictedAccess} onCheckedChange={handleRestrictedAccessToggle} className="mt-0.5" />
        <div className="flex-1">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h4
                className={`text-sm font-medium ${authRequired ? 'text-bolt-elements-textPrimary' : 'text-bolt-elements-textSecondary'}`}
              >
                Restricted Access
              </h4>
              <p
                className={`text-sm ${authRequired ? 'text-bolt-elements-textSecondary' : 'text-bolt-elements-textTertiary'}`}
              >
                Only whitelisted emails and domains will be able to access and sign up to this application.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRestrictedManage(!showRestrictedManage)}
              disabled={!authRequired || !restrictedAccess}
              className="shrink-0"
            >
              Manage
            </Button>
          </div>
        </div>
      </div>

      {/* Domain Management Panel */}
      {showRestrictedManage && authRequired && restrictedAccess && (
        <div className="mt-4 p-4 bg-bolt-elements-background-depth-1 rounded-lg border border-bolt-elements-borderColor space-y-4">
          <div>
            <h4 className="text-sm font-medium text-bolt-elements-textPrimary mb-1">Allowed Domains</h4>
            <p className="text-xs text-bolt-elements-textSecondary">
              Users can sign in only with emails belonging to these domains.
            </p>
          </div>

          <div className="space-y-2">
            {loading ? (
              <>
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-2 rounded-lg border border-bolt-elements-borderColor px-3 py-2 bg-background">
                    <span className="text-bolt-elements-textSecondary text-sm">@</span>
                    <Skeleton className="h-5 flex-1" />
                  </div>
                  <Skeleton className="h-9 w-9 rounded-lg" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-2 rounded-lg border border-bolt-elements-borderColor px-3 py-2 bg-background">
                    <span className="text-bolt-elements-textSecondary text-sm">@</span>
                    <Skeleton className="h-5 flex-1" />
                  </div>
                  <Skeleton className="h-9 w-9 rounded-lg" />
                </div>
              </>
            ) : (
              <>
                {domains.map((domain, index) => {
                  const showInvalid = touched[index] && domain.trim().length > 0 && !isValidDomain(domain);
                  const isValid = domain.trim().length > 0 && isValidDomain(domain);
                  return (
                    <div key={index} className="flex items-center gap-2">
                      <div
                        className={`flex-1 flex items-center gap-2 rounded-lg border px-3 py-2 bg-background transition-all ${
                          showInvalid
                            ? 'border-red-500/60 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-500/20'
                            : isValid
                              ? 'border-green-500/40 focus-within:border-green-500/60'
                              : 'border-bolt-elements-borderColor focus-within:border-bolt-elements-focus focus-within:ring-2 focus-within:ring-bolt-elements-focus/20'
                        }`}
                      >
                        <span
                          className={`text-sm ${showInvalid ? 'text-red-500' : isValid ? 'text-green-500' : 'text-bolt-elements-textSecondary'}`}
                        >
                          @
                        </span>
                        <input
                          type="text"
                          value={domain}
                          onChange={(e) => setDomainAt(index, e.target.value)}
                          onBlur={() => setTouchedAt(index, true)}
                          placeholder="example.com"
                          className={`flex-1 bg-transparent outline-none text-sm transition-colors ${
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
                        {showInvalid && <AlertCircle className="flex-shrink-0 text-red-500" size={14} />}
                      </div>
                      {domains.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeRow(index)}
                          className="h-9 w-9 p-0 text-bolt-elements-textSecondary hover:text-red-500"
                          disabled={loading}
                        >
                          <Trash2 size={14} />
                        </Button>
                      )}
                    </div>
                  );
                })}

                <div className="flex items-start gap-2 pt-1">
                  <Info className="text-bolt-elements-textSecondary flex-shrink-0 mt-0.5" size={12} />
                  <p className="text-xs text-bolt-elements-textSecondary leading-relaxed">
                    Enter domains like <span className="font-mono text-bolt-elements-textPrimary">example.com</span> or{' '}
                    <span className="font-mono text-bolt-elements-textPrimary">team.example.com</span>
                  </p>
                </div>

                {!loading && (
                  <Button variant="outline" size="sm" onClick={addRow} className="gap-1" disabled={loading}>
                    <Plus size={14} />
                    Add domain
                  </Button>
                )}
              </>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-bolt-elements-borderColor">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRestrictedManage(false)}
              disabled={loading || saving}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveDomains} disabled={loading || saving || !haveAny || !allValid}>
              {saving ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Saving...
                </span>
              ) : loading ? (
                'Loading...'
              ) : (
                'Save Domains'
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
