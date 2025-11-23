# Data Model – Google Places Crawler Service

The crawlerAgent shares core tables with Phase 1 (Postgres via Supabase) but adds stricter contracts for requests, cached payloads, and quota tracking.

## Entities

### CrawlRequest (transient)
| Field | Type | Validation / Notes |
|-------|------|--------------------|
| `tenantId` | UUID | Must match authenticated tenant scope before issuing a crawl.
| `sourceUrl` | string | Required HTTPS URL; validated to be Google Maps or a whitelisted domain.
| `placeId` | string | Optional; derived from `sourceUrl` when absent.
| `forceRefresh` | boolean | Default `false`; bypasses cache when `true` and records invalidation reason.
| `requestedSections` | string[] | Optional subset of `['identity','contact','hours','menu','reviews','media']`; defaults to all.
| `correlationId` | string | UUID for tracing across SSE streams.

### CrawlResult (transient/response payload)
| Field | Type | Validation / Notes |
|-------|------|--------------------|
| `tenantId` | UUID | Echoes request scope.
| `placeId` | string | Required; unique per business.
| `sourcesUsed` | array<{ `type`: 'maps' \| 'website' \| 'social', `timestamp`: timestamptz }> | Empty when `NO_SOURCE_DATA`; informs provenance badges.
| `freshness` | timestamptz | When payload was generated (cache or live).
| `sections` | object | Structured summary for identity/contact/hours/menu/reviews/media with per-section completeness flags.
| `missingSections` | string[] | Populated when data absent so PCC can request manual entry.
| `cacheHit` | boolean | Indicates reused payload.
| `error` | object? | `{ code, message, remediation }` when call failed.

### CacheEntry (`crawled_data` row)
| Field | Type | Validation / Notes |
|-------|------|--------------------|
| `id` | UUID | Primary key.
| `tenant_id` | UUID | FK to tenant; enforced in Supabase.
| `place_id` | string | Unique per tenant; composite index `(tenant_id, place_id)`.
| `source_url` | string | Original Google Maps URL provided.
| `raw_payload` | JSONB | Stores full response from internal service (≤2 MB).
| `normalized_summary` | JSONB | Subset used by content agent.
| `status` | enum(`pending`,`completed`,`failed`,`invalidated`) | Drives retries and manual invalidation.
| `cache_expires_at` | timestamptz | `created_at + 24h` by default; updated when force-refresh occurs.
| `created_at`/`updated_at` | timestamptz | Auto-managed.

### QuotaLedger (in-memory + persisted snapshots)
| Field | Type | Validation / Notes |
|-------|------|--------------------|
| `apiKeyAlias` | string | Identifier for internal service key/bucket.
| `dailyLimit` | integer | Provided by internal service configuration.
| `dailyConsumed` | integer | Incremented on each crawl.
| `minuteLimit` | integer | Optional burst limit.
| `minuteConsumed` | integer | Sliding window counter.
| `warningThreshold` | float | Default `0.8` (80%).
| `resetAt` | timestamptz | Next quota reset (UTC midnight).
| `lastUpdated` | timestamptz | For telemetry snapshots.

## Relationships
- `CrawlRequest` references tenant context and feeds `CrawlResult`.
- `CrawlResult` optionally materializes into a `CacheEntry` when successful.
- `CacheEntry` ties to `QuotaLedger` only through telemetry (ledger not persisted per tenant but per API key bucket).

## Derived Data & Validation Rules
- Cached payload reuse allowed only when `cache_expires_at > now()` **and** `tenant_id` matches request.
- Manual invalidation sets `status='invalidated'`, copies old payload to audit log (not covered in this plan) and writes `cache_expires_at=now()`.
- `missingSections` must align with `requestedSections`; sections not requested are not treated as missing.
- `sourcesUsed` must list each contributing source once per crawl to keep telemetry consistent.
