import { webcrypto } from 'node:crypto';
import JSZip from 'jszip';
import { beforeAll, describe, expect, it } from 'vitest';
import { inspectLocalPackage } from './marketplace';
import type { PluginManifest } from './schema';

const manifest: PluginManifest = {
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
  settings: [],
};

async function asFile(zip: JSZip): Promise<File> {
  const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });

  return new File([bytes.slice().buffer as ArrayBuffer], 'plugin.zip', { type: 'application/zip' });
}

describe('plugin package validation', () => {
  beforeAll(() => {
    if (!globalThis.crypto?.subtle) {
      Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
    }
  });

  it('accepts a declarative package with a validated root manifest', async () => {
    const zip = new JSZip();
    zip.file('manifest.json', JSON.stringify(manifest));

    const inspected = await inspectLocalPackage(await asFile(zip));

    expect(inspected.manifest.id).toBe(manifest.id);
    expect(inspected.packageSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects traversal paths before importing an archive', async () => {
    const zip = new JSZip();
    zip.file('manifest.json', JSON.stringify(manifest));
    zip.file('../outside.txt', 'untrusted');

    await expect(inspectLocalPackage(await asFile(zip))).rejects.toThrow(/unsafe file path/i);
  });

  it('rejects executable files in a declarative package', async () => {
    const zip = new JSZip();
    zip.file('manifest.json', JSON.stringify(manifest));
    zip.file('assets/launch.js', 'alert(1)');

    await expect(inspectLocalPackage(await asFile(zip))).rejects.toThrow(/unsafe file path/i);
  });

  it('rejects an archive whose declared expansion exceeds the package bound', async () => {
    const zip = new JSZip();
    zip.file('manifest.json', JSON.stringify(manifest));
    zip.file('assets/large.txt', 'a'.repeat(20_000_001));

    await expect(inspectLocalPackage(await asFile(zip))).rejects.toThrow(/exceeds 20 MB/i);
  });
});
