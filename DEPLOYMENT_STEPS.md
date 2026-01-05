# Deployment Steps: Add projects.business_profile Column

## Issue
`POST /api/projects` fails with 500 error:
```json
{
  "error": {
    "code": "SAVE_FAILED",
    "message": "Failed to create project: Could not find the 'business_profile' column of 'projects' in the schema cache"
  }
}
```

## Root Cause
The `projects` table in your hosted Supabase database is missing the `business_profile` column that the application code expects.

---

## Step 1: Apply the Migration to Hosted Supabase

### Option A: Using Supabase Dashboard (Recommended)

1. **Open Supabase SQL Editor**
   - Go to https://supabase.com/dashboard
   - Navigate to your project
   - Click "SQL Editor" in the left sidebar

2. **Run the Migration SQL**
   ```sql
   -- Add business_profile column to projects table
   -- This stores the full crawler payload (BusinessProfile) as JSONB
   
   -- Add the business_profile column if it doesn't exist
   DO $$
   BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
       AND table_name = 'projects'
       AND column_name = 'business_profile'
     ) THEN
       ALTER TABLE projects ADD COLUMN business_profile JSONB;
     END IF;
   END $$;
   
   -- Add comment for documentation
   COMMENT ON COLUMN projects.business_profile IS 'Crawler data and AI-generated content from Google Maps integration (BusinessProfile JSONB)';
   
   -- Create index for JSONB queries on session_id (commonly queried field)
   CREATE INDEX IF NOT EXISTS idx_projects_business_profile_session_id 
     ON projects USING gin ((business_profile -> 'session_id'));
   
   -- Create index for gmaps_url lookups
   CREATE INDEX IF NOT EXISTS idx_projects_business_profile_gmaps_url 
     ON projects USING gin ((business_profile -> 'gmaps_url'));
   ```

3. **Click "Run"** to execute the migration

4. **Verify the column was added**
   ```sql
   SELECT column_name, data_type, is_nullable
   FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'projects'
     AND column_name = 'business_profile';
   ```
   
   Expected output:
   ```
   column_name      | data_type | is_nullable
   -----------------|-----------|------------
   business_profile | jsonb     | YES
   ```

### Option B: Using Supabase CLI (if you have it configured)

```bash
# Push the migration to hosted Supabase
supabase db push
```

---

## Step 2: Reload PostgREST Schema Cache

After adding the column, PostgREST needs to reload its schema cache.

### Method 1: Automatic (wait 1-2 minutes)
PostgREST automatically refreshes its schema cache every few minutes. Wait 1-2 minutes and try your request again.

### Method 2: Manual Reload (instant)

**Via Supabase Dashboard:**
1. Go to "Database" → "Replication"
2. Click "Restart Database" (this forces a schema reload)
   - ⚠️ This causes ~10-30 seconds of downtime

**Via SQL (if you have service_role key):**
```sql
-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
```

---

## Step 3: Verify the Fix

### Test 1: Retry Your Original Request

```bash
curl 'http://localhost:5171/api/projects' \
  -X POST \
  -H 'Content-Type: application/json' \
  -H 'Cookie: huskit-auth.session_token=YOUR_SESSION_TOKEN' \
  --data-raw '{
    "name": "Chạm Bistro Garden",
    "gmaps_url": "https://www.google.com/maps/place/Ch%E1%BA%A1m+Bistro+Garden...",
    "address": {
      "line1": "32D Phan Đăng Lưu, Phường 06, Bình Thạnh, Thành phố Hồ Chí Minh 700000, Vietnam"
    },
    "session_id": "b8815b73-5744-45f0-8b1b-fc8b1b7f5f79",
    "businessProfile": {
      "session_id": "b8815b73-5744-45f0-8b1b-fc8b1b7f5f79",
      "gmaps_url": "...",
      "crawled_data": { ... },
      "crawled_at": "2026-01-04T10:17:30.811Z"
    }
  }'
```

**Expected Response:** `201 Created` with the project object including the `business_profile` field.

### Test 2: Verify Data Was Stored

```sql
SELECT id, name, business_profile IS NOT NULL as has_business_profile
FROM projects
ORDER BY created_at DESC
LIMIT 5;
```

### Test 3: Test GET endpoint

```bash
curl 'http://localhost:5171/api/projects/YOUR_PROJECT_ID' \
  -H 'Cookie: huskit-auth.session_token=YOUR_SESSION_TOKEN'
```

**Expected Response:** Project object with `business_profile` populated.

---

## Step 4: Update Local Dev Environment (Optional)

If you run migrations locally (via `supabase db reset` or similar):

```bash
# The new migration is already in supabase/migrations/
# Next time you reset your local DB, it will include business_profile
supabase db reset
```

---

## Troubleshooting

### Still getting "column not found" error after migration?

1. **Verify the column exists:**
   ```sql
   \d projects  -- or use information_schema query above
   ```

2. **Force PostgREST reload:**
   - Restart your Supabase project (Dashboard → Settings → General → Restart project)
   - Or wait 2-3 minutes for automatic cache refresh

3. **Check for typos:**
   - Ensure column is named `business_profile` (with underscore, not camelCase)
   - Ensure it's on the `projects` table (not `project` or similar)

### Getting 401/403 errors?

- Ensure your session cookie is valid
- Check RLS policies on the `projects` table allow INSERT for your user

### Migration fails with "permission denied"?

- You need database owner/admin permissions
- Try running via Supabase Dashboard (which uses the service role)

---

## Summary

**Files Changed:**
- ✅ `supabase/migrations/20260104120000_add_projects_business_profile.sql` (new migration)
- ✅ `app/types/project.ts` (added `business_profile` to `Project` interface)
- ✅ `app/lib/services/projects.server.ts` (updated `getProjectById()` to prefer stored `business_profile`)

**Database Changes:**
- ✅ Added `projects.business_profile` JSONB column
- ✅ Added GIN indexes for common JSONB queries

**Next Steps:**
1. Apply the migration SQL to your hosted Supabase
2. Reload PostgREST schema cache (wait or restart)
3. Retry your API request
4. Verify project creation + retrieval works

---

**Questions?** Check the migration file at `supabase/migrations/20260104120000_add_projects_business_profile.sql` for the exact SQL being applied.

