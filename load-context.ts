import type { BoltCloudflare } from '~/lib/cloudflare-context';

/*
 * This file must stay a module (note the `export {}`), otherwise the
 * `declare module` below becomes an ambient module declaration that shadows the
 * real `react-router` module and erases all of its exports.
 *
 * React Router 8 removed `AppLoadContext`, so the augmentation targets the
 * `RouterContextProvider` class that loaders now receive as `context`.
 */
declare module 'react-router' {
  interface RouterContextProvider {
    cloudflare: BoltCloudflare;
  }
}

export {};
