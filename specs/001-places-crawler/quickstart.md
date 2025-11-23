# Quickstart – Google Places Crawler Service

## 1. Environment Setup
1. Copy `.env.example` → `.env` and fill `DATABASE_URL`, `INTERNAL_PLACES_SERVICE_URL`, `INTERNAL_PLACES_SERVICE_TOKEN`, and `OPENAI_API_KEY` (future telemetry hooks use it).
2. Install dependencies: `pnpm install` (Node ≥18.18 required).
3. Ensure Supabase is running (local or remote) and run latest migrations: `pnpm exec supabase db push` or `supabase db reset`.

## 2. Seed + Templates (if needed)
1. Clone/seed template registry to avoid downstream orchestrator failures:
   ```bash
   pnpm templates:clone
   pnpm templates:seed
   ```
2. Confirm `templates/registry.json` lists at least three premium templates used by `/api.site.generate`.

## 3. Running the App
1. Start Remix dev server (Cloudflare Pages adapter): `pnpm run dev`.
2. In a separate terminal, run integration tests on demand with mocked crawler outputs: `pnpm run test -- --runInBand tests/integration/api.site.generate.test.ts`.
3. For manual verification, hit `POST /api.site.generate` with a seeded tenant and watch SSE output in the Prompt Command Center.

## 4. Developing the Crawler Agent
1. Edit `app/lib/services/crawlerAgent.server.ts` to:
   - Call the internal Places Data Service REST endpoint.
   - Perform cache lookup (`crawled_data`) via Supabase client before remote calls.
   - Emit telemetry using `app/utils/logger.ts`.
2. Update orchestrator wiring in `app/routes/api.site.generate.ts` to pass force-refresh flags and handle new error codes.
3. Persist cache entries using `supabase.from('crawled_data')` while tagging provenance + TTL.

## 5. Testing & Validation
1. Add/extend unit tests under `tests/unit/services/crawlerAgent.test.ts` to cover:
   - Cache hit vs miss logic
   - Optional sources and provenance tracking
   - Error-code mapping
2. Add integration coverage under `tests/integration/api.site.generate.template-guardrail.test.ts` for resume flows using cached payloads.
3. Run full quality gates before submitting PR:
   ```bash
   pnpm run lint
   pnpm run typecheck
   pnpm run test
   pnpm exec vitest run tests/unit/services/crawlerAgent.test.ts
   ```

## 6. Telemetry Hooks
1. Ensure `performance.mark('crawler.request')` and heartbeat counters emit around each crawl attempt.
2. Confirm structured logs include `tenantId`, `placeId`, `cacheHit`, `quotaState`, and `sourceMix` fields.
3. Verify Grafana/console dashboards ingest new events (temporary console output acceptable until Phase 6 telemetry tasks finish).

## 7. Deployment Checklist
- [ ] Environment variables configured in Cloudflare Pages runtime.
- [ ] Internal service allowlist includes Cloudflare IPs.
- [ ] Supabase migrations applied.
- [ ] Templates cloned/seeded for the environment.
- [ ] Alerts configured for quota warnings (80%) via existing telemetry channel.
