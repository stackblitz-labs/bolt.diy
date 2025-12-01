/**
 * Drizzle ORM client singleton for PostgreSQL
 *
 * Provides type-safe database access using Drizzle ORM with PostgreSQL.
 * Used by Better Auth adapter and other database operations.
 *
 * IMPORTANT: This module requires Node.js runtime. It will not work in
 * Cloudflare Workers environment.
 *
 * Based on specs/002-better-auth/plan.md
 */

import { createRequire } from 'node:module';

/*
 * CRITICAL: Prevent postgres-js from detecting Cloudflare Workers environment
 * This must happen BEFORE any imports to prevent cloudflare: protocol errors
 */
if (typeof globalThis !== 'undefined' && typeof process !== 'undefined' && process.versions?.node) {
  const g = globalThis as any;

  /*
   * Remove all Cloudflare Workers detection indicators
   * postgres-js and drizzle-orm check for these to decide whether to use cloudflare: imports
   */
  delete g.CloudflareEnvironment;
  delete g.caches;
  delete g.ServiceWorkerGlobalScope;

  // Explicitly mark as Node.js environment
  g.__NODE_ENV_DETECTED__ = true;
  g.__RUNTIME__ = 'node';

  // Set environment variables to force Node.js mode
  if (process.env) {
    process.env.POSTGRES_JS_RUNTIME = 'node';
    process.env.RUNTIME = 'node';

    // Remove Cloudflare-specific environment variables
    delete process.env.CF_PAGES;
    delete process.env.CF_PAGES_BRANCH;
    delete process.env.CF_PAGES_COMMIT_SHA;
    delete process.env.CF_PAGES_URL;
    delete process.env.WORKERS_ENV;
  }

  /*
   * Override any Cloudflare Workers type detection
   * Check if @cloudflare/workers-types is causing detection
   */
  if (typeof g.navigator !== 'undefined' && g.navigator.serviceWorker) {
    // In Node.js, serviceWorker should be undefined
    Object.defineProperty(g.navigator, 'serviceWorker', {
      value: undefined,
      writable: false,
      configurable: false,
    });
  }
}

// Ensure we're in a Node.js environment before importing postgres-js
if (typeof process === 'undefined' || !process.versions?.node) {
  throw new Error(
    'Database connection requires Node.js environment. ' + 'postgres-js does not support Cloudflare Workers runtime.',
  );
}

import { drizzle } from 'drizzle-orm/postgres-js';
import { getEnvConfig } from '~/lib/config/env.server';

// Force-load the Node.js (CommonJS) build of postgres to avoid Cloudflare protocol imports
const require = createRequire(import.meta.url);
const postgresModule = require('postgres');
const postgres = (postgresModule.default ?? postgresModule) as typeof import('postgres');

// Singleton instance
let dbInstance: ReturnType<typeof drizzle> | null = null;

/**
 * Get or create Drizzle database client singleton
 *
 * @returns Drizzle database client instance
 */
export function getDb() {
  if (!dbInstance) {
    const env = getEnvConfig();

    try {
      /*
       * Configure postgres client with explicit Node.js settings
       * This helps prevent Cloudflare Workers detection
       */
      const client = postgres(env.DATABASE_URL, {
        max: 10,
        idle_timeout: 20,
        connect_timeout: 10,
        prepare: true,

        // Explicit connection options for Node.js
        connection: {
          // Force TCP connection (Node.js mode) instead of Cloudflare Workers mode
          application_name: 'huskit-nodejs',
        },
      });

      dbInstance = drizzle(client);
    } catch (error) {
      // If initialization fails due to Cloudflare detection, provide helpful error
      if (error instanceof Error && error.message.includes('cloudflare')) {
        throw new Error(
          'Database connection failed: postgres-js detected Cloudflare Workers environment. ' +
            'This is a development server issue. Please ensure you are running in Node.js mode. ' +
            `Original error: ${error.message}`,
        );
      }

      throw error;
    }
  }

  return dbInstance;
}

/*
 * Export as default for convenience
 * Note: Better Auth adapter requires this to be synchronous
 */
export const db = getDb();
