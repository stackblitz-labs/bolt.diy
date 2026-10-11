import Cookies from 'js-cookie';
import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogDescription, DialogRoot, DialogTitle } from '~/components/ui/Dialog';
import { getAll, openDatabase } from '~/lib/persistence/db';
import type { MCPConfig } from '~/lib/services/mcpService';
import { useMCPStore } from '~/lib/stores/mcp';
import { updateProfile } from '~/lib/stores/profile';
import { PROVIDER_LIST } from '~/utils/constants';

const COMPLETED_KEY = 'bolt_onboarding_completed';
const EMPTY_MCP_CONFIG = { mcpServers: {} };

export function FirstRunOnboarding() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [providerName, setProviderName] = useState(PROVIDER_LIST[0]?.name ?? '');
  const [apiKey, setApiKey] = useState('');
  const [mcpText, setMcpText] = useState(JSON.stringify(EMPTY_MCP_CONFIG, null, 2));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const initializeMcp = useMCPStore((store) => store.initialize);
  const updateMcpSettings = useMCPStore((store) => store.updateSettings);
  const mcpInitialized = useMCPStore((store) => store.isInitialized);
  const stepTitles = useMemo(() => ['Your profile', 'Connect an AI provider', 'MCP servers'], []);

  useEffect(() => {
    let active = true;

    const checkFirstRun = async () => {
      if (localStorage.getItem(COMPLETED_KEY)) {
        return;
      }

      try {
        const storedProfile = localStorage.getItem('bolt_profile');
        const profile = storedProfile ? (JSON.parse(storedProfile) as { username?: string }) : undefined;

        const hasExistingSetup = Boolean(
          profile?.username ||
          localStorage.getItem('bolt_theme') ||
          localStorage.getItem('provider_settings') ||
          localStorage.getItem('bolt_user_profile') ||
          Cookies.get('apiKeys'),
        );

        const db = await openDatabase();
        const existingChats = db ? await getAll(db) : [];
        db?.close();

        if (!active) {
          return;
        }

        if (hasExistingSetup || existingChats.length > 0) {
          localStorage.setItem(COMPLETED_KEY, 'true');
          return;
        }

        setOpen(true);
      } catch (err) {
        console.error('Could not check first-run setup state:', err);

        if (active) {
          setOpen(true);
        }
      }
    };
    void checkFirstRun();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (open && !mcpInitialized) {
      void initializeMcp();
    }
  }, [open, mcpInitialized, initializeMcp]);

  const finish = () => {
    localStorage.setItem(COMPLETED_KEY, 'true');
    setOpen(false);
  };

  const saveApiKey = () => {
    const current = Cookies.get('apiKeys');

    let keys: Record<string, string> = {};

    try {
      keys = current ? (JSON.parse(current) as Record<string, string>) : {};
    } catch {
      keys = {};
    }

    if (providerName && apiKey.trim()) {
      Cookies.set('apiKeys', JSON.stringify({ ...keys, [providerName]: apiKey.trim() }), { expires: 365 });
    }
  };

  const next = async () => {
    setError('');

    if (step === 0 && name.trim()) {
      updateProfile({ username: name.trim() });
    }

    if (step === 1) {
      saveApiKey();
    }

    if (step === 2) {
      try {
        const config = JSON.parse(mcpText) as MCPConfig;

        if (!config || typeof config.mcpServers !== 'object' || config.mcpServers === null) {
          throw new Error('Configuration must include an mcpServers object.');
        }

        setSaving(true);
        await updateMcpSettings({ mcpConfig: config, maxLLMSteps: useMCPStore.getState().settings.maxLLMSteps });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save MCP configuration.');
        setSaving(false);

        return;
      }
      setSaving(false);
    }

    if (step >= 2) {
      finish();
    } else {
      setStep((current) => current + 1);
    }
  };

  if (!open) {
    return null;
  }

  return (
    <DialogRoot open={open} onOpenChange={(nextOpen) => !nextOpen && finish()}>
      <Dialog
        className="w-[min(560px,calc(100vw-2rem))] max-h-[90vh] overflow-y-auto bg-bolt-elements-background-depth-1 p-6 text-bolt-elements-textPrimary"
        onClose={finish}
        onBackdrop={finish}
      >
        <div className="mb-5">
          <div className="mb-2 text-xs font-medium text-bolt-elements-textSecondary">
            Step {step + 1} of {stepTitles.length}
          </div>
          <div className="mb-3 flex gap-1" aria-hidden="true">
            {stepTitles.map((title, index) => (
              <span
                key={title}
                className={`h-1.5 flex-1 rounded-full ${index <= step ? 'bg-bolt-elements-borderColorActive' : 'bg-bolt-elements-background-depth-3'}`}
              />
            ))}
          </div>
          <DialogTitle className="text-xl font-semibold">Welcome to Bolt</DialogTitle>
          <DialogDescription className="mt-1 text-sm text-bolt-elements-textSecondary">
            Let’s get your workspace ready. You can skip any step and change these settings later.
          </DialogDescription>
        </div>

        {step === 0 && (
          <div className="space-y-3">
            <label className="block text-sm font-medium" htmlFor="onboarding-name">
              What should we call you?
            </label>
            <input
              id="onboarding-name"
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
              className="w-full rounded-md border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 px-3 py-2 text-sm outline-none focus:border-bolt-elements-borderColorActive"
            />
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <p className="text-sm text-bolt-elements-textSecondary">
              Choose a provider and add its API key to start building. You can also skip this and use a locally
              configured provider.
            </p>
            <label className="block text-sm font-medium" htmlFor="onboarding-provider">
              AI provider
            </label>
            <select
              id="onboarding-provider"
              value={providerName}
              onChange={(event) => setProviderName(event.target.value)}
              className="w-full rounded-md border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 px-3 py-2 text-sm"
            >
              {PROVIDER_LIST.map((provider) => (
                <option key={provider.name} value={provider.name}>
                  {provider.name}
                </option>
              ))}
            </select>
            <label className="block text-sm font-medium" htmlFor="onboarding-api-key">
              API key
            </label>
            <input
              id="onboarding-api-key"
              type="password"
              autoComplete="new-password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="Paste your API key"
              className="w-full rounded-md border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 px-3 py-2 text-sm outline-none focus:border-bolt-elements-borderColorActive"
            />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <p className="text-sm text-bolt-elements-textSecondary">
              Add MCP server configuration as JSON. You can leave this empty and set it up later in Settings.
            </p>
            <label className="block text-sm font-medium" htmlFor="onboarding-mcp">
              MCP configuration
            </label>
            <textarea
              id="onboarding-mcp"
              spellCheck={false}
              value={mcpText}
              onChange={(event) => setMcpText(event.target.value)}
              rows={9}
              className="w-full resize-y rounded-md border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 px-3 py-2 font-mono text-xs outline-none focus:border-bolt-elements-borderColorActive"
            />
            {error && (
              <p role="alert" className="text-sm text-red-500">
                {error}
              </p>
            )}
          </div>
        )}

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={finish}
            className="text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary"
          >
            Skip setup
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((current) => current - 1)}
                className="rounded-md border border-bolt-elements-borderColor px-4 py-2 text-sm"
              >
                Back
              </button>
            )}
            <button
              type="button"
              disabled={saving}
              onClick={() => void next()}
              className="rounded-md bg-bolt-elements-borderColorActive px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {saving ? 'Saving…' : step === 2 ? 'Finish setup' : 'Continue'}
            </button>
          </div>
        </div>
      </Dialog>
    </DialogRoot>
  );
}
