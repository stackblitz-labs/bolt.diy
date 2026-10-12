import { create } from 'zustand';
import { isSupportedAdapter } from '~/lib/plugins/adapters';
import {
  pluginDatabase,
  type InstalledPlugin,
  type InstalledPluginVersion,
  type PluginLog,
} from '~/lib/plugins/database';
import { pluginManifestSchema } from '~/lib/plugins/schema';

type PluginStore = {
  plugins: InstalledPlugin[];
  logs: Record<string, PluginLog[]>;
  initialized: boolean;
  busy: boolean;
  error: string | null;
  initialize: () => Promise<void>;
  refresh: () => Promise<void>;
  install: (
    input: Omit<InstalledPlugin, 'installedAt' | 'previous' | 'configuration'> & {
      installedAt?: string;
      previous?: InstalledPluginVersion;
      configuration?: InstalledPlugin['configuration'];
    },
  ) => Promise<void>;
  setEnabled: (id: string, enabled: boolean) => Promise<void>;
  setConfiguration: (id: string, configuration: InstalledPlugin['configuration']) => Promise<void>;
  uninstall: (id: string) => Promise<void>;
  rollback: (id: string) => Promise<void>;
  loadLogs: (id: string) => Promise<void>;
  addLog: (pluginId: string, level: PluginLog['level'], message: string) => Promise<void>;
};

function safeError(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 240) : 'Plugin operation failed.';
}

function validateInstalled(record: InstalledPlugin): InstalledPlugin | undefined {
  const result = pluginManifestSchema.safeParse(record.manifest);

  if (!result.success || !isSupportedAdapter(result.data)) {
    return undefined;
  }

  return { ...record, manifest: result.data };
}

export function configurationForInstall(
  manifest: ReturnType<typeof pluginManifestSchema.parse>,
  existing?: InstalledPlugin,
) {
  const previousManifest = existing ? pluginManifestSchema.safeParse(existing.manifest) : undefined;

  const configuration = {
    ...(existing?.configuration ??
      Object.fromEntries(
        manifest.settings.flatMap((setting) => (setting.default === undefined ? [] : [[setting.key, setting.default]])),
      )),
  };

  if (previousManifest?.success) {
    for (const tool of manifest.tools) {
      if (!previousManifest.data.tools.includes(tool)) {
        configuration[`toolDisabled:${tool}`] = true;
      }
    }
  }

  return configuration;
}

export const usePluginStore = create<PluginStore>((set, get) => ({
  plugins: [],
  logs: {},
  initialized: false,
  busy: false,
  error: null,
  initialize: async () => {
    if (get().initialized) {
      return;
    }

    try {
      const records = await pluginDatabase.getAll();

      const valid = records.flatMap((record) => {
        const checked = validateInstalled(record);
        return checked ? [checked] : [];
      });

      set({ plugins: valid, initialized: true, error: null });
    } catch (error) {
      set({ initialized: true, error: safeError(error) });
    }
  },
  refresh: async () => {
    const records = await pluginDatabase.getAll();

    const valid = records.flatMap((record) => {
      const checked = validateInstalled(record);
      return checked ? [checked] : [];
    });

    set({ plugins: valid, error: null });
  },
  install: async (input) => {
    set({ busy: true, error: null });

    try {
      const manifest = pluginManifestSchema.parse(input.manifest);

      if (!isSupportedAdapter(manifest)) {
        throw new Error('This plugin requires an adapter that is not supported by this version of Bolt.');
      }

      const existing = await pluginDatabase.get(manifest.id);

      const sameVersion =
        existing?.manifest && pluginManifestSchema.safeParse(existing.manifest).data?.version === manifest.version;

      if (sameVersion && existing?.packageSha256 === input.packageSha256) {
        throw new Error('This plugin version is already installed.');
      }

      const record: InstalledPlugin = {
        ...input,
        id: manifest.id,
        manifest,
        enabled: existing?.enabled ?? false,
        installedAt: new Date().toISOString(),
        previous: existing
          ? {
              manifest: existing.manifest,
              sourceCommit: existing.sourceCommit,
              manifestSha256: existing.manifestSha256,
              packageSha256: existing.packageSha256,
              packageBytes: existing.packageBytes,
            }
          : undefined,
        configuration: configurationForInstall(manifest, existing),
      };

      await pluginDatabase.putWithLog(record, {
        id: crypto.randomUUID(),
        pluginId: manifest.id,
        time: new Date().toISOString(),
        level: 'info',
        message: existing ? `Updated to version ${manifest.version}.` : `Installed version ${manifest.version}.`,
      });
      await get().refresh();
    } catch (error) {
      set({ error: safeError(error) });
      throw error;
    } finally {
      set({ busy: false });
    }
  },
  setEnabled: async (id, enabled) => {
    set({ busy: true, error: null });

    try {
      const plugin = await pluginDatabase.get(id);

      if (!plugin || !validateInstalled(plugin)) {
        throw new Error('The installed plugin is unavailable or invalid.');
      }

      await pluginDatabase.putWithLog(
        { ...plugin, enabled },
        {
          id: crypto.randomUUID(),
          pluginId: id,
          time: new Date().toISOString(),
          level: 'info',
          message: enabled ? 'Plugin enabled.' : 'Plugin disabled.',
        },
      );
      await get().refresh();
    } catch (error) {
      set({ error: safeError(error) });
      throw error;
    } finally {
      set({ busy: false });
    }
  },
  setConfiguration: async (id, configuration) => {
    const plugin = await pluginDatabase.get(id);

    if (!plugin || !validateInstalled(plugin)) {
      throw new Error('The installed plugin is unavailable or invalid.');
    }

    await pluginDatabase.putWithLog(
      { ...plugin, configuration },
      {
        id: crypto.randomUUID(),
        pluginId: id,
        time: new Date().toISOString(),
        level: 'info',
        message: 'Plugin settings updated.',
      },
    );
    await get().refresh();
  },
  uninstall: async (id) => {
    set({ busy: true, error: null });

    try {
      const plugin = await pluginDatabase.get(id);

      if (!plugin) {
        return;
      }

      await pluginDatabase.removeWithLog(id, {
        id: crypto.randomUUID(),
        pluginId: id,
        time: new Date().toISOString(),
        level: 'info',
        message: 'Plugin uninstalled.',
      });
      await get().refresh();
    } catch (error) {
      set({ error: safeError(error) });
      throw error;
    } finally {
      set({ busy: false });
    }
  },
  rollback: async (id) => {
    const plugin = await pluginDatabase.get(id);

    if (!plugin?.previous) {
      throw new Error('There is no previous plugin version to restore.');
    }

    const previous = plugin.previous;
    const manifest = pluginManifestSchema.parse(previous.manifest);

    const restored: InstalledPlugin = {
      ...plugin,
      manifest,
      sourceCommit: previous.sourceCommit,
      manifestSha256: previous.manifestSha256,
      packageSha256: previous.packageSha256,
      packageBytes: previous.packageBytes,
      previous: {
        manifest: plugin.manifest,
        sourceCommit: plugin.sourceCommit,
        manifestSha256: plugin.manifestSha256,
        packageSha256: plugin.packageSha256,
        packageBytes: plugin.packageBytes,
      },
    };

    await pluginDatabase.putWithLog(restored, {
      id: crypto.randomUUID(),
      pluginId: id,
      time: new Date().toISOString(),
      level: 'warning',
      message: `Restored version ${manifest.version}.`,
    });
    await get().refresh();
  },
  loadLogs: async (id) => {
    const logs = await pluginDatabase.logs(id);
    set((state) => ({
      logs: { ...state.logs, [id]: logs.sort((left, right) => right.time.localeCompare(left.time)) },
    }));
  },
  addLog: async (pluginId, level, message) => {
    await pluginDatabase.addLog({ id: crypto.randomUUID(), pluginId, time: new Date().toISOString(), level, message });
    await get().loadLogs(pluginId);
  },
}));
