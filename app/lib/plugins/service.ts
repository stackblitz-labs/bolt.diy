import { pluginDatabase, type InstalledPlugin } from './database';
import {
  createPluginPackage,
  fetchMarketplaceChangelog,
  fetchMarketplace,
  inspectLocalPackage,
  installMarketplacePlugin,
  compareVersions,
  type MarketplaceSnapshot,
} from './marketplace';
import { pluginManifestSchema, type PluginManifest } from './schema';
import { usePluginStore } from '~/lib/stores/plugins';

export async function loadMarketplace() {
  return fetchMarketplace();
}

export { fetchMarketplaceChangelog };

export async function installFromMarketplace(
  snapshot: MarketplaceSnapshot,
  pluginId: string,
  version: MarketplaceSnapshot['catalog']['plugins'][number]['versions'][number],
) {
  const packageInfo = await installMarketplacePlugin(snapshot, pluginId, version);
  await usePluginStore.getState().install({
    id: pluginId,
    manifest: packageInfo.manifest,
    source: 'marketplace',
    sourceCommit: snapshot.commit,
    manifestSha256: packageInfo.manifestSha256,
    packageSha256: packageInfo.packageSha256,
    packageBytes: packageInfo.packageBytes.buffer.slice(
      packageInfo.packageBytes.byteOffset,
      packageInfo.packageBytes.byteOffset + packageInfo.packageBytes.byteLength,
    ) as ArrayBuffer,
    enabled: false,
  });
}

export async function installLocalPackage(file: File) {
  const packageInfo = await inspectLocalPackage(file);
  await usePluginStore.getState().install({
    id: packageInfo.manifest.id,
    manifest: packageInfo.manifest,
    source: 'local',
    manifestSha256: packageInfo.manifestSha256,
    packageSha256: packageInfo.packageSha256,
    packageBytes: packageInfo.packageBytes.buffer.slice(
      packageInfo.packageBytes.byteOffset,
      packageInfo.packageBytes.byteOffset + packageInfo.packageBytes.byteLength,
    ) as ArrayBuffer,
    enabled: false,
  });
}

export function createDraftManifest(
  input: Pick<PluginManifest, 'id' | 'name' | 'description' | 'publisher' | 'license' | 'category' | 'version'> & {
    tools?: PluginManifest['tools'];
  },
): PluginManifest {
  const { tools, ...metadata } = input;

  return pluginManifestSchema.parse({
    schemaVersion: 1,
    pluginApiVersion: 1,
    ...metadata,
    contribution: { type: 'host-tool', adapter: 'text-utils' },
    capabilities: [],
    tools: tools ?? ['count', 'transform'],
    settings: [],
  });
}

export async function exportPluginDraft(manifest: PluginManifest) {
  const file = await createPluginPackage(manifest);
  const url = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${manifest.id.replace('.', '-')}-${manifest.version}.zip`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function getLatestVersion(versions: MarketplaceSnapshot['catalog']['plugins'][number]['versions']) {
  return [...versions].sort((left, right) => compareVersions(right.version, left.version))[0];
}

export function getPluginUpdates(snapshot: MarketplaceSnapshot | null, installed: InstalledPlugin[]) {
  if (!snapshot) {
    return [];
  }

  return installed.flatMap((plugin) => {
    const manifest = pluginManifestSchema.safeParse(plugin.manifest);
    const catalogEntry = snapshot.catalog.plugins.find((entry) => entry.id === plugin.id);
    const latest = catalogEntry ? getLatestVersion(catalogEntry.versions) : undefined;

    if (!manifest.success || !latest || compareVersions(latest.version, manifest.data.version) <= 0) {
      return [];
    }

    return [{ pluginId: plugin.id, version: latest }];
  });
}

export async function getInstalledPlugin(id: string) {
  return pluginDatabase.get(id);
}
