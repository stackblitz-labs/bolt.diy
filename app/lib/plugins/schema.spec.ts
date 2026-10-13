import { describe, expect, it } from 'vitest';
import { compareVersions, pluginCatalogSchema, pluginManifestSchema } from './schema';

const manifest = {
  schemaVersion: 1,
  pluginApiVersion: 1,
  id: 'boltdiy.text-utilities',
  name: 'Text Utilities',
  description: 'Count and transform supplied text.',
  publisher: 'Bolt.diy',
  license: 'MIT',
  category: 'Productivity',
  version: '1.0.0',
  contribution: { type: 'host-tool', adapter: 'text-utils' },
  capabilities: [],
  tools: ['count', 'transform'],
};

describe('plugin marketplace schemas', () => {
  it('accepts the built-in declarative adapter manifest', () => {
    expect(pluginManifestSchema.parse(manifest).id).toBe('boltdiy.text-utilities');
  });

  it('rejects executable contributions and requested capabilities', () => {
    expect(
      pluginManifestSchema.safeParse({ ...manifest, contribution: { type: 'javascript', adapter: 'text-utils' } })
        .success,
    ).toBe(false);
    expect(pluginManifestSchema.safeParse({ ...manifest, capabilities: ['network'] }).success).toBe(false);
    expect(pluginManifestSchema.safeParse({ ...manifest, tools: [] }).success).toBe(false);
  });

  it('rejects catalog paths that can escape the marketplace repository', () => {
    const version = {
      version: '1.0.0',
      manifestPath: 'plugins/boltdiy/text-utilities/1.0.0/manifest.json',
      manifestSha256: 'a'.repeat(64),
      packagePath: 'plugins/boltdiy/text-utilities/1.0.0/package.zip',
      packageSha256: 'b'.repeat(64),
    };
    const catalog = {
      schemaVersion: 1,
      updatedAt: '2026-10-12T12:00:00.000Z',
      plugins: [{ id: manifest.id, versions: [version] }],
    };

    expect(pluginCatalogSchema.safeParse(catalog).success).toBe(true);
    expect(
      pluginCatalogSchema.safeParse({
        ...catalog,
        plugins: [
          { id: manifest.id, versions: [{ ...version, manifestPath: 'plugins/boltdiy/text-utilities/../evil.json' }] },
        ],
      }).success,
    ).toBe(false);
    expect(
      pluginCatalogSchema.safeParse({
        ...catalog,
        plugins: [
          {
            id: manifest.id,
            versions: [{ ...version, manifestPath: 'plugins/boltdiy/text-utilities/1.0.0//manifest.json' }],
          },
        ],
      }).success,
    ).toBe(false);
  });

  it('orders semantic versions including prereleases', () => {
    expect(compareVersions('1.0.0', '1.0.0-rc.1')).toBeGreaterThan(0);
    expect(compareVersions('1.0.0-rc.2', '1.0.0-rc.10')).toBeLessThan(0);
    expect(compareVersions('2.0.0', '1.99.99')).toBeGreaterThan(0);
  });
});
