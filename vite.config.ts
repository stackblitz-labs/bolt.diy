import { cloudflareDevProxyVitePlugin as remixCloudflareDevProxy, vitePlugin as remixVitePlugin } from '@remix-run/dev';
import UnoCSS from 'unocss/vite';
import { defineConfig, type ViteDevServer } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { optimizeCssModules } from 'vite-plugin-optimize-css-modules';
import tsconfigPaths from 'vite-tsconfig-paths';

import { execSync } from 'child_process';

// Get git hash with fallback
const getGitHash = () => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'no-git-info';
  }
};


export default defineConfig((config) => {
  const isServer = process.env.NODE_ENV === 'production' && process.env.BUILDING_SERVER === 'true';
  return {
    define: {
      __COMMIT_HASH: JSON.stringify(getGitHash()),
      __APP_VERSION: JSON.stringify(process.env.npm_package_version),
      'process': JSON.stringify({
        env: process.env,
        version: process.version,
      }),
      'global': 'globalThis',
    },
    build: {
      target: 'esnext',
      rollupOptions: {
        // Mark problematic modules as external for server build
        external: isServer ? [
          'vite-plugin-node-polyfills/shims/process',
          'buffer',
          'path'
        ] : [],
        output: {
          // Ensure correct format for server build
          format: 'esm',
        },
      },
    },
    plugins: [
      nodePolyfills({
        include: ['path', 'buffer'],
        globals: {
          Buffer: true,
          global: true,
          process: true,
        },
        // Ensure polyfills are inlined during build
        protocolImports: true,
      }),
      config.mode !== 'test' && remixCloudflareDevProxy(),
      remixVitePlugin({
        future: {
          v3_fetcherPersist: true,
          v3_relativeSplatPath: true,
          v3_throwAbortReason: true,
          v3_lazyRouteDiscovery: true
        },
      }),
      UnoCSS(),
      tsconfigPaths(),
      chrome129IssuePlugin(),
      config.mode === 'production' && optimizeCssModules({ apply: 'build' }),
      // Add polyfill injection plugin
      {
        name: 'inject-polyfills',
        transform(code, id) {
          // Only inject in client builds
          if (!isServer && id.includes('entry.client')) {
            const injection = `
              import { Buffer } from 'buffer';
              window.Buffer = Buffer;
            `;
            return {
              code: injection + code,
              map: null
            };
          }
        }
      },

    ],
    
    envPrefix: ["VITE_","OPENAI_LIKE_API_BASE_URL", "OLLAMA_API_BASE_URL", "LMSTUDIO_API_BASE_URL","TOGETHER_API_BASE_URL"],
    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern-compiler',
        },
      },
    },
    optimizeDeps: {
      // Include polyfills in the optimization
      include: ['buffer', 'process'],
      needsInterop: ['buffer']
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
