import { describe, expect, it } from 'vitest';
import { configurationForInstall } from './plugins';
import type { InstalledPlugin } from '~/lib/plugins/database';
import { pluginManifestSchema } from '~/lib/plugins/schema';

const manifest = pluginManifestSchema.parse({
  schemaVersion: 1,
  pluginApiVersion: 1,
  id: 'boltdiy.text-utilities',
  name: 'Text Utilities',
  description: 'Count and transform text.',
  publisher: 'Bolt.diy',
  license: 'MIT',
  category: 'Productivity',
  version: '1.1.0',
  contribution: { type: 'host-tool', adapter: 'text-utils' },
  capabilities: [],
  tools: ['count', 'transform'],
});

function installed(tools: string[], configuration: InstalledPlugin['configuration'] = {}): InstalledPlugin {
  return {
    id: manifest.id,
    manifest: { ...manifest, version: '1.0.0', tools },
    source: 'marketplace',
    manifestSha256: 'a'.repeat(64),
    packageSha256: 'b'.repeat(64),
    packageBytes: new ArrayBuffer(0),
    enabled: true,
    installedAt: '2026-10-12T00:00:00.000Z',
    configuration,
  };
}

describe('plugin install configuration', () => {
  it('leaves new installs ready for the declared tools', () => {
    expect(configurationForInstall(manifest)).toEqual({});
  });

  it('keeps existing tool choices and disables tools newly introduced by an update', () => {
    expect(
      configurationForInstall(manifest, installed(['count'], { 'toolDisabled:count': true, mode: 'safe' })),
    ).toEqual({
      'toolDisabled:count': true,
      mode: 'safe',
      'toolDisabled:transform': true,
    });
  });
});
