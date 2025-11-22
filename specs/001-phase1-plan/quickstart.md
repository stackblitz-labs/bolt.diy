# Quickstart – Phase 1 Implementation Plan

Use this guide to run, test, and validate the Phase 1 stack locally.

## Prerequisites
- Node 18+, pnpm 8+
- Supabase/Postgres instance (local or cloud) with `users`, `tenants`, `business_profiles`, `site_snapshots`, `crawled_data`
- R2/S3 bucket + credentials for snapshot archives
- Google Places API key (restricted to read-only endpoints)
- OpenAI/Vercel AI provider keys for the Content + Website agents

## Environment Setup
1. Copy `.env.example` → `.env.local` and fill in:
   - `DATABASE_URL` (Supabase connection string)
   - `R2_ENDPOINT`, `R2_ACCESS_KEY`, `R2_SECRET_KEY`, `R2_BUCKET`
   - `GOOGLE_PLACES_API_KEY`
   - `OPENAI_API_KEY` or provider-specific tokens
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Seed template registry and starter templates:
   ```bash
   pnpm exec ts-node scripts/templates/seed-registry.ts
   pnpm exec ts-node scripts/templates/clone-starters.ts
   ```

## Running the Agents Locally
1. Start Remix dev server with WebContainer preview:
   ```bash
   pnpm run dev
   ```
2. Launch PCC in browser (default http://localhost:5173) and open the Prompt Command Center pane.
3. Trigger initial generation via the new endpoint:
   ```bash
   curl -N -H "Content-Type: application/json" \
     -d '{"tenantId":"<uuid>","gmapsUrl":"https://maps.google.com/...?cid=..."}' \
     http://localhost:5173/api.site.generate
   ```
   The response streams `text/event-stream` events showing crawler/content/website milestones.
4. Issue edit commands using the PCC or via API:
   ```bash
   curl -N -H "Content-Type: application/json" \
     -d '{"tenantId":"<uuid>","prompt":"Change the lasagna price to $18"}' \
     http://localhost:5173/api.site.modify
   ```
5. Save a snapshot:
   ```bash
   curl -X POST -H "Content-Type: application/json" \
     -d '{"tenantId":"<uuid>","businessProfileId":"<uuid>","versionLabel":"v1"}' \
     http://localhost:5173/api.snapshot.save
   ```

## Testing & Quality Gates
Run the full suite before sending PRs:
```bash
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm exec vitest run app/routes/api.site.generate.test.ts
pnpm exec playwright test --config=playwright.config.preview.ts
```
Coverage thresholds: ≥90 % for agent runtimes, ≥80 % for touched files.

## Observability & Telemetry
- Enable verbose logging: `LOG_LEVEL=debug`
- Inspect SSE heartbeat metrics in browser devtools (`EventSource` messages include `stage`, `elapsedMs`)
- Telemetry events emit to the console and `app/utils/logger.ts`; confirm crawler/content/website durations, preview refresh latency, and snapshot upload timings appear.

## Troubleshooting
- **Cloudflare timeout warning**: ensure SSE heartbeats emit every ≤5 s; verify crawler isn’t fetching more than 50 reviews.
- **Template injection failure**: check `templates/registry.json` schema compliance and rerun seed script.
- **Snapshot restore mismatch**: confirm archive uploaded successfully (HEAD request on R2/S3) and `workspace_archive_url` points to the signed download link.

