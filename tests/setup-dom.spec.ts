import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { globSync } from 'fast-glob';
import { describe, expect, it } from 'vitest';
import { DOM_PROJECT, NODE_PROJECT } from '../vitest.config';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const vitest = join(dirname(require.resolve('vitest/package.json')), 'vitest.mjs');

describe('vitest project split', () => {
  it('defines separate Node and DOM environments', () => {
    expect(NODE_PROJECT).toMatchObject({
      name: 'node',
      environment: 'node',
      setupFiles: ['./tests/setup-base.ts'],
    });
    expect(DOM_PROJECT).toMatchObject({
      name: 'dom',
      environment: 'jsdom',
      setupFiles: ['./tests/setup-base.ts', './tests/setup-dom.ts'],
    });
  });

  it('discovers every source test in exactly one project', () => {
    const sourceTests = globSync(
      ['*.{test,spec}.{ts,tsx,js,jsx}', '{app,electron,scripts,tests,types,workers}/**/*.{test,spec}.{ts,tsx,js,jsx}'],
      { cwd: root, dot: true, ignore: ['tests/e2e/**', 'tests/preview/**'] },
    );
    const output = execFileSync(process.execPath, [vitest, 'list', '--filesOnly', '--json'], {
      cwd: root,
      encoding: 'utf8',
      timeout: 15_000,
    });
    const discovered = JSON.parse(output) as { file: string; projectName: string }[];
    const relativeFiles = (files: { file: string }[]) =>
      files.map(({ file }) => relative(root, file).replaceAll('\\', '/')).sort();

    expect(relativeFiles(discovered)).toEqual(sourceTests.sort());
    expect(relativeFiles(discovered.filter(({ projectName }) => projectName === 'dom'))).toEqual(
      [...DOM_PROJECT.include].sort(),
    );
  }, 20_000);

  it('preserves the benchmark globs in the node project', () => {
    expect(NODE_PROJECT.benchmark.include).toContain('**/*.bench.{ts,tsx,js,jsx}');
    expect(NODE_PROJECT.benchmark.include).toContain('**/tests/performance/**/*.bench.{ts,tsx,js,jsx}');
  });
});
