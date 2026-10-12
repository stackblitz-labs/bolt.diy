import * as RadixDialog from '@radix-ui/react-dialog';
import {
  Blocks,
  ChevronLeft,
  Download,
  ExternalLink,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  Wrench,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getPluginToolName } from '~/lib/plugins/adapters';
import type { MarketplaceSnapshot, MarketplacePlugin } from '~/lib/plugins/marketplace';
import { pluginCategorySchema, pluginManifestSchema, type PluginManifest } from '~/lib/plugins/schema';
import {
  createDraftManifest,
  exportPluginDraft,
  fetchMarketplaceChangelog,
  installFromMarketplace,
  installLocalPackage,
  loadMarketplace,
  getPluginUpdates,
} from '~/lib/plugins/service';
import { usePluginStore } from '~/lib/stores/plugins';
import { classNames } from '~/utils/classNames';

type View = 'marketplace' | 'installed' | 'updates' | 'develop';
type DetailTab = 'overview' | 'settings' | 'permissions' | 'logs';
type Draft = {
  id: string;
  name: string;
  description: string;
  publisher: string;
  license: string;
  category: PluginManifest['category'];
  version: string;
};

const MARKETPLACE_URL = 'https://github.com/dustinwloring1988/bolt-marketplace';
const CATEGORIES = pluginCategorySchema.options;

const buttonClass =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-bolt-elements-borderColor px-3 py-2 text-sm font-medium text-bolt-elements-textPrimary transition-colors hover:bg-bolt-elements-background-depth-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 disabled:cursor-not-allowed disabled:opacity-50';
const primaryButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-purple-500 bg-purple-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 disabled:cursor-not-allowed disabled:opacity-50';
const inputClass =
  'w-full rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 px-3 py-2 text-sm text-bolt-elements-textPrimary outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20';

function ErrorMessage({ message }: { message: string }) {
  return (
    <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">
      {message}
    </div>
  );
}

function CategoryPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-bolt-elements-borderColor px-2.5 py-1 text-xs text-bolt-elements-textSecondary">
      {children}
    </span>
  );
}

function PluginCard({
  plugin,
  onOpen,
  installed,
  updateAvailable,
}: {
  plugin: MarketplacePlugin;
  onOpen: () => void;
  installed: boolean;
  updateAvailable: boolean;
}) {
  const manifest = plugin.manifest;

  return (
    <article className="flex min-h-[220px] flex-col rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 p-4 transition-colors hover:border-purple-500/50">
      <button
        type="button"
        onClick={onOpen}
        className="flex flex-1 items-start gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-purple-500/20 bg-purple-500/10 text-purple-400">
          <Blocks className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="block truncate font-semibold text-bolt-elements-textPrimary">{manifest.name}</span>
          <span className="mt-0.5 block text-xs text-bolt-elements-textTertiary">
            {manifest.publisher} · v{manifest.version}
          </span>
          <span className="mt-3 line-clamp-3 block text-sm leading-5 text-bolt-elements-textSecondary">
            {manifest.description}
          </span>
        </span>
      </button>
      <div className="mt-4 flex items-center justify-between gap-2">
        <CategoryPill>{manifest.category}</CategoryPill>
        <span className="text-xs text-bolt-elements-textTertiary">
          {updateAvailable ? 'Update available' : installed ? 'Installed' : ''}
        </span>
        <button type="button" onClick={onOpen} className={buttonClass}>
          {installed ? 'Manage' : 'Details'}
        </button>
      </div>
    </article>
  );
}

