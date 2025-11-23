# Research – Google Places Crawler Service

## Decision Log

### 1. Internal Source Aggregation
- **Decision**: Rely on the internal Places Data Service REST endpoint to hydrate crawler payloads from any available source (Maps, legacy site, social) per request.
- **Rationale**: Keeps crawlerAgent thin, centralizes credential/quota management, and lets other teams extend sources without touching Remix code.
- **Alternatives considered**: (a) Direct Google Places + custom scrapers per source (duplicated auth + slower iterations); (b) Event-driven ingestion (adds queue ops burden for synchronous API.s). Both rejected for complexity and latency risk.

### 2. Cache Freshness Policy
- **Decision**: Default cache TTL at 24 hours with force-refresh support.
- **Rationale**: Matches daily refresh expectation for restaurants while keeping quota burn low and aligning with SC-002 (≥50% hit rate).
- **Alternatives considered**: (a) 1-hour TTL (better freshness but blows through quotas), (b) 7-day TTL (higher hit rate but stale data complaints). 24h balances both.

### 3. Quota Ledger Thresholds
- **Decision**: Warn at 80% of daily allowance and hard-block at 100% with `QUOTA_EXCEEDED`.
- **Rationale**: Mirrors Google Places best practices while giving operators a 20% buffer to triage before outages.
- **Alternatives considered**: (a) 90% warning (late notice) and (b) soft throttling after 70% (overly conservative, hurts throughput).

### 4. Telemetry + Observability Stack
- **Decision**: Emit structured logs via `app/utils/logger.ts` and performance marks (e.g., `performance.mark('crawler.request')`) plus heartbeat counters.
- **Rationale**: Reuses planned telemetry scaffolding (T011, T024) and keeps monitoring consistent with SSE flows.
- **Alternatives considered**: (a) New logging sink per service (splits visibility), (b) Relying solely on internal service dashboards (no tenant-level insight). Both rejected.

### 5. Error Surface Contract
- **Decision**: Define deterministic error codes (`INVALID_INPUT`, `PLACE_NOT_FOUND`, `QUOTA_EXCEEDED`, `UPSTREAM_ERROR`, `NO_SOURCE_DATA`) with remediation hints packaged in crawler responses.
- **Rationale**: PCC UI can render actionable states without guessing, and resume flows know when to ask for manual data.
- **Alternatives considered**: (a) Free-form error messages (unstructured), (b) Mirroring internal service codes directly (leaks implementation). Both rejected.
