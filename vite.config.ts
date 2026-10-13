import { cloudflare } from '@cloudflare/vite-plugin';
import { reactRouter } from '@react-router/dev/vite';
import * as dotenv from 'dotenv';
import UnoCSS from 'unocss/vite';
import { defineConfig, type ViteDevServer } from 'vite';
import { optimizeCssModules } from 'vite-plugin-optimize-css-modules';
import { browserPolyfills } from './scripts/vite/browser-polyfills.ts';

/*
 * Prevent miniflare from making an external network request to workers.cloudflare.com
 * for Request.cf during local dev, which causes 3-second TimeoutError warnings.
 */
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
        'react-router/dom',
        'remix-utils/client-only',
        '@nanostores/react',
        'nanostores',
        'zustand',
        'framer-motion',
        'ai',
        '@ai-sdk/react',
        '@ai-sdk/amazon-bedrock',
        '@ai-sdk/anthropic',
        '@ai-sdk/cerebras',
        '@ai-sdk/cohere',
        '@ai-sdk/deepseek',
        '@ai-sdk/fireworks',
        '@ai-sdk/google',
        '@ai-sdk/mistral',
        '@ai-sdk/mcp', // AI SDK 7 MCP integration
        '@modelcontextprotocol/sdk/client/index.js',
        '@modelcontextprotocol/sdk/inMemory.js',
        '@modelcontextprotocol/sdk/server/mcp.js',
        'zod',
        '@ai-sdk/openai',
        '@openrouter/ai-sdk-provider',
        'ollama-ai-provider-v2',
        '@radix-ui/react-checkbox',
        '@radix-ui/react-collapsible',
        '@radix-ui/react-context-menu',
        '@radix-ui/react-dialog',
        '@radix-ui/react-dropdown-menu',
        '@radix-ui/react-label',
        '@radix-ui/react-popover',
        '@radix-ui/react-scroll-area',
        '@radix-ui/react-switch',
        '@radix-ui/react-tabs',
        '@radix-ui/react-tooltip',
        'react-toastify',
        '@bjorn3/browser_wasi_shim',

        /*
         * These imports are added by Vite/React Router transforms, so the
         * dependency scanner cannot reliably see them before the browser does.
         * Pre-bundle them up front to avoid invalidating optimized URLs on the
         * first page load (504 "Outdated Optimize Dep").
         */
        '@octokit/rest',
        'vite-plugin-node-polyfills/shims/buffer',
        'vite-plugin-node-polyfills/shims/process',

        'class-variance-authority',
        'react-markdown',
        'remark-gfm',
        'rehype-raw',
        'rehype-sanitize',
        'unist-util-visit',
        'shiki',
        '@codemirror/autocomplete',
        '@codemirror/commands',
        '@codemirror/lang-cpp',
        '@codemirror/lang-css',
        '@codemirror/lang-html',
        '@codemirror/lang-javascript',
        '@codemirror/lang-json',
        '@codemirror/lang-markdown',
        '@codemirror/lang-python',
        '@codemirror/lang-sass',
        '@codemirror/lang-vue',
        '@codemirror/lang-wast',
        '@codemirror/language',
        '@codemirror/search',
        '@codemirror/state',
        '@codemirror/view',
        '@uiw/codemirror-theme-vscode',
        '@xterm/xterm',
        '@xterm/addon-fit',
        '@xterm/addon-web-links',
        '@webcontainer/api',
        'diff',
        'date-fns',
        'js-cookie',
        'jszip',
        'file-saver',
        'path-browserify',
        'chart.js',
        'react-chartjs-2',
        'react-resizable-panels',
        'react-dnd',
        'react-dnd-html5-backend',
        'react-window',
        'react-qrcode-logo',
        'isomorphic-git',
        'isomorphic-git/http/web',
        'istextorbinary',
        'ignore',
        'chalk',
        'lucide-react',
        'jspdf',
        'react-icons/bi',
        'react-icons/bs',
        'react-icons/fa',
        'react-icons/si',
        'react-icons/tb',
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

    /*
     * Test configuration lives in vitest.config.ts.
     *
     * It used to live here, which meant the test runner loaded this file and
     * therefore the whole application build - the Cloudflare plugin, the React
     * Router plugin, UnoCSS and the browser-polyfill transform. Those are
     * individually guarded by `config.mode !== 'test'`, but keeping them in one
     * file couples the test environment to the build graph: a plugin added for
     * the app can change how tests behave. Split apart, the runner never reads
     * this file at all.
     */
  };
});

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
