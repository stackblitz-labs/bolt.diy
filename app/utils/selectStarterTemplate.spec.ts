import JSZip from 'jszip';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loader } from '../routes/api.github-template';
import { getTemplates } from './selectStarterTemplate';

vi.mock('./constants', () => ({
  STARTER_TEMPLATES: [
    {
      name: 'test-starter',
      description: 'Offline test template',
      githubRepo: 'fixture/template',
    },
  ],
}));

const repo = 'fixture/template';
const apiUrl = `https://api.github.com/repos/${repo}`;
const projectFiles = [
  { name: 'package.json', path: 'package.json', content: '{"name":"test-starter"}' },
  { name: '.gitignore', path: '.gitignore', content: 'node_modules/' },
  { name: '.gitattributes', path: '.gitattributes', content: '* text=auto' },
  { name: 'ci.yml', path: '.github/workflows/ci.yml', content: 'name: CI' },
  { name: '.gitkeep', path: '.gitkeep', content: '' },
];
const metadataFiles = [
  { name: '.git', path: '.git', content: 'gitdir: /tmp/worktree' },
  { name: 'config', path: '.git/config', content: '[core]' },
];
const fixtureFiles = [...projectFiles, ...metadataFiles];

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('GITHUB_TOKEN', '');
  vi.stubEnv('VITE_GITHUB_ACCESS_TOKEN', '');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      throw new Error(`Unexpected fetch: ${url}`);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe.each(['ZIP', 'Cloudflare'] as const)('GitHub template loader (%s)', (method) => {
  beforeEach(async () => {
    if (method === 'ZIP') {
      const zip = new JSZip();

      for (const file of fixtureFiles) {
        zip.file(`fixture-template-v1/${file.path}`, file.content, { createFolders: false });
      }

      const archive = await zip.generateAsync({ type: 'arraybuffer' });
      const zipballUrl = `${apiUrl}/zipball/v1`;

      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) => {
          if (url === `${apiUrl}/releases/latest`) {
            return new Response(JSON.stringify({ zipball_url: zipballUrl }));
          }

          if (url === zipballUrl) {
            return new Response(archive);
          }

          throw new Error(`Unexpected fetch: ${url}`);
        }),
      );
    } else {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) => {
          if (url === apiUrl) {
            return new Response(JSON.stringify({ default_branch: 'main' }));
          }

          if (url === `${apiUrl}/git/trees/main?recursive=1`) {
            return new Response(
              JSON.stringify({
                tree: fixtureFiles.map((file) => ({ path: file.path, type: 'blob', size: file.content.length })),
              }),
            );
          }

          const file = fixtureFiles.find((entry) => url === `${apiUrl}/contents/${entry.path}`);

          if (file) {
            return new Response(JSON.stringify({ content: btoa(file.content) }));
          }

          throw new Error(`Unexpected fetch: ${url}`);
        }),
      );
    }
  });

  async function loadFiles() {
    const response = await loader({
      request: new Request(`http://localhost/api/github-template?repo=${repo}`),
      context: method === 'Cloudflare' ? { cloudflare: { env: { CF_PAGES: '1' } } } : {},
    });

    expect(response.status).toBe(200);

    return (await response.json()) as typeof fixtureFiles;
  }

  it('keeps project files whose names start with .git', async () => {
    expect(await loadFiles()).toEqual(expect.arrayContaining(projectFiles));
  });

  it('excludes the .git file and files inside the .git directory', async () => {
    const paths = (await loadFiles()).map((file) => file.path);

    expect(paths).not.toContain('.git');
    expect(paths).not.toContain('.git/config');
  });
});

describe('getTemplates', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === `/api/github-template?repo=${encodeURIComponent(repo)}`) {
          return new Response(JSON.stringify(fixtureFiles));
        }

        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );
  });

  it('includes .git-prefixed project files in the generated import actions', async () => {
    const template = await getTemplates('test-starter');

    expect(template).not.toBeNull();

    for (const file of projectFiles) {
      expect(template!.assistantMessage).toContain(`filePath="${file.path}"`);
      expect(template!.assistantMessage).toContain(file.content);
    }
  });

  it('does not generate import actions for Git metadata', async () => {
    const template = await getTemplates('test-starter');

    expect(template).not.toBeNull();
    expect(template!.assistantMessage).not.toContain('filePath=".git"');
    expect(template!.assistantMessage).not.toContain('filePath=".git/config"');
  });
});
