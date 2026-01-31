import { cloudflareDevProxyVitePlugin as remixCloudflareDevProxy, vitePlugin as remixVitePlugin } from '@remix-run/dev';
import UnoCSS from 'unocss/vite';
import { defineConfig, type ViteDevServer } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { optimizeCssModules } from 'vite-plugin-optimize-css-modules';
import tsconfigPaths from 'vite-tsconfig-paths';
import * as dotenv from 'dotenv';

// Load environment variables from multiple files
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });
dotenv.config();

export default defineConfig((config) => {
  return {
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    },
    resolve: {
      alias: {
        // Note: path alias moved to plugin for SSR-aware handling
        '@smithy/core/dist-es/getSmithyContext': '/test/stubs/smithy-get.ts',
        '@smithy/core/dist-es': '/test/stubs/smithy-index.ts',
      },
      // Prevent esbuild from trying to resolve node: protocol imports
      conditions: ['import', 'module', 'browser', 'default'],
    },
    server: {
      port: 5171,
      strictPort: false, // Allow fallback to next available port if 5171 is busy
    },
    build: {
      target: 'esnext',
      commonjsOptions: {
        transformMixedEsModules: true,
      },
    },
    optimizeDeps: {
      // Exclude server-only packages that use Node.js built-ins
      exclude: [
        'undici',
        'postgres',
        'postgres-js',
        '@aws-sdk/util-user-agent-node',
        '@aws-sdk/client-bedrock-runtime',
        '@aws-sdk/client-s3',
        '@aws-sdk/s3-request-presigner',
        '@aws-sdk/lib-storage',
        'chalk', // Server-only library that uses node:tty
      ],
      esbuildOptions: {
        // Mark node: protocol imports and AWS SDK packages as external
        external: [
          'node:util/types',
          '@aws-sdk/*',
        ],
        // Prevent Cloudflare-specific code from being bundled
        platform: 'node',
      },
    },
    plugins: [
      nodePolyfills({
        include: ['buffer', 'process', 'util', 'stream'],
        globals: {
          Buffer: true,
          process: true,
          global: true,
        },
        protocolImports: true,
        exclude: ['child_process', 'fs', 'path'],
      }),
      {
        name: 'path-browserify-client-only',
        enforce: 'pre',
        resolveId(id, importer, options) {
          // Only alias 'path' to 'path-browserify' for client-side code
          // Server-side (.server files) should use native Node.js path
          if (id === 'path') {
            // Check if this is SSR or a server file
            const isSsr = options?.ssr === true;
            const isServerFile = importer?.includes('.server');

            if (isSsr || isServerFile) {
              // Use native Node.js path module
              return { id: 'path', external: true };
            }

            // For client-side, use path-browserify
            return 'path-browserify';
          }
          return null;
        },
      },
      {
        name: 'fix-node-protocol-imports',
        enforce: 'pre',
        resolveId(id) {
          // Mark node: protocol imports as external to prevent esbuild from resolving them
          if (id.startsWith('node:')) {
            return { id, external: true };
          }
          return null;
        },
      },
      {
        name: 'prevent-cloudflare-protocol-imports',
        enforce: 'pre',
        resolveId(id, importer) {
          // Prevent cloudflare: protocol from being resolved during module loading
          // This causes ERR_UNSUPPORTED_ESM_URL_SCHEME errors in Node.js
          // postgres-js tries to use cloudflare: imports when it detects Cloudflare Workers
          if (id.startsWith('cloudflare:')) {
            // Return a virtual module stub - postgres-js should fall back to Node.js implementation
            return `\0virtual:cloudflare-stub`;
          }
          return null;
        },
        load(id) {
          // Handle the virtual stub for cloudflare: imports
          if (id === '\0virtual:cloudflare-stub') {
            // Return an empty module - this prevents the error and allows fallback to Node.js code
            return 'export default null; export const CloudflareEnvironment = undefined;';
          }
          return null;
        },
      },
      {
        name: 'buffer-polyfill',
        transform(code, id) {
          if (id.includes('env.mjs')) {
            return {
              code: `import { Buffer } from 'buffer';\n${code}`,
              map: null,
            };
          }

          return null;
        },
      },
      {
        name: 'fix-process-exports',
        enforce: 'pre',
        resolveId(id, importer) {
          // Intercept process imports from node_modules that need named exports
          // This is needed for AWS SDK which imports { env, versions } from 'process'
          if (id === 'process' && importer && importer.includes('node_modules')) {
            // Only intercept if coming from packages that need named exports
            // Let nodePolyfills handle other cases
            if (importer.includes('@aws-sdk') || importer.includes('aws-sdk')) {
              return '\0process-enhanced';
            }
          }
          return null;
        },
        load(id) {
          // Provide enhanced process polyfill with named exports
          if (id === '\0process-enhanced') {
            return `
              // Enhanced process polyfill with named exports for AWS SDK compatibility
              const processEnv = typeof process !== 'undefined' && process.env 
                ? process.env 
                : {};
              const processVersions = typeof process !== 'undefined' && process.versions 
                ? process.versions 
                : { node: '18.0.0' };
              
              // Create process object with all properties
              const processObj = typeof process !== 'undefined' 
                ? Object.assign({}, process, { env: processEnv, versions: processVersions })
                : { env: processEnv, versions: processVersions };
              
              // Named exports that AWS SDK needs
              export const env = processEnv;
              export const versions = processVersions;
              
              // Default export
              export default processObj;
            `;
          }
          return null;
        },
      },
      {
        name: 'exclude-chalk-from-client',
        enforce: 'pre',
        resolveId(id, importer) {
          // Prevent chalk from being bundled in client code
          // Chalk uses node:tty which doesn't work in browsers
          if (id === 'chalk' && importer && !importer.includes('.server.') && !importer.includes('node_modules/chalk')) {
            // Only block if it's being imported in client code
            // Check if this is a server-only file
            if (importer.includes('.server.') || importer.includes('server')) {
              return null; // Allow in server files
            }
            // Return a stub for client code
            return '\0chalk-stub';
          }
          return null;
        },
        load(id) {
          if (id === '\0chalk-stub') {
            // Return a stub chalk that doesn't use node:tty
            return `
              // Chalk stub for client-side - returns plain text
              export const Chalk = class {
                constructor() {}
                bgHex() { return this; }
                hex() { return this; }
              };
              export default {
                bgHex: () => (text) => text,
                hex: () => (text) => text,
              };
            `;
          }
          return null;
        },
      },
      config.mode !== 'test' && remixCloudflareDevProxy(),
      {
        name: 'handle-well-known-requests',
        configureServer(server: ViteDevServer) {
          server.middlewares.use((req, res, next) => {
            // Handle .well-known requests (Chrome DevTools, etc.) before they reach Remix
            if (req.url?.startsWith('/.well-known/')) {
              res.writeHead(404, { 'Content-Type': 'text/plain' });
              res.end('Not Found');
              return;
            }
            next();
          });
        },
      },
      remixVitePlugin({
        future: {
          v3_fetcherPersist: true,
          v3_relativeSplatPath: true,
          v3_throwAbortReason: true,
          v3_lazyRouteDiscovery: true,
        },
      }),
      UnoCSS(),
      tsconfigPaths(),
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
    ssr: {
      // Don't apply browser polyfills in SSR - use native Node.js modules
      external: ['path', 'fs', 'fs/promises'],
    },
    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern-compiler',
        },
      },
    },
    test: {
      environment: 'node',
      setupFiles: ['./vitest.setup.ts'],
      deps: {
        inline: [
          'ollama-ai-provider',
          '@ai-sdk/provider-utils',
          'style-to-object',
          'style-to-js',
          '@web3-storage/multipart-parser',
          '@web3-storage/multipart-parser/esm/src/index.js',
          '@smithy/core',
        ],
        interopDefault: true,
      },
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/cypress/**',
        '**/.{idea,git,cache,output,temp}/**',
        '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
        '**/tests/preview/**', // Exclude preview tests that require Playwright
      ],
    },
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