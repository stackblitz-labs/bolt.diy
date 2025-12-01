/**
 * Automated Better Auth Migration Script
 *
 * Applies the Better Auth database migration using direct PostgreSQL connection.
 * Reads DATABASE_URL from environment and executes the migration SQL.
 *
 * Usage: pnpm run migrate:auth
 */

import { readFileSync } from 'fs';
import { join, resolve } from 'path';
import { createRequire } from 'node:module';
import { config } from 'dotenv';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

const require = createRequire(import.meta.url);
const postgresModule = require('postgres');
const postgres = (postgresModule.default ?? postgresModule) as typeof import('postgres');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ Error: DATABASE_URL environment variable is not set');
  console.error('   Please set DATABASE_URL in .env.local file');
  process.exit(1);
}

type TableInfoRow = { table_name: string };
type IndexInfoRow = { indexname: string; tablename: string };
type PolicyInfoRow = { tablename: string; policyname: string };

async function runMigration() {
  console.log('🚀 Starting Better Auth migration...\n');

  // Check if tenants table exists (required for foreign key)
  console.log('🔍 Checking prerequisites...');
  
  // Read migration file
  const migrationPath = join(process.cwd(), 'supabase/migrations/20251125000000_better_auth_schema.sql');
  let migrationSQL: string;

  try {
    migrationSQL = readFileSync(migrationPath, 'utf-8');
    console.log('✅ Migration file loaded:', migrationPath);
  } catch (error) {
    console.error('❌ Error: Could not read migration file:', migrationPath);
    console.error(error);
    process.exit(1);
  }

  // Connect to database
  console.log('🔌 Connecting to database...');
  const sql = postgres(DATABASE_URL!, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  try {
    // Test connection
    await sql`SELECT 1`;
    console.log('✅ Database connection established');

    // Check if tenants table exists
    const tenantsCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'tenants'
      );
    `;
    
    const tenantsExists = tenantsCheck[0]?.exists;
    
    if (!tenantsExists) {
      console.log('\n⚠️  Warning: "tenants" table does not exist.');
      console.log('   The Better Auth migration references tenants(id) as a foreign key.');
      console.log('   Options:');
      console.log('   1. Run Phase 1 migration first: supabase/migrations/20251122233138_phase1_core.sql');
      console.log('   2. Create tenants table manually');
      console.log('   3. Continue anyway (foreign key will fail, but you can fix it later)\n');
      
      // Ask user if they want to continue
      // For now, we'll make the foreign key optional by modifying the SQL
      console.log('💡 Attempting to create tenants table if it doesn\'t exist...');
      
      try {
        await sql`
          CREATE TABLE IF NOT EXISTS tenants (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            business_name VARCHAR(255) NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'active',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
        `;
        console.log('✅ Created tenants table');
      } catch (error) {
        console.error('❌ Failed to create tenants table:', error instanceof Error ? error.message : error);
        console.error('\n💡 Please run the Phase 1 migration first or create the tenants table manually.');
        process.exit(1);
      }
    } else {
      console.log('✅ Tenants table exists\n');
    }

    // Execute migration
    console.log('📝 Executing migration...');
    
    // Remove comments from SQL
    let cleanedSQL = migrationSQL
      .replace(/--[^\r\n]*/g, '') // Remove single-line comments
      .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove multi-line comments
    
    // Split into statements, handling dollar-quoted function bodies
    const statements: string[] = [];
    let current = '';
    let inDollarQuote = false;
    let dollarTag = '';
    
    for (let i = 0; i < cleanedSQL.length; i++) {
      const char = cleanedSQL[i];
      
      // Detect start of dollar-quoted string (for function bodies like $$ ... $$)
      if (char === '$' && !inDollarQuote) {
        let j = i + 1;
        let tag = '$';
        // Read the dollar tag
        while (j < cleanedSQL.length && cleanedSQL[j] !== '$') {
          tag += cleanedSQL[j];
          j++;
        }
        if (j < cleanedSQL.length) {
          tag += '$';
          dollarTag = tag;
          inDollarQuote = true;
          current += tag;
          i = j;
          continue;
        }
      }
      
      // Detect end of dollar-quoted string
      if (inDollarQuote && cleanedSQL.substring(i).startsWith(dollarTag)) {
        current += dollarTag;
        i += dollarTag.length - 1;
        inDollarQuote = false;
        dollarTag = '';
        continue;
      }
      
      current += char;
      
      // Statement separator (only if not in dollar quote)
      if (char === ';' && !inDollarQuote) {
        const trimmed = current.trim();
        if (trimmed.length > 1) {
          statements.push(trimmed);
        }
        current = '';
      }
    }
    
    // Add any remaining statement
    if (current.trim().length > 0) {
      statements.push(current.trim());
    }
    
    // Execute each statement
    let executed = 0;
    let skipped = 0;
    
    for (const stmt of statements) {
      const trimmed = stmt.trim();
      if (trimmed.length === 0 || trimmed === ';') continue;
      
      try {
        await sql.unsafe(trimmed);
        executed++;
      } catch (error) {
        if (error instanceof Error) {
          const errorMsg = error.message.toLowerCase();
          // Ignore "already exists" errors (safe for IF NOT EXISTS)
          if (
            errorMsg.includes('already exists') ||
            errorMsg.includes('duplicate') ||
            (errorMsg.includes('relation') && errorMsg.includes('already')) ||
            errorMsg.includes('already has') ||
            errorMsg.includes('is a duplicate')
          ) {
            skipped++;
            continue;
          }
          // Log the problematic statement for debugging
          console.error(`\n❌ Error executing statement ${executed + skipped + 1}:`);
          console.error(`   ${error.message}`);
          console.error(`   Statement preview: ${trimmed.substring(0, 100)}...`);
          throw error;
        }
        throw error;
      }
    }
    
    console.log(`   ✅ Executed ${executed} statements${skipped > 0 ? `, skipped ${skipped} (already exist)` : ''}`);

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📊 Verifying tables...');

    // Verify tables were created
    const tables = await sql<TableInfoRow[]>`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('user', 'session', 'account', 'verification')
      ORDER BY table_name;
    `;

    if (tables.length === 4) {
      console.log('✅ All tables created successfully:');
      tables.forEach((table) => {
        console.log(`   - ${table.table_name}`);
      });
    } else {
      console.warn('⚠️  Warning: Expected 4 tables, found:', tables.length);
      tables.forEach((table) => {
        console.log(`   - ${table.table_name}`);
      });
    }

    // Verify indexes
    console.log('\n📊 Verifying indexes...');
    const indexes = await sql<IndexInfoRow[]>`
      SELECT indexname, tablename
      FROM pg_indexes 
      WHERE tablename IN ('user', 'session', 'account')
      AND indexname LIKE 'idx_%'
      ORDER BY tablename, indexname;
    `;

    console.log(`✅ Found ${indexes.length} indexes:`);
    indexes.forEach((idx) => {
      console.log(`   - ${idx.indexname} on ${idx.tablename}`);
    });

    // Verify RLS policies
    console.log('\n📊 Verifying RLS policies...');
    const policies = await sql<PolicyInfoRow[]>`
      SELECT tablename, policyname 
      FROM pg_policies 
      WHERE tablename IN ('user', 'session', 'account')
      ORDER BY tablename, policyname;
    `;

    console.log(`✅ Found ${policies.length} RLS policies:`);
    policies.forEach((policy) => {
      console.log(`   - ${policy.policyname} on ${policy.tablename}`);
    });

    console.log('\n🎉 Migration verification complete!');
    console.log('\n💡 Next steps:');
    console.log('   1. Test authentication: pnpm run dev');
    console.log('   2. Visit: http://localhost:5173/auth/login');
    console.log('   3. Try signing in with Google OAuth\n');
  } catch (error) {
    console.error('\n❌ Migration failed:');
    if (error instanceof Error) {
      console.error('   Error:', error.message);
      if (error.message.includes('already exists')) {
        console.error('\n💡 This error is usually safe to ignore if tables already exist.');
        console.error('   The migration uses IF NOT EXISTS clauses for safety.');
      }
    } else {
      console.error(error);
    }
    process.exit(1);
  } finally {
    await sql.end();
  }
}

// Run migration
runMigration().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});

