import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

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
export function browserPolyfills() {
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
      /*
       * Bundler-generated modules (including Rolldown's runtime) must not import
       * the polyfills: the polyfills themselves depend on that runtime.
       */
      if (id.startsWith('\0')) {
        return null;
      }

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
