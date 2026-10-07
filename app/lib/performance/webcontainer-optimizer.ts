/**
 * WebContainer Initialization Optimizer
 * Preload and cache WebContainer API for faster boot times
 */

let webContainerBootPromise: Promise<any> | null = null;
let webContainerInstance: any = null;

/**
 * Start booting WebContainer in the background
 * Call this early (e.g., on app mount) to parallelize the boot
 */
export function prebootWebContainer(): void {
  if (typeof window === 'undefined') {
    return;
  }

  if (webContainerBootPromise) {
    return; // Already booting
  }

  // Start the boot process in the background
  webContainerBootPromise = import('@webcontainer/api')
    .then(({ WebContainer }) => {
      console.log('[WEBCONTAINER] API loaded, starting boot...');
      return WebContainer.boot();
    })
    .then((instance) => {
      console.log('[WEBCONTAINER] Booted successfully');
      webContainerInstance = instance;

      return instance;
    })
    .catch((error) => {
      console.error('[WEBCONTAINER] Boot failed:', error);

      // Reset so it can be retried
      webContainerBootPromise = null;
      throw error;
    });
}

/**
 * Get the WebContainer instance
 * If boot was started with prebootWebContainer(), this will be fast
 * Otherwise, it will start the boot now
 */
export async function getWebContainer(): Promise<any> {
  if (webContainerInstance) {
    return webContainerInstance;
  }

  if (!webContainerBootPromise) {
    prebootWebContainer();
  }

  return webContainerBootPromise!;
}

/**
 * Check if WebContainer is ready
 */
export function isWebContainerReady(): boolean {
  return webContainerInstance !== null;
}

/**
 * Reset WebContainer state (useful for testing)
 */
export function resetWebContainer(): void {
  webContainerBootPromise = null;
  webContainerInstance = null;
}

/**
 * Preconnect to WebContainer CDN
 * This should be added to the HTML head for DNS/TCP preflight
 */
export function getWebContainerPreconnect(): string {
  return 'https://unpkg.com'; // WebContainer uses unpkg for packages
}
