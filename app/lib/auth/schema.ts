/**
 * Drizzle schema definitions for Better Auth tables
 *
 * Defines the database schema for user, session, account, and verification tables
 * used by Better Auth. Matches the SQL migration in supabase/migrations/.
 *
 * Based on specs/002-better-auth/data-model.md
 */

import { pgTable, uuid, varchar, text, boolean, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';

/**
 * Better Auth user table
 * Maps to spec entity: AuthenticatedUser
 */
export const user = pgTable(
  'user',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }),
    email: varchar('email', { length: 255 }).notNull().unique(),
    emailVerified: boolean('email_verified').default(false),
    image: text('image'),
    tenantId: uuid('tenant_id'), // References tenants(id) - defined in separate migration
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    emailIdx: uniqueIndex('idx_user_email').on(table.email),
    tenantIdx: index('idx_user_tenant_id').on(table.tenantId),
  }),
);

/**
 * Better Auth session table
 * Maps to spec entity: SessionEnvelope
 */
export const session = pgTable(
  'session',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    token: varchar('token', { length: 255 }).notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tokenIdx: uniqueIndex('idx_session_token').on(table.token),
    userIdx: index('idx_session_user_id').on(table.userId),
    expiresIdx: index('idx_session_expires_at').on(table.expiresAt),
  }),
);

/**
 * Better Auth account table (OAuth provider linkages)
 * Maps to spec entity: OAuthAccount
 */
export const account = pgTable(
  'account',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    providerId: varchar('provider_id', { length: 255 }).notNull(),

    /**
     * Account identifier returned by the OAuth provider.
     * Better Auth expects this field to be named accountId.
     * We still persist it in the provider_account_id column for backwards compatibility.
     */
    accountId: varchar('provider_account_id', { length: 255 }).notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    idToken: text('id_token'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index('idx_account_user_id').on(table.userId),
    providerIdx: uniqueIndex('idx_account_provider').on(table.providerId, table.accountId),
  }),
);

/**
 * Better Auth verification table (optional - for email verification)
 */
export const verification = pgTable('verification', {
  id: uuid('id').primaryKey().defaultRandom(),
  identifier: varchar('identifier', { length: 255 }).notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
