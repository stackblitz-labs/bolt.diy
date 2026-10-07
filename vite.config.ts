import { cloudflare } from '@cloudflare/vite-plugin';
import { reactRouter } from '@react-router/dev/vite';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import UnoCSS from 'unocss/vite';
import { defineConfig, type ViteDevServer } from 'vite';
import { optimizeCssModules } from 'vite-plugin-optimize-css-modules';
import * as dotenv from 'dotenv';

// Prevent miniflare from making an external network request to workers.cloudflare.com
// for Request.cf during local dev, which causes 3-second TimeoutError warnings.
process.env.CLOUDFLARE_CF_FETCH_ENABLED ??= 'false';

// Load environment variables without duplicate loading or console noise
dotenv.config({ path: ['.env.local', '.env'], quiet: true });

export default defineConfig((config) => {
  return {
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
      // Ensure process.cwd is defined as a function for path-browserify compatibility
      'process.cwd': '() => "/"',
    },
    resolve: {
      tsconfigPaths: true,
    },
    build: {
      target: 'esnext',
    },
    optimizeDeps: {
      include: [
        'react',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        'react-dom',
        'react-dom/client',
        'react-router',
        '@nanostores/react',
        'nanostores',
        'framer-motion',
        'ai',
        '@ai-sdk/react',
        'react-toastify',
        'js-cookie',
        'diff',
        'date-fns',
        'lucide-react',
      ],
    },
    environments: {
      client: {
        /*
         * React Router reads `build/client/.vite/manifest.json` while bundling the
         * server build. Under `@cloudflare/vite-plugin` the server build runs in
         * parallel with the client build, so the client manifest has to be
         * requested explicitly or React Router fails with ENOENT.
         */
        build: { manifest: true },
      },
    },
    plugins: [
      /*
       * Browser polyfills for `Buffer` / `process` / `global`.
       *
       * This replaces `vite-plugin-node-polyfills`, which cannot be used here: its
       * `config()` hook applies `optimizeDeps` and resolve aliases globally, and
       * under `@cloudflare/vite-plugin` the `ssr` environment is evaluated inside
       * workerd, where the plugin's CommonJS shims fail with
       * `ReferenceError: module is not defined`. Remix v2 never hit this because
       * its (now removed) Cloudflare dev proxy ran the SSR environment in Node.
       *
       * The worker does not need these: `nodejs_compat` in wrangler.jsonc provides
       * the real Node builtins. Only the browser bundle needs shimming, so this is
       * restricted to the client environment.
       *
       * The shims are imported from `vite-plugin-node-polyfills/shims/*` because
       * those are real ESM builds with named exports; the underlying `buffer`
       * package is CommonJS and exposes no named `Buffer` export.
       */
      browserPolyfills(),
      config.mode !== 'test' && cloudflare({ viteEnvironment: { name: 'ssr' } }),
      config.mode !== 'test' && reactRouter(),
      UnoCSS(),
      chrome129IssuePlugin(),
      config.mode === 'production' && optimizeCssModules({ apply: 'build' }),
    ],
    envPrefix: [
      'VITE_',
      'OPENAI_LIKE_API_BASE_URL',
      'OPENAI_LIKE_API_MODELS',
      'OLLAMA_API_BASE_URL',
      'LMSTUDIO_API_BASE_URL',
      'TOGETHER_API_BASE_URL',
    ],
    test: {
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/cypress/**',
        '**/.{idea,git,cache,output,temp}/**',
        '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
        '**/tests/preview/**', // Exclude preview tests that require Playwright
        '**/tests/e2e/**', // Exclude e2e tests that require Playwright
      ],
    },
  };
});

/**
 * `vite-plugin-node-polyfills` injects CommonJS shims that reference `module`.
 *
 * Under `@cloudflare/vite-plugin` the `ssr` environment is evaluated inside
 * workerd (the Cloudflare runner Durable Object), where modules are ESM and there
 * is no `module` binding — applying the plugin there fails the dev server with
 * `ReferenceError: module is not defined`. Remix v2 never hit this because its
 * (now removed) Cloudflare dev proxy ran the SSR environment in Node.
 *
 * The browser bundle still needs the shims, and the worker gets the real Node
 * builtins from the `nodejs_compat` compatibility flag in wrangler.jsonc, so the
 * plugin is restricted to the client environment.
 */
function browserPolyfills() {
  const shims = 'vite-plugin-node-polyfills/shims';
  const prelude = [
    `import { Buffer as __boltBuffer } from '${shims}/buffer';`,
    `import __boltProcess from '${shims}/process';`,
    `globalThis.Buffer ??= __boltBuffer;`,
    `globalThis.process ??= __boltProcess;`,
    `globalThis.global ??= globalThis;`,
  ].join('\n');

  /* Only touch modules that actually reference one of the globals. */
  const needsPolyfill = /(^|[^\w.$])(Buffer|process|global)([^\w$]|$)/;

  /*
   * Vite externalizes Node builtins for the browser before `resolve.alias` is
   * applied ("Module 'buffer' has been externalized for browser compatibility"),
   * so the mapping has to happen in `resolveId`. The replacement has to be an
   * absolute path: returning a bare specifier makes the dev server request
   * `/@id/vite-plugin-node-polyfills/shims/buffer`, which 404s.
   */
  const require = createRequire(import.meta.url);
  const polyfillsRoot = dirname(dirname(require.resolve('vite-plugin-node-polyfills')));
  const builtinAliases: Record<string, string> = {
    'node:buffer': join(polyfillsRoot, 'shims', 'buffer', 'dist', 'index.js'),
    buffer: join(polyfillsRoot, 'shims', 'buffer', 'dist', 'index.js'),
    'node:process': join(polyfillsRoot, 'shims', 'process', 'dist', 'index.js'),
    process: join(polyfillsRoot, 'shims', 'process', 'dist', 'index.js'),
  };

  return {
    name: 'bolt-browser-polyfills',
    enforce: 'pre',
    applyToEnvironment(environment: { name: string }) {
      return environment.name === 'client';
    },
    resolveId(source: string) {
      return builtinAliases[source] ?? null;
    },
    transform(code: string, id: string) {
      // Skip node_modules except for specific ones that need polyfills
      if (id.includes('node_modules')) {
        // Only inject polyfills for path-browserify and other packages that need them
        if (!id.includes('path-browserify')) {
          return null;
        }
      } else if (!/\.[cm]?[jt]sx?$/.test(id.split('?')[0])) {
        return null;
      }

      if (!needsPolyfill.test(code)) {
        return null;
      }

      return { code: `${prelude}\n${code}`, map: null };
    },
  };
}

function chrome129IssuePlugin() {
  return {
    name: 'chrome129IssuePlugin',
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        const raw = req.headers['user-agent']?.match(/Chrom(e|ium)\/([0-9]+)\./);

        if (raw) {
          const version = parseInt(raw[2], 10);

          if (version === 129) {
            res.setHeader('content-type', 'text/html');
            res.end(
              '<body><h1>Please use Chrome Canary for testing.</h1><p>Chrome 129 has an issue with JavaScript modules & Vite local development, see <a href="https://github.com/stackblitz/bolt.new/issues/86#issuecomment-2395519258">for more information.</a></p><p><b>Note:</b> This only impacts <u>local development</u>. `pnpm run build` and `pnpm run start` will work fine in this browser.</p></body>',
            );

            return;
          }
        }

        next();
      });
    },
  };
}
