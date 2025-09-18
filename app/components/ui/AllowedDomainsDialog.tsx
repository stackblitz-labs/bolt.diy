import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Dialog, DialogButton, DialogDescription, DialogRoot, DialogTitle } from '~/components/ui/Dialog';
import { chatStore } from '~/lib/stores/chat';
import { assert } from '~/utils/nut';
import { callNutAPI } from '~/lib/replay/NutAPI';
import { toast } from 'react-toastify';
import { Skeleton } from '~/components/ui/Skeleton';

interface AllowedDomainsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export const AllowedDomainsDialog: React.FC<AllowedDomainsDialogProps> = ({ open, onOpenChange }) => {
  const appId = chatStore.currentAppId.get();
  assert(appId, 'App ID is required');

  const [domains, setDomains] = useState<string[]>(['']);
  const [touched, setTouched] = useState<boolean[]>([false]);
  const [saving, setSaving] = useState(false);
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

  const handleClose = useCallback(() => {
    onOpenChange(false);
    // Reset state when closing
    setDomains(['']);
    setTouched([false]);
    setSaving(false);
  }, [onOpenChange]);

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
      handleClose();
    } catch (error) {
      console.error('Failed to save allowed domains', error);
      toast.error('Failed to save allowed domains');
      setSaving(false);
    }
  }, [haveAny, allValid, domains, appId, handleClose]);

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      {open && (
        <Dialog onClose={handleClose}>
          <div className="p-5 space-y-4">
            <div>
              <DialogTitle>Set Allowed Domains</DialogTitle>
              <DialogDescription>Users can sign in only with emails belonging to these domains.</DialogDescription>
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
                          'flex-1 flex items-center gap-2 rounded-md border px-3 py-2 bg-bolt-elements-background-depth-2 ' +
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
                          <div className="i-ph:minus" />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
              {!loading && (
                <div>
                  <button
                    className="mt-1 inline-flex items-center gap-2 px-3 h-9 rounded-md border border-bolt-elements-borderColor text-bolt-elements-textSecondary bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-background-depth-3"
                    onClick={addRow}
                    type="button"
                    disabled={loading}
                  >
                    <div className="i-ph:plus" />
                    <span>Add new domain</span>
                  </button>
                </div>
              )}
              <div className="text-xs text-bolt-elements-textSecondary">
                Enter domains like <span className="font-mono">example.com</span> or{' '}
                <span className="font-mono">team.example.com</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <DialogButton type="secondary" onClick={handleClose} disabled={saving}>
                Cancel
              </DialogButton>
              <DialogButton type="primary" onClick={handleSave} disabled={loading || saving || !haveAny || !allValid}>
                {saving ? 'Saving…' : loading ? 'Loading…' : 'Save'}
              </DialogButton>
            </div>
          </div>
        </Dialog>
      )}
    </DialogRoot>
  );
};

export default AllowedDomainsDialog;
