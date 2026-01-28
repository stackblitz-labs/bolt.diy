import dotenv from 'dotenv';
import postgres from 'postgres';
import fs from 'fs';
import path from 'path';

// Load .env.local
dotenv.config({ path: '.env.local' });

const migrationFile = path.join(process.cwd(), 'supabase/migrations/20260128000000_add_password_to_account.sql');

async function run() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        console.error('DATABASE_URL not found in .env.local');
        process.exit(1);
    }

    // Handle potential pooler issues by forcing direct connection if possible, 
    // but we can only use what's provided.
    console.log(`Connecting to database...`);
    const sql = postgres(connectionString);

    try {
        const migrationSql = fs.readFileSync(migrationFile, 'utf8');
        console.log('Reading migration file:', migrationFile);
        console.log('Executing SQL...');

        await sql.unsafe(migrationSql);

        console.log('✅ Migration applied successfully!');
    } catch (err) {
        console.error('❌ Migration failed:', err);
        console.error('If this failed due to connection issues, try running the SQL in the Supabase Dashboard SQL Editor.');
    } finally {
        await sql.end();
    }
}

run();
