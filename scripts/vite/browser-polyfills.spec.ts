import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';
import { describe, expect, it } from 'vitest';
import { browserPolyfills } from './browser-polyfills';

describe('browser polyfills production build', () => {
  it('keeps generated runtime modules independent of the polyfills they initialize', () => {
    const plugin = browserPolyfills();

    expect(plugin.transform('export const global = {};', '\0rolldown/runtime.js')).toBeNull();
    expect(plugin.transform('export const global = {};', '\0vite/runtime.js')).toBeNull();
  });

  it('initializes bundled Buffer without a circular dependency on the bundler runtime', async () => {
    const result = await build({
      configFile: false,
      logLevel: 'silent',
      plugins: [
        browserPolyfills(),
        {
          name: 'polyfill-regression-entry',
          resolveId(id) {
            return id === 'qa-entry' ? '/qa-entry.ts' : null;
          },
          load(id) {
            if (id === '/qa-entry.ts') {
              return 'import React from "react"; export const encoded = React.createElement("span", null, Buffer.from("production").toString("base64")).props.children;';
            }

            return null;
          },
        },
      ],
      build: {
        write: false,
        target: 'esnext',
        minify: false,
        rolldownOptions: {
          input: 'qa-entry',
          preserveEntrySignatures: 'allow-extension',
          output: {
            entryFileNames: '[name].mjs',
            chunkFileNames: '[name]-[hash].mjs',
            codeSplitting: {
              groups: [{ name: 'polyfills', test: /shims\/(buffer|process)/, includeDependenciesRecursively: false }],
            },
          },
        },
      },
    });

    const bundle = Array.isArray(result) ? result[0] : result;

    if (!('output' in bundle)) {
      throw new Error('Expected a completed build, not a watcher');
    }

    const output = bundle.output;
    const entry = output.find((item) => item.type === 'chunk' && item.isEntry);

    expect(entry?.type).toBe('chunk');

    if (entry?.type !== 'chunk') {
      throw new Error('Missing regression entry chunk');
    }

    const directory = await mkdtemp(join(tmpdir(), 'bolt-polyfill-regression-'));

    try {
      await Promise.all(
        output.map((item) =>
          writeFile(join(directory, item.fileName), item.type === 'chunk' ? item.code : item.source),
        ),
      );

      const module = await import(/* @vite-ignore */ pathToFileURL(join(directory, entry.fileName)).href);

      expect(module.encoded).toBe('cHJvZHVjdGlvbg==');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
