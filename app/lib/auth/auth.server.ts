/**
 * Better Auth server instance
 *
 * Configures Better Auth with Drizzle adapter, Google OAuth provider,
 * and session management. Used by Remix routes for authentication.
 *
 * Based on specs/002-better-auth/research.md and plan.md
 */

import { betterAuth } from 'better-auth';
import { createAuthMiddleware } from 'better-auth/api';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '~/lib/db/drizzle.server';
import * as schema from './schema';
import { getEnvConfig } from '~/lib/config/env.server';
import { setDbConnectionError } from './session.server';

const env = getEnvConfig();

// Test database connection on startup and set fallback mode if unavailable
// Note: Connection test is done lazily on first auth operation to avoid blocking startup
// The session.server.ts module handles connection errors during runtime

/**
 * Better Auth instance with Drizzle adapter and Google OAuth
 */
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
  }),

  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Refresh after 1 day of activity
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5-minute client cache
    },
  },

  advanced: {
    useSecureCookies: env.NODE_ENV === 'production',
    cookiePrefix: 'huskit-auth',
    database: {
      generateId: false,
    },
  },

  // Security event logging hooks (FR-009)
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      // Log sign-in events for security audit
      if (ctx.path.startsWith('/sign-in')) {
        const returned = ctx.context.returned;
        const hasError = returned && typeof returned === 'object' && 'error' in returned;
        console.log('[AUTH] Sign-in event', {
          userId: ctx.context.session?.user.id,
          provider: ctx.body?.provider || 'unknown',
          success: !hasError,
          timestamp: new Date().toISOString(),
        });

        // Log account linking events (FR-002)
        // Better Auth automatically links accounts with the same email
        if (!hasError && ctx.context.session?.user) {
          const user = ctx.context.session.user;
          console.log('[AUTH] Account linking check', {
            userId: user.id,
            email: user.email,
            provider: ctx.body?.provider || 'unknown',
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Log sign-out events for security audit
      if (ctx.path.startsWith('/sign-out')) {
        console.log('[AUTH] Sign-out event', {
          userId: ctx.context.session?.user.id,
          timestamp: new Date().toISOString(),
        });
      }
    }),
  },
});

/**
 * Session type exported for use in route guards
 */
export type Session = typeof auth.$Infer.Session;

