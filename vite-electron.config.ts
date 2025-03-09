import { defineConfig } from 'vite';
import { vitePlugin as remixVitePlugin } from '@remix-run/dev';
import UnoCSS from 'unocss/vite';
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
  return {
    define: {
      __COMMIT_HASH: JSON.stringify(getGitHash()),
      __APP_VERSION: JSON.stringify(process.env.npm_package_version),
    },
    build: {
      target: 'esnext',
    },
    plugins: [
      nodePolyfills({
        include: ['path', 'buffer', 'process'],
      }),
      remixVitePlugin({
        future: {
          v3_fetcherPersist: true,
          v3_relativeSplatPath: true,
          v3_throwAbortReason: true,
          v3_lazyRouteDiscovery: true,
        },
        serverModuleFormat: 'esm',
      }),
      UnoCSS(),
      tsconfigPaths(),
      config.mode === 'production' && optimizeCssModules({ apply: 'build' }),
      {
        name: 'replaceReactDomServerImport',
        enforce: 'pre',
        transform(code, id) {
          if (id.endsWith('entry.server.tsx')) {
            /*
             * Hack: fix the issue with react-dom/server not being found in electron
             * Replace the import from 'react-dom/server' with 'react-dom/server.browser', only for electron build
             */
            return code.replace(/from 'react-dom\/server';?/g, "from 'react-dom/server.browser';");
          }

          return undefined;
        },
      },
    ],
    envPrefix: [
      'VITE_',
      'OPENAI_LIKE_API_BASE_URL',
      'OLLAMA_API_BASE_URL',
      'LMSTUDIO_API_BASE_URL',
      'TOGETHER_API_BASE_URL',
    ],
    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern-compiler',
        },
      },
    },
  };
});
