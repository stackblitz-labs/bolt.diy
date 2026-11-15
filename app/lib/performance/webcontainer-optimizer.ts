import type { WebContainer } from '@webcontainer/api';
import { webcontainer } from '~/lib/webcontainer';

let webContainerInstance: WebContainer | null = null;

/**
 * Observe the app's shared WebContainer boot instead of starting a second boot.
 * The singleton is initialized when `~/lib/webcontainer` is imported.
 */
export function prebootWebContainer(): void {
  if (typeof window === 'undefined' || webContainerInstance) {
    return;
  }

  void webcontainer
    .then((instance) => {
      webContainerInstance = instance;
    })
    .catch((error) => {
      // Observe the shared promise without creating an unhandled derived rejection.
      console.error('[WEBCONTAINER] Boot failed:', error);
    });
}

/** Get the app's shared WebContainer instance. */
export function getWebContainer(): Promise<WebContainer> {
  return webcontainer;
}

/** Check if the shared WebContainer boot has completed. */
export function isWebContainerReady(): boolean {
  return webContainerInstance !== null;
}

/** Reset only the cached readiness state, primarily for tests. */
export function resetWebContainer(): void {
  webContainerInstance = null;
}

/** Preconnect to WebContainer's package CDN. */
export function getWebContainerPreconnect(): string {
  return 'https://unpkg.com';
}
