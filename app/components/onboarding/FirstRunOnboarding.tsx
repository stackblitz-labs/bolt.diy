import Cookies from 'js-cookie';
import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogDescription, DialogRoot, DialogTitle } from '~/components/ui/Dialog';
import { getAll, openDatabase } from '~/lib/persistence/db';
import type { MCPConfig } from '~/lib/services/mcpService';
import { useMCPStore } from '~/lib/stores/mcp';
import { DEFAULT_AVATARS, DEFAULT_AVATAR, updateProfile } from '~/lib/stores/profile';
import { setTheme, themeStore } from '~/lib/stores/theme';
import { THEMES, type Theme } from '~/types/theme';
import { PROVIDER_LIST } from '~/utils/constants';

const COMPLETED_KEY = 'bolt_onboarding_completed';
const EMPTY_MCP_CONFIG = { mcpServers: {} };

export function FirstRunOnboarding() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<string>(DEFAULT_AVATAR);
  const [providerName, setProviderName] = useState(PROVIDER_LIST[0]?.name ?? '');
  const [apiKey, setApiKey] = useState('');
  const [mcpText, setMcpText] = useState(JSON.stringify(EMPTY_MCP_CONFIG, null, 2));
  const [selectedTheme, setSelectedTheme] = useState<Theme>(() => themeStore.get());

  const [interfaceOptions, setInterfaceOptions] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('bolt_interface_options') || '{}');
      return {
        accentIntensity: typeof saved.accentIntensity === 'number' ? saved.accentIntensity : 50,
        cornerRadius: ['sharp', 'soft', 'round'].includes(saved.cornerRadius) ? saved.cornerRadius : 'soft',
        compactMode: Boolean(saved.compactMode),
        animatedTransitions: saved.animatedTransitions !== false,
      };
    } catch {
      return { accentIntensity: 50, cornerRadius: 'soft', compactMode: false, animatedTransitions: true };
    }
  });

  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const initializeMcp = useMCPStore((store) => store.initialize);
  const updateMcpSettings = useMCPStore((store) => store.updateSettings);
  const mcpInitialized = useMCPStore((store) => store.isInitialized);
  const stepTitles = useMemo(() => ['Your profile', 'Connect an AI provider', 'MCP servers', 'Appearance'], []);

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
      updateProfile({ username: name.trim(), avatar });
    } else if (step === 0) {
      updateProfile({ avatar });
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

    if (step === 3) {
      setTheme(selectedTheme);
      localStorage.setItem('bolt_interface_options', JSON.stringify(interfaceOptions));

      const root = document.documentElement;
      root.dataset.accentIntensity = String(interfaceOptions.accentIntensity);
      root.style.setProperty('--interface-accent-strength', `${interfaceOptions.accentIntensity}%`);
      root.dataset.cornerRadius = interfaceOptions.cornerRadius;
      root.dataset.compactMode = String(interfaceOptions.compactMode);
      root.dataset.animatedTransitions = String(interfaceOptions.animatedTransitions);
    }

    if (step >= 3) {
      finish();
    } else {
      setStep((current) => current + 1);
    }
  };

  if (!open) {
    return null;
  }

  return (
    <DialogRoot
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          setOpen(true);
        }
      }}
    >
      <Dialog
        className="w-[min(560px,calc(100vw-2rem))] max-h-[90vh] overflow-y-auto bg-bolt-elements-background-depth-1 p-6 text-bolt-elements-textPrimary"
        showCloseButton={false}
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
            Let’s get your workspace ready. Optional details can be left blank and changed later in Settings.
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
            <div>
              <span className="mb-2 block text-sm font-medium">Choose an avatar</span>
              <div className="flex flex-wrap items-center gap-3">
                {DEFAULT_AVATARS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    aria-label={`Use ${preset.name} avatar`}
                    aria-pressed={avatar === preset.src}
                    onClick={() => setAvatar(preset.src)}
                    className={`h-14 w-14 overflow-hidden rounded-full border-2 ${avatar === preset.src ? 'border-bolt-elements-borderColorActive' : 'border-bolt-elements-borderColor'}`}
                  >
                    <img src={preset.src} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
                <label className="flex h-14 cursor-pointer items-center rounded-md border border-dashed border-bolt-elements-borderColor px-3 text-xs text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-2">
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0];

                      if (!file) {
                        return;
                      }

                      if (!file.type.startsWith('image/')) {
                        setError('Choose an image file.');
                        return;
                      }

                      if (file.size > 2 * 1024 * 1024) {
                        setError('Choose an image smaller than 2 MB.');
                        return;
                      }

                      const reader = new FileReader();

                      reader.onload = () => {
                        if (typeof reader.result === 'string') {
                          setAvatar(reader.result);
                          setError('');
                        } else {
                          setError('Could not read that image.');
                        }
                      };
                      reader.onerror = () => setError('Could not read that image.');
                      reader.readAsDataURL(file);
                      event.target.value = '';
                    }}
                  />
                  Upload image
                </label>
                {avatar.startsWith('data:image/') && (
                  <img
                    src={avatar}
                    alt="Uploaded avatar preview"
                    className="h-14 w-14 rounded-full border border-bolt-elements-borderColor object-cover"
                  />
                )}
              </div>
              {error && (
                <p role="alert" className="mt-2 text-xs text-red-500">
                  {error}
                </p>
              )}
            </div>
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

        {step === 3 && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="onboarding-theme">
                Color theme
              </label>
              <select
                id="onboarding-theme"
                value={selectedTheme}
                onChange={(event) => setSelectedTheme(event.target.value as Theme)}
                className="w-full rounded-md border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 px-3 py-2 text-sm"
              >
                {(['light', 'dark'] as const).map((mode) => (
                  <optgroup key={mode} label={`${mode[0].toUpperCase()}${mode.slice(1)} themes`}>
                    {THEMES.filter((theme) => theme.mode === mode).map((theme) => (
                      <option key={theme.id} value={theme.id}>
                        {theme.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div className="rounded-md bg-bolt-elements-background-depth-2 p-3">
              <label className="flex items-center justify-between gap-3 text-sm">
                <span>
                  Accent intensity{' '}
                  <span className="text-bolt-elements-textSecondary">({interfaceOptions.accentIntensity}%)</span>
                </span>
                <input
                  aria-label="Accent intensity"
                  type="range"
                  min="0"
                  max="100"
                  value={interfaceOptions.accentIntensity}
                  onChange={(event) =>
                    setInterfaceOptions({ ...interfaceOptions, accentIntensity: Number(event.target.value) })
                  }
                  className="w-1/2 accent-bolt-elements-borderColorActive"
                />
              </label>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-md bg-bolt-elements-background-depth-2 p-3">
              <span className="text-sm">Corner radius</span>
              <div className="flex gap-1" role="group" aria-label="Corner radius">
                {(['sharp', 'soft', 'round'] as const).map((radius) => (
                  <button
                    key={radius}
                    type="button"
                    aria-pressed={interfaceOptions.cornerRadius === radius}
                    onClick={() => setInterfaceOptions({ ...interfaceOptions, cornerRadius: radius })}
                    className={`appearance-none rounded-md px-2 py-1 text-xs capitalize ${interfaceOptions.cornerRadius === radius ? 'bg-bolt-elements-borderColorActive text-white' : 'bg-bolt-elements-background-depth-1 text-bolt-elements-textSecondary'}`}
                  >
                    {radius}
                  </button>
                ))}
              </div>
            </div>

            {(
              [
                ['compactMode', 'Compact mode', 'Tighter spacing in lists'],
                ['animatedTransitions', 'Animated transitions', 'Smooth theme switching'],
              ] as const
            ).map(([key, label, description]) => (
              <label
                key={key}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-md bg-bolt-elements-background-depth-2 p-3"
              >
                <span>
                  <span className="block text-sm">{label}</span>
                  <span className="text-xs text-bolt-elements-textSecondary">{description}</span>
                </span>
                <input
                  type="checkbox"
                  checked={interfaceOptions[key]}
                  onChange={(event) => setInterfaceOptions({ ...interfaceOptions, [key]: event.target.checked })}
                  className="h-4 w-4 accent-bolt-elements-borderColorActive"
                />
              </label>
            ))}
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <div className="flex gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((current) => current - 1)}
                className="appearance-none rounded-md border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 px-4 py-2 text-sm text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bolt-elements-borderColorActive"
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
              {saving ? 'Saving…' : step === 3 ? 'Finish setup' : 'Continue'}
            </button>
          </div>
        </div>
      </Dialog>
    </DialogRoot>
  );
}