export default function PluginTab() {
  const plugins = usePluginStore((state) => state.plugins);
  const storeBusy = usePluginStore((state) => state.busy);
  const storeError = usePluginStore((state) => state.error);
  const initialize = usePluginStore((state) => state.initialize);
  const setEnabled = usePluginStore((state) => state.setEnabled);
  const setConfiguration = usePluginStore((state) => state.setConfiguration);
  const uninstall = usePluginStore((state) => state.uninstall);
  const rollback = usePluginStore((state) => state.rollback);
  const loadLogs = usePluginStore((state) => state.loadLogs);
  const logs = usePluginStore((state) => state.logs);
  const importInput = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<View>('marketplace');
  const [snapshot, setSnapshot] = useState<MarketplaceSnapshot | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All categories');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('overview');

  const [installTarget, setInstallTarget] = useState<{
    pluginId: string;
    version: MarketplacePlugin['versions'][number];
  } | null>(null);

  const [changelogText, setChangelogText] = useState<string>();
  const [changelogLoading, setChangelogLoading] = useState(false);
  const [changelogError, setChangelogError] = useState<string | null>(null);
  const changelogRequestRef = useRef(0);

  const [operationError, setOperationError] = useState<string | null>(null);
  const [draftStep, setDraftStep] = useState(0);

  const [draft, setDraft] = useState<Draft>({
    id: 'boltdiy.text-utilities',
    name: 'Text Utilities',
    description: 'Count and transform text with deterministic tools.',
    publisher: 'Bolt.diy',
    license: 'MIT',
    category: 'Productivity',
    version: '1.0.0',
  });

  const [draftTools, setDraftTools] = useState<PluginManifest['tools']>(['count', 'transform']);

  const refreshCatalog = useCallback(async () => {
    setLoadingCatalog(true);
    setCatalogError(null);

    try {
      setSnapshot(await loadMarketplace());
    } catch (error) {
      setCatalogError(error instanceof Error ? error.message : 'Could not load the marketplace.');
    } finally {
      setLoadingCatalog(false);
    }
  }, []);

  useEffect(() => {
    void initialize();
    void refreshCatalog();
  }, [initialize, refreshCatalog]);

  const updates = useMemo(() => getPluginUpdates(snapshot, plugins), [snapshot, plugins]);
  const catalogPlugins = snapshot?.plugins ?? [];

  const installedAsPlugins = plugins.flatMap((record) => {
    const parsed = pluginManifestSchema.safeParse(record.manifest);

    return parsed.success ? [{ id: record.id, manifest: parsed.data, versions: [] }] : [];
  });
  const displayedPlugins = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    const sourcePlugins = view === 'installed' ? installedAsPlugins : catalogPlugins;

    return sourcePlugins.filter((plugin) => {
      const matchesSearch =
        !normalizedSearch ||
        [plugin.manifest.name, plugin.manifest.description, plugin.manifest.publisher].some((value) =>
          value.toLowerCase().includes(normalizedSearch),
        );

      const matchesCategory = category === 'All categories' || plugin.manifest.category === category;
      const matchesUpdates = view !== 'updates' || updates.some((update) => update.pluginId === plugin.id);

      return matchesSearch && matchesCategory && matchesUpdates;
    });
  }, [catalogPlugins, installedAsPlugins, search, category, view, updates]);

  const selectedInstalled = plugins.find((plugin) => plugin.id === selectedId);
  const selectedMarketplace = catalogPlugins.find((plugin) => plugin.id === selectedId);
  const selectedUpdate = updates.find((update) => update.pluginId === selectedId);
  const selectedManifest = (selectedInstalled?.manifest as PluginManifest | undefined) ?? selectedMarketplace?.manifest;

  useEffect(() => {
    if (selectedId && detailTab === 'logs') {
      void loadLogs(selectedId);
    }
  }, [selectedId, detailTab, loadLogs]);

  async function runOperation(operation: () => Promise<void>) {
    setOperationError(null);

    try {
      await operation();
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : 'Plugin operation failed.');
    }
  }

  async function handleImport(file?: File) {
    if (!file) {
      return;
    }

    setOperationError(null);

    try {
      await installLocalPackage(file);
      setView('installed');
      setSelectedId(null);
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : 'Could not import this plugin package.');
    }
  }

  async function handleExportDraft() {
    setOperationError(null);

    try {
      const manifest = createDraftManifest({ ...draft, tools: draftTools });
      await exportPluginDraft(manifest);
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : 'Draft details are invalid.');
    }
  }

  function goBack() {
    setSelectedId(null);
    setDetailTab('overview');
    setOperationError(null);
  }

  async function openInstallConfirmation(pluginId: string, version: MarketplacePlugin['versions'][number]) {
    const requestId = ++changelogRequestRef.current;
    setInstallTarget({ pluginId, version });
    setChangelogText(undefined);
    setChangelogError(null);

    if (!snapshot || !version.changelogPath) {
      setChangelogLoading(false);
      return;
    }

    setChangelogLoading(true);

    try {
      const text = await fetchMarketplaceChangelog(snapshot, version);

      if (requestId === changelogRequestRef.current) {
        setChangelogText(text);
      }
    } catch (error) {
      if (requestId === changelogRequestRef.current) {
        setChangelogError(error instanceof Error ? error.message : 'Could not load this release changelog.');
      }
    } finally {
      if (requestId === changelogRequestRef.current) {
        setChangelogLoading(false);
      }
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-8">
      <input
        ref={importInput}
        type="file"
        accept=".zip,application/zip,application/x-zip-compressed"
        className="sr-only"
        aria-label="Select a plugin ZIP package"
        onChange={(event) => {
          void handleImport(event.target.files?.[0]);
          event.currentTarget.value = '';
        }}
      />

      {selectedManifest && selectedId ? (
        <PluginDetails
          manifest={selectedManifest}
          installed={selectedInstalled}
          detailTab={detailTab}
          setDetailTab={setDetailTab}
          onBack={goBack}
          logs={logs[selectedId] ?? []}
          busy={storeBusy}
          onEnabled={(enabled) => runOperation(() => setEnabled(selectedId, enabled))}
          onUninstall={() => {
            if (window.confirm(`Uninstall ${selectedManifest.name}? Its plugin settings will be removed.`)) {
              void runOperation(async () => {
                await uninstall(selectedId);
                goBack();
              });
            }
          }}
          onRollback={() => runOperation(() => rollback(selectedId))}
          onConfiguration={(configuration) => runOperation(() => setConfiguration(selectedId, configuration))}
          onToolEnabled={(tool, enabled) =>
            runOperation(() =>
              setConfiguration(selectedId, {
                ...selectedInstalled?.configuration,
                [`toolDisabled:${tool}`]: !enabled,
              }),
            )
          }
          onUpdate={
            selectedMarketplace && selectedInstalled && selectedUpdate
              ? () => void openInstallConfirmation(selectedMarketplace.id, selectedUpdate.version)
              : undefined
          }
          onInstall={
            selectedMarketplace && !selectedInstalled
              ? () => {
                  const version = selectedMarketplace.versions.find(
                    (candidate) => candidate.version === selectedMarketplace.manifest.version,
                  );

                  if (version) {
                    void openInstallConfirmation(selectedMarketplace.id, version);
                  }
                }
              : undefined
          }
          error={operationError ?? storeError}
        />
      ) : view === 'develop' ? (
        <DeveloperWizard
          step={draftStep}
          setStep={setDraftStep}
          draft={draft}
          setDraft={setDraft}
          tools={draftTools}
          setTools={setDraftTools}
          busy={storeBusy}
          onCancel={() => {
            setView('marketplace');
            setOperationError(null);
          }}
          onExport={() => void handleExportDraft()}
          error={operationError}
        />
      ) : (
        <>
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-purple-400">Extensions</p>
              <h2 className="mt-1 text-2xl font-semibold text-bolt-elements-textPrimary">Plugin Marketplace</h2>
              <p className="mt-1 max-w-2xl text-sm text-bolt-elements-textSecondary">
                Discover and manage reviewed plugins from the Bolt marketplace.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void refreshCatalog()}
                disabled={loadingCatalog}
                className={buttonClass}
              >
                {loadingCatalog ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}{' '}
                Check for Updates
              </button>
              <button type="button" onClick={() => importInput.current?.click()} className={buttonClass}>
                <Upload className="h-4 w-4" /> Install Plugin
              </button>
              <button
                type="button"
                onClick={() => {
                  setView('develop');
                  setDraftStep(0);
                }}
                className={primaryButtonClass}
              >
                <Plus className="h-4 w-4" /> Develop Plugin
              </button>
            </div>
          </header>

          <nav aria-label="Plugin views" className="flex flex-wrap gap-1 border-b border-bolt-elements-borderColor">
            {(
              [
                ['marketplace', 'Marketplace'],
                ['installed', 'Installed'],
                ['updates', 'Updates'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                aria-current={view === id ? 'page' : undefined}
                className={classNames(
                  'border-b-2 px-4 py-2.5 text-sm transition-colors',
                  view === id
                    ? 'border-purple-500 text-purple-400'
                    : 'border-transparent text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary',
                )}
              >
                {label}
                {id === 'updates' && updates.length > 0 ? (
                  <span className="ml-2 rounded-full bg-purple-500/20 px-1.5 py-0.5 text-xs text-purple-300">
                    {updates.length}
                  </span>
                ) : null}
                {id === 'installed' ? (
                  <span className="ml-2 rounded-full bg-bolt-elements-background-depth-3 px-1.5 py-0.5 text-xs">
                    {plugins.length}
                  </span>
                ) : null}
              </button>
            ))}
          </nav>

          <div className="flex flex-wrap gap-3">
            <label className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-bolt-elements-textTertiary" />
              <input
                className={`${inputClass} pl-9`}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search plugins..."
                aria-label="Search plugins"
              />
            </label>
            <label className="sr-only" htmlFor="plugin-category">
              Filter by category
            </label>
            <select
              id="plugin-category"
              className={`${inputClass} w-auto min-w-44`}
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option>All categories</option>
              {CATEGORIES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>

          {(operationError || storeError) && <ErrorMessage message={operationError ?? storeError ?? ''} />}

          {catalogError && !snapshot ? (
            <div className="space-y-3 rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 p-6 text-center">
              <h3 className="font-medium text-bolt-elements-textPrimary">Marketplace unavailable</h3>
              <p className="text-sm text-bolt-elements-textSecondary">{catalogError}</p>
              <div className="flex flex-wrap justify-center gap-2">
                <button type="button" className={buttonClass} onClick={() => void refreshCatalog()}>
                  Try again
                </button>
                <a className={buttonClass} href={MARKETPLACE_URL} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" /> Open repository
                </a>
              </div>
            </div>
          ) : null}

          {snapshot?.stale && (
            <p role="status" className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
              Showing the last saved catalog from {new Date(snapshot.fetchedAt).toLocaleString()}. Update checks may be
              out of date.
            </p>
          )}

          {loadingCatalog && !snapshot ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-bolt-elements-textSecondary">
              <LoaderCircle className="h-4 w-4 animate-spin" /> Loading marketplace…
            </div>
          ) : null}

          {snapshot && !catalogError && catalogPlugins.length === 0 && view === 'marketplace' ? (
            <div className="rounded-xl border border-dashed border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 px-6 py-12 text-center">
              <Blocks className="mx-auto h-9 w-9 text-bolt-elements-textTertiary" />
              <h3 className="mt-3 font-medium text-bolt-elements-textPrimary">No plugins published yet</h3>
              <p className="mx-auto mt-1 max-w-md text-sm text-bolt-elements-textSecondary">
                The marketplace repository is connected. Import a reviewed ZIP package or create a plugin draft to get
                started.
              </p>
              <button type="button" onClick={() => importInput.current?.click()} className={`${buttonClass} mt-4`}>
                <Upload className="h-4 w-4" /> Install from ZIP
              </button>
            </div>
          ) : null}

          {snapshot && catalogPlugins.length > 0 && displayedPlugins.length === 0 && (
            <p className="rounded-xl border border-bolt-elements-borderColor p-8 text-center text-sm text-bolt-elements-textSecondary">
              {view === 'installed' && plugins.length === 0
                ? 'No plugins installed yet.'
                : view === 'updates' && updates.length === 0
                  ? 'All installed plugins are up to date.'
                  : 'No plugins match these filters.'}
            </p>
          )}

          {displayedPlugins.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {displayedPlugins.map((plugin) => (
                <PluginCard
                  key={plugin.id}
                  plugin={plugin}
                  onOpen={() => {
                    setSelectedId(plugin.id);
                    setDetailTab('overview');
                  }}
                  installed={plugins.some((installed) => installed.id === plugin.id)}
                  updateAvailable={updates.some((update) => update.pluginId === plugin.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {installTarget && snapshot && (
        <InstallConfirmation
          plugin={snapshot.plugins.find((plugin) => plugin.id === installTarget.pluginId)}
          version={installTarget.version.version}
          installed={plugins.find((plugin) => plugin.id === installTarget.pluginId)}
          changelog={changelogText}
          changelogLoading={changelogLoading}
          changelogError={changelogError}
          busy={storeBusy}
          onCancel={() => {
            changelogRequestRef.current += 1;
            setInstallTarget(null);
            setChangelogText(undefined);
            setChangelogError(null);
          }}
          onInstall={() =>
            void runOperation(async () => {
              await installFromMarketplace(snapshot, installTarget.pluginId, installTarget.version);
              changelogRequestRef.current += 1;
              setInstallTarget(null);
              setChangelogText(undefined);
              setChangelogError(null);
              setView('installed');
            })
          }
        />
      )}
    </div>
  );
}

function InstallConfirmation({
  plugin,
  version,
  installed,
  changelog,
  changelogLoading,
  changelogError,
  busy,
  onCancel,
  onInstall,
}: {
  plugin?: MarketplacePlugin;
  version: string;
  installed?: ReturnType<typeof usePluginStore.getState>['plugins'][number];
  changelog?: string;
  changelogLoading: boolean;
  changelogError: string | null;
  busy: boolean;
  onCancel: () => void;
  onInstall: () => void;
}) {
  if (!plugin) {
    return null;
  }

  return (
    <RadixDialog.Root
      open
      onOpenChange={(open) => {
        if (!open) {
          onCancel();
        }
      }}
    >
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-[130] bg-black/70" />
        <RadixDialog.Content
          onEscapeKeyDown={(event) => {
            if (busy) {
              event.preventDefault();
            }
          }}
          className="fixed left-1/2 top-1/2 z-[131] w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-2xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 p-6 shadow-2xl focus:outline-none"
        >
          <RadixDialog.Title className="text-lg font-semibold text-bolt-elements-textPrimary">
            {installed ? `Update ${plugin.manifest.name}?` : `Install ${plugin.manifest.name}?`}
          </RadixDialog.Title>
          <RadixDialog.Description className="text-sm text-bolt-elements-textSecondary">
            Version {version} by {plugin.manifest.publisher}. The package will be checked against the catalog before it
            is stored.
          </RadixDialog.Description>
          <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-300">
            <ShieldCheck className="h-4 w-4 shrink-0" /> This plugin requests no extra capabilities.{' '}
            {installed?.enabled ? 'Its current enabled state will be preserved.' : 'The installation starts disabled.'}
          </div>
          {installed &&
            plugin.manifest.tools.some((tool) => {
              const currentManifest = pluginManifestSchema.safeParse(installed.manifest);
              return !currentManifest.success || !currentManifest.data.tools.includes(tool);
            }) && (
              <p className="rounded-lg bg-amber-500/10 p-3 text-sm text-amber-300">
                Newly added tools will stay disabled after the update. Review them in Settings before enabling.
              </p>
            )}
          {changelogLoading && (
            <p role="status" className="text-sm text-bolt-elements-textSecondary">
              Loading release notes…
            </p>
          )}
          {changelogError && <ErrorMessage message={changelogError} />}
          {changelog && (
            <section className="max-h-48 overflow-auto rounded-lg border border-bolt-elements-borderColor p-3">
              <h3 className="mb-2 text-sm font-medium text-bolt-elements-textPrimary">Release notes</h3>
              <pre className="whitespace-pre-wrap break-words text-xs text-bolt-elements-textSecondary">
                {changelog}
              </pre>
            </section>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className={buttonClass} onClick={onCancel} disabled={busy}>
              Cancel
            </button>
            <button
              type="button"
              className={primaryButtonClass}
              onClick={onInstall}
              disabled={busy || changelogLoading || !!changelogError}
            >
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{' '}
              {installed ? 'Update' : 'Install'}
            </button>
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

function PluginDetails({
  manifest,
  installed,
  detailTab,
  setDetailTab,
  onBack,
  logs,
  busy,
  onEnabled,
  onUninstall,
  onRollback,
  onConfiguration,
  onToolEnabled,
  onUpdate,
  onInstall,
  error,
}: {
  manifest: PluginManifest;
  installed?: ReturnType<typeof usePluginStore.getState>['plugins'][number];
  detailTab: DetailTab;
  setDetailTab: (tab: DetailTab) => void;
  onBack: () => void;
  logs: ReturnType<typeof usePluginStore.getState>['logs'][string];
  busy: boolean;
  onEnabled: (enabled: boolean) => void;
  onUninstall: () => void;
  onRollback: () => void;
  onConfiguration: (configuration: Record<string, string | boolean | number>) => void;
  onToolEnabled: (tool: PluginManifest['tools'][number], enabled: boolean) => void;
  onUpdate?: () => void;
  onInstall?: () => void;
  error: string | null;
}) {
  const versions = installed?.previous
    ? [manifest.version, (installed.previous.manifest as PluginManifest).version]
    : [manifest.version];

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary"
      >
        <ChevronLeft className="h-4 w-4" /> {installed ? 'Installed Plugins' : 'Marketplace'}
      </button>
      <header className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 p-5">
        <div className="flex gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400">
            <Blocks className="h-7 w-7" />
          </span>
          <div>
            <h2 className="text-xl font-semibold text-bolt-elements-textPrimary">{manifest.name}</h2>
            <p className="mt-1 text-sm text-bolt-elements-textSecondary">
              Version {manifest.version} · {manifest.publisher}
            </p>
            <p className="mt-2 max-w-2xl text-sm text-bolt-elements-textSecondary">{manifest.description}</p>
          </div>
        </div>
        {installed && (
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-bolt-elements-textSecondary">
              <span>{installed.enabled ? 'Enabled' : 'Disabled'}</span>
              <input
                type="checkbox"
                checked={installed.enabled}
                disabled={busy}
                aria-label={`${installed.enabled ? 'Disable' : 'Enable'} ${manifest.name}`}
                onChange={(event) => onEnabled(event.target.checked)}
                className="h-4 w-4 accent-purple-500"
              />
            </label>
            <button type="button" onClick={onUninstall} disabled={busy} className={buttonClass}>
              <Trash2 className="h-4 w-4" /> Uninstall
            </button>
          </div>
        )}
      </header>
      <nav aria-label="Plugin details" className="flex gap-1 overflow-x-auto border-b border-bolt-elements-borderColor">
        {(['overview', 'settings', 'permissions', 'logs'] as const).map((tab) => (
          <button
            type="button"
            key={tab}
            onClick={() => setDetailTab(tab)}
            aria-current={detailTab === tab ? 'page' : undefined}
            className={classNames(
              'border-b-2 px-4 py-2 text-sm capitalize',
              detailTab === tab
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary',
            )}
          >
            {tab}
          </button>
        ))}
      </nav>
      {error && <ErrorMessage message={error} />}
      {detailTab === 'overview' && (
        <section className="grid gap-4 md:grid-cols-[1fr_280px]">
          <div className="space-y-4 rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 p-5">
            <h3 className="font-semibold text-bolt-elements-textPrimary">About</h3>
            <p className="text-sm leading-6 text-bolt-elements-textSecondary">{manifest.description}</p>
            <div className="flex flex-wrap gap-2">
              <CategoryPill>{manifest.category}</CategoryPill>
              <CategoryPill>{manifest.license}</CategoryPill>
            </div>
            {installed && (
              <p className="text-xs text-bolt-elements-textTertiary">
                {installed.source === 'marketplace'
                  ? `Marketplace · commit ${installed.sourceCommit?.slice(0, 8)}`
                  : 'Imported local package · source not verified'}
              </p>
            )}
          </div>
          <div className="space-y-3 rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 p-5">
            <h3 className="font-semibold text-bolt-elements-textPrimary">Plugin status</h3>
            <p className="text-sm text-bolt-elements-textSecondary">
              {installed
                ? installed.enabled
                  ? 'Enabled in this browser profile'
                  : 'Installed and disabled'
                : 'Available to install'}
            </p>
            <p className="text-sm text-bolt-elements-textSecondary">
              {manifest.tools.length} tool{manifest.tools.length === 1 ? '' : 's'} · no additional capabilities
            </p>
            {onUpdate && (
              <button type="button" onClick={onUpdate} className={buttonClass}>
                <RefreshCw className="h-4 w-4" /> Update available
              </button>
            )}
            {onInstall && (
              <button type="button" onClick={onInstall} className={primaryButtonClass}>
                <Download className="h-4 w-4" /> Install plugin
              </button>
            )}
            {versions.length > 1 && (
              <button type="button" onClick={onRollback} className={buttonClass}>
                Restore v{versions[1]}
              </button>
            )}
          </div>
        </section>
      )}
      {detailTab === 'settings' && (
        <section className="space-y-4 rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 p-5">
          <h3 className="font-semibold text-bolt-elements-textPrimary">Configuration</h3>
          {installed ? (
            manifest.settings.length ? (
              manifest.settings.map((setting) => (
                <label key={setting.key} className="block space-y-1 text-sm text-bolt-elements-textPrimary">
                  <span>{setting.label}</span>
                  {setting.type === 'toggle' ? (
                    <input
                      type="checkbox"
                      checked={Boolean(installed.configuration[setting.key] ?? setting.default)}
                      onChange={(event) =>
                        onConfiguration({ ...installed.configuration, [setting.key]: event.target.checked })
                      }
                    />
                  ) : (
                    <input
                      className={inputClass}
                      type={setting.type === 'number' ? 'number' : 'text'}
                      value={String(installed.configuration[setting.key] ?? setting.default ?? '')}
                      onChange={(event) =>
                        onConfiguration({
                          ...installed.configuration,
                          [setting.key]: setting.type === 'number' ? Number(event.target.value) : event.target.value,
                        })
                      }
                    />
                  )}
                  {setting.description && (
                    <p className="text-xs text-bolt-elements-textSecondary">{setting.description}</p>
                  )}
                </label>
              ))
            ) : (
              <p className="text-sm text-bolt-elements-textSecondary">This plugin has no additional settings.</p>
            )
          ) : (
            <p className="text-sm text-bolt-elements-textSecondary">Install this plugin to configure it.</p>
          )}
          {installed &&
            manifest.tools.map((tool) => {
              const toolName = getPluginToolName(manifest.id, tool);
              const toolEnabled = installed.configuration[`toolDisabled:${tool}`] !== true;

              return (
                <label
                  key={tool}
                  className="flex items-center justify-between border-t border-bolt-elements-borderColor py-3 text-sm text-bolt-elements-textSecondary"
                >
                  <span>
                    <span className="block capitalize text-bolt-elements-textPrimary">
                      {tool.replace('-', ' ')} tool
                    </span>
                    <code className="text-xs">{toolName}</code>
                  </span>
                  <input
                    type="checkbox"
                    checked={toolEnabled}
                    disabled={busy}
                    aria-label={`Enable ${tool} tool`}
                    onChange={(event) => onToolEnabled(tool, event.target.checked)}
                    className="h-4 w-4 accent-purple-500"
                  />
                </label>
              );
            })}
        </section>
      )}
      {detailTab === 'permissions' && (
        <section className="rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 p-5">
          <div className="flex items-center gap-2 text-emerald-400">
            <ShieldCheck className="h-5 w-5" />
            <h3 className="font-semibold">Permissions</h3>
          </div>
          <p className="mt-3 text-sm text-bolt-elements-textSecondary">
            This reviewed adapter requests no network, project-file, credential, or storage access. Its tools only
            process text arguments supplied by the model.
          </p>
          <p className="mt-3 text-xs text-bolt-elements-textTertiary">Declared capabilities: none</p>
        </section>
      )}
      {detailTab === 'logs' && (
        <section className="space-y-3 rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 p-5">
          <h3 className="font-semibold text-bolt-elements-textPrimary">Activity</h3>
          {!installed ? (
            <p className="text-sm text-bolt-elements-textSecondary">Install the plugin to see activity.</p>
          ) : logs?.length ? (
            logs.map((log) => (
              <div
                key={log.id}
                className="flex flex-wrap justify-between gap-2 border-t border-bolt-elements-borderColor py-3 text-sm"
              >
                <span className={log.level === 'error' ? 'text-red-400' : 'text-bolt-elements-textSecondary'}>
                  {log.message}
                </span>
                <time className="text-xs text-bolt-elements-textTertiary">{new Date(log.time).toLocaleString()}</time>
              </div>
            ))
          ) : (
            <p className="text-sm text-bolt-elements-textSecondary">No activity recorded yet.</p>
          )}
        </section>
      )}
    </div>
  );
}

function DeveloperWizard({
  step,
  setStep,
  draft,
  setDraft,
  tools,
  setTools,
  busy,
  onCancel,
  onExport,
  error,
}: {
  step: number;
  setStep: (step: number) => void;
  draft: Draft;
  setDraft: (draft: Draft) => void;
  tools: PluginManifest['tools'];
  setTools: (tools: PluginManifest['tools']) => void;
  busy: boolean;
  onCancel: () => void;
  onExport: () => void;
  error: string | null;
}) {
  const update = (key: keyof Draft, value: string) => setDraft({ ...draft, [key]: value });
  const steps = ['Basic Information', 'Capabilities', 'Configuration', 'Review'];

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-purple-400">Extensions</p>
          <h2 className="mt-1 text-2xl font-semibold text-bolt-elements-textPrimary">Develop Plugin</h2>
          <p className="mt-1 text-sm text-bolt-elements-textSecondary">
            Create a validated draft for a supported Bolt adapter.
          </p>
        </div>
        <button type="button" onClick={onCancel} className={buttonClass}>
          Cancel
        </button>
      </header>
      <ol aria-label="Plugin draft steps" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {steps.map((label, index) => (
          <li
            key={label}
            aria-current={step === index ? 'step' : undefined}
            className={classNames(
              'rounded-lg border px-3 py-2 text-xs',
              step === index
                ? 'border-purple-500/50 bg-purple-500/10 text-purple-300'
                : 'border-bolt-elements-borderColor text-bolt-elements-textSecondary',
            )}
          >
            <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-bolt-elements-background-depth-3">
              {index + 1}
            </span>
            {label}
          </li>
        ))}
      </ol>
      {error && <ErrorMessage message={error} />}
      <section className="space-y-4 rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 p-5">
        {step === 0 && (
          <>
            <h3 className="font-semibold text-bolt-elements-textPrimary">Basic Information</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm text-bolt-elements-textSecondary">
                Plugin ID
                <input className={inputClass} value={draft.id} onChange={(event) => update('id', event.target.value)} />
                <span className="block text-xs">Use publisher.slug, lowercase letters and hyphens.</span>
              </label>
              <label className="space-y-1 text-sm text-bolt-elements-textSecondary">
                Plugin Name
                <input
                  className={inputClass}
                  maxLength={80}
                  value={draft.name}
                  onChange={(event) => update('name', event.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm text-bolt-elements-textSecondary">
                Publisher
                <input
                  className={inputClass}
                  maxLength={80}
                  value={draft.publisher}
                  onChange={(event) => update('publisher', event.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm text-bolt-elements-textSecondary">
                License
                <input
                  className={inputClass}
                  maxLength={40}
                  value={draft.license}
                  onChange={(event) => update('license', event.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm text-bolt-elements-textSecondary">
                Version
                <input
                  className={inputClass}
                  value={draft.version}
                  onChange={(event) => update('version', event.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm text-bolt-elements-textSecondary">
                Category
                <select
                  className={inputClass}
                  value={draft.category}
                  onChange={(event) => setDraft({ ...draft, category: event.target.value as Draft['category'] })}
                >
                  {CATEGORIES.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm text-bolt-elements-textSecondary md:col-span-2">
                Description
                <textarea
                  className={`${inputClass} min-h-24`}
                  maxLength={400}
                  value={draft.description}
                  onChange={(event) => update('description', event.target.value)}
                />
              </label>
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <h3 className="font-semibold text-bolt-elements-textPrimary">Capabilities</h3>
            <div className="flex items-start gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-400" />
              <div>
                <p className="text-sm font-medium text-bolt-elements-textPrimary">No additional access requested</p>
                <p className="mt-1 text-sm text-bolt-elements-textSecondary">
                  Version 1 supports the reviewed Text Utilities host adapter. It cannot access the network, project
                  files, credentials, or plugin storage.
                </p>
              </div>
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <h3 className="font-semibold text-bolt-elements-textPrimary">Configuration</h3>
            <p className="text-sm text-bolt-elements-textSecondary">
              Choose which deterministic tools this package contributes. These tools only process text you provide.
            </p>
            {(['count', 'transform'] as const).map((tool) => (
              <label
                key={tool}
                className="flex items-center gap-3 rounded-lg border border-bolt-elements-borderColor p-3 text-sm text-bolt-elements-textPrimary"
              >
                <input
                  type="checkbox"
                  checked={tools.includes(tool)}
                  onChange={(event) =>
                    setTools(
                      event.target.checked
                        ? ([...tools, tool].sort() as PluginManifest['tools'])
                        : tools.filter((item) => item !== tool),
                    )
                  }
                />{' '}
                <Wrench className="h-4 w-4 text-purple-400" />
                <span className="capitalize">
                  {tool === 'count' ? 'Count words, characters, and lines' : 'Transform text'}
                </span>
              </label>
            ))}
            {tools.length === 0 && (
              <p role="alert" className="text-sm text-amber-300">
                Choose at least one tool.
              </p>
            )}
          </>
        )}
        {step === 3 && (
          <>
            <h3 className="font-semibold text-bolt-elements-textPrimary">Review</h3>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              {Object.entries({
                Name: draft.name,
                ID: draft.id,
                Publisher: draft.publisher,
                Version: draft.version,
                License: draft.license,
                Category: draft.category,
              }).map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs uppercase text-bolt-elements-textTertiary">{label}</dt>
                  <dd className="mt-1 text-bolt-elements-textPrimary">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="border-t border-bolt-elements-borderColor pt-4 text-sm text-bolt-elements-textSecondary">
              {draft.description}
            </p>
            <p className="text-sm text-bolt-elements-textSecondary">
              Tools: {tools.join(', ') || 'none'} · Extra capabilities: none
            </p>
            <p className="text-xs text-bolt-elements-textTertiary">
              The ZIP contains a declarative manifest only. Publishing requires a reviewed change to the marketplace
              repository.
            </p>
          </>
        )}
        <div className="flex justify-between border-t border-bolt-elements-borderColor pt-4">
          <button
            type="button"
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
            className={buttonClass}
          >
            Back
          </button>
          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              disabled={step === 2 && tools.length === 0}
              className={primaryButtonClass}
            >
              Next <ChevronLeft className="h-4 w-4 rotate-180" />
            </button>
          ) : (
            <button type="button" onClick={onExport} disabled={busy} className={primaryButtonClass}>
              <Download className="h-4 w-4" /> Export ZIP
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
