import { vitePlugin as remixVitePlugin } from '@remix-run/dev';
import UnoCSS from 'unocss/vite';
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { optimizeCssModules } from 'vite-plugin-optimize-css-modules';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [
    remixVitePlugin(),
    UnoCSS(),
    nodePolyfills(),
    optimizeCssModules(),
    tsconfigPaths(),
  ],
  server: {
    port: 3001,
    host: '127.0.0.1',
  },
  build: {
    sourcemap: true,
  },
});