# Phase 0 Research – Phase 1 Implementation Plan

All open questions from the technical context have been resolved via the following decisions.

## Template Schema Standardization
- **Decision**: Use a shared `content.json` + `theme.json` contract across all templates, enforced via Zod schemas and documented in `templates/registry.json`.
- **Rationale**: Guarantees the Website Agent can inject data without template-specific branching and matches the MVP goal of predictable AI edits.
- **Alternatives considered**: Per-template schemas (too brittle, high maintenance); GraphQL content registry (overkill for MVP, adds latency); plain Markdown content (harder for precise AI edits).

## SSE Orchestrator Resilience
- **Decision**: All long-running Remix API routes (generate + modify) stream via `SwitchableStream` with 5 s heartbeats and resumable cursor tokens.
- **Rationale**: Keeps Cloudflare Pages function invocations alive beyond 30 s and lets the PCC resume progress if the browser reconnects.
- **Alternatives considered**: Long polling (wastes function invocations); WebSockets (not supported on Cloudflare Pages without Durable Objects); background jobs (adds queue infra before MVP).

## Snapshot Storage Stack
- **Decision**: Store workspace archives in R2/S3 with signed URLs while persisting metadata (template, version label, archive URL) in Postgres `site_snapshots`.
- **Rationale**: Separates large binaries from relational data, leverages existing object storage tooling, and simplifies restoration.
- **Alternatives considered**: Supabase storage (adds redundant ACL layer); storing zip blobs directly in Postgres (expensive, hard to stream); local filesystem (not durable for users).

## Intent Classification Safety
- **Decision**: Use an LLM-based classifier with confidence scoring; commands below a 0.6 confidence threshold fall back to guided form inputs rather than blind file writes.
- **Rationale**: Prevents destructive edits when prompts are ambiguous and provides a deterministic escape hatch for mission-critical updates like pricing.
- **Alternatives considered**: Regex/keyword parsing (fails on nuanced edits); executing low-confidence commands with soft validation (still risky); requiring structured forms only (kills natural-language differentiation).

