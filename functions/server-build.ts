import type { ServerBuild } from '@remix-run/cloudflare';

/**
 * This function abstracts the dynamic import of the server build.
 * The build file will be available at runtime, even though it doesn't exist during typecheck.
 */
export async function getServerBuild(): Promise<ServerBuild> {
  return import('../build/server');
}