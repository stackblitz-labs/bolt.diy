import { describe, expect, it } from 'vitest';
import { detectProjectCommands } from './projectCommands';

describe('detectProjectCommands', () => {
  it('uses the package manager from the lockfile and starts the detected script', async () => {
    const commands = await detectProjectCommands([
      { path: 'package.json', content: JSON.stringify({ scripts: { dev: 'vite' } }) },
      { path: 'pnpm-lock.yaml', content: 'lockfileVersion: 9' },
    ]);

    expect(commands.setupCommand).toBe('pnpm install --no-frozen-lockfile');
    expect(commands.startCommand).toBe('pnpm run dev');
    expect(commands.followupMessage).toBe('');
  });

  it('installs a project with no start script without asking the user what to do', async () => {
    const commands = await detectProjectCommands([
      { path: 'package.json', content: JSON.stringify({ scripts: { test: 'vitest' } }) },
    ]);

    expect(commands.setupCommand).toBe('npm install --no-audit --no-fund');
    expect(commands.startCommand).toBeUndefined();
    expect(commands.followupMessage).toBe('');
  });

  it('detects package files and lockfiles inside an imported repository subfolder', async () => {
    const commands = await detectProjectCommands([
      {
        path: 'apps/web/package.json',
        content: JSON.stringify({ packageManager: 'yarn@4.1.0', scripts: { start: 'vite' } }),
      },
      { path: 'apps/web/yarn.lock', content: '# yarn lockfile' },
    ]);

    expect(commands.setupCommand).toBe('cd "apps/web" && yarn install --non-interactive');
    expect(commands.startCommand).toBe('cd "apps/web" && yarn run start');
  });

  it('starts imported static projects that do not have a package manifest', async () => {
    const commands = await detectProjectCommands([{ path: 'site/index.html', content: '<h1>Hello</h1>' }]);

    expect(commands.setupCommand).toBeUndefined();
    expect(commands.startCommand).toBe('cd "site" && npx --yes serve');
  });
});
