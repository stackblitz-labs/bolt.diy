# Feature Specification: Langfuse LLM Observability Integration

**Feature Branch**: `001-langfuse-integration`
**Created**: 2026-01-31
**Status**: Draft
**Input**: User description: "Integrate Langfuse tracing via OpenTelemetry to monitor all LLM calls with support for Cloudflare edge runtime"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View LLM Call Traces in Langfuse Dashboard (Priority: P1)

As a developer or ops engineer, I want to see all LLM API calls from the website-agent traced in the Langfuse dashboard so that I can monitor usage, debug issues, and understand cost patterns.

**Why this priority**: This is the core value proposition - without traces appearing in Langfuse, the integration has no value. All other features depend on this working.

**Independent Test**: Deploy to staging with Langfuse credentials configured, make a chat request via `/api/chat`, then verify the trace appears in Langfuse dashboard within 30 seconds showing model name, provider, token usage, and latency.

**Acceptance Scenarios**:

1. **Given** Langfuse is enabled via environment variables, **When** a user sends a chat message via `/api/chat`, **Then** a trace appears in Langfuse dashboard with model name, provider, and token counts (prompt + completion).

2. **Given** Langfuse is enabled, **When** a user makes a direct LLM call via `/api/llmcall`, **Then** a trace appears in Langfuse showing the system prompt, user message, and response metadata.

3. **Given** Langfuse is enabled, **When** an LLM streaming response completes, **Then** the trace shows the full duration and final token usage (not partial).

4. **Given** Langfuse is enabled, **When** multiple LLM calls occur in a single chat request (e.g., summary + context selection + main response), **Then** all calls appear as nested spans within a single parent trace.

---

### User Story 2 - Track User and Session Context (Priority: P2)

As a developer analyzing LLM usage patterns, I want traces to include the authenticated user ID and session/chat ID so that I can analyze usage per user and debug user-reported issues.

**Why this priority**: Correlating traces to users is essential for debugging production issues and understanding usage patterns, but the basic tracing must work first.

**Independent Test**: Make authenticated chat requests from different user accounts, verify in Langfuse that traces are filterable by user ID and sessionId (chat ID).

**Acceptance Scenarios**:

1. **Given** a logged-in user makes a chat request, **When** the trace is recorded, **Then** the trace includes the user's ID from the session.

2. **Given** a chat conversation with multiple messages, **When** traces are recorded, **Then** all traces in the same conversation share the same sessionId (chat ID).

3. **Given** traces with user context, **When** filtering in Langfuse dashboard, **Then** I can filter traces by userId to see all LLM calls for a specific user.

---

### User Story 3 - Feature Flag Control (Priority: P2)

As an operator, I want to enable/disable Langfuse tracing via an environment variable so that I can control costs and disable tracing in environments where it's not needed.

**Why this priority**: Essential for cost control and environment management, but the integration must work before we can toggle it.

**Independent Test**: Deploy with `LANGFUSE_ENABLED=false`, verify no traces are sent. Set `LANGFUSE_ENABLED=true`, verify traces appear.

**Acceptance Scenarios**:

1. **Given** `LANGFUSE_ENABLED=false`, **When** LLM calls are made, **Then** no traces are sent to Langfuse and no overhead is added to requests.

2. **Given** `LANGFUSE_ENABLED=true` with valid credentials, **When** LLM calls are made, **Then** traces are sent to Langfuse.

3. **Given** `LANGFUSE_ENABLED=true` but credentials are missing or invalid, **When** the application starts, **Then** a warning is logged but the application continues to function (tracing fails gracefully).

---

### User Story 4 - Monitor Token Usage and Costs (Priority: P3)

As a product manager or finance stakeholder, I want to see aggregated token usage and estimated costs in Langfuse so that I can track LLM spending.

**Why this priority**: Cost tracking is important but depends on traces containing accurate token data, which is handled by P1.

**Independent Test**: Make several chat requests with different models, verify Langfuse shows token counts and cost estimates per model.

**Acceptance Scenarios**:

1. **Given** traces are recorded, **When** viewing Langfuse analytics, **Then** I can see total tokens used over time.

2. **Given** traces include model names, **When** viewing Langfuse, **Then** I can see usage breakdown by model (e.g., Claude vs GPT-4).

---

### User Story 5 - Reliable Tracing on Cloudflare Edge (Priority: P1)

As a developer deploying to Cloudflare Pages, I want traces to be reliably sent even with the 30-second edge function timeout so that no traces are lost due to streaming response patterns.

**Why this priority**: The application runs on Cloudflare edge. If traces don't work there, the entire integration fails. This is a P1 alongside basic tracing.

**Independent Test**: Deploy to Cloudflare Pages, make chat requests with streaming responses, verify all traces appear in Langfuse (none missing).

**Acceptance Scenarios**:

1. **Given** a streaming LLM response on Cloudflare edge, **When** the stream completes, **Then** the trace is flushed to Langfuse before the function terminates.

2. **Given** a long-running stream approaching the 30s timeout, **When** the response continues, **Then** partial trace data is preserved (at minimum, the trace start is recorded).

3. **Given** the OpenTelemetry SDK is incompatible with Cloudflare Workers, **When** deploying, **Then** a fallback mechanism (e.g., direct HTTP to Langfuse) is used instead.

---

### Edge Cases

- What happens when Langfuse API is unreachable? → Traces are dropped silently, LLM calls continue unaffected.
- What happens when a streaming response is interrupted by client disconnect? → Trace should still be sent with partial data and an appropriate status.
- What happens when token usage data is unavailable from the model? → Trace is sent with usage fields empty/null.
- What happens during response continuation (MAX_RESPONSE_SEGMENTS)? → All continuation calls are captured as child spans of the parent trace.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST send traces to Langfuse for all LLM calls made via `streamText()` in `stream-text.ts`.
- **FR-002**: System MUST send traces to Langfuse for all LLM calls made via `generateText()` in `api.llmcall.ts`.
- **FR-003**: System MUST include the following metadata in each trace: model name, provider name, token usage (prompt, completion, total), latency, and full prompt/response content (input messages, system prompt, LLM output).
- **FR-004**: System MUST include userId from the authenticated session when available.
- **FR-005**: System MUST include sessionId (chat ID) to group related traces.
- **FR-006**: System MUST respect the `LANGFUSE_ENABLED` environment variable to toggle tracing.
- **FR-007**: System MUST NOT block or slow down LLM responses while sending traces (async/non-blocking).
- **FR-008**: System MUST flush pending traces before Cloudflare edge function terminates.
- **FR-009**: System MUST handle Langfuse API failures gracefully without affecting LLM functionality.
- **FR-010**: System MUST support nested traces for multi-step LLM workflows (summary → context → response).

### Key Entities

- **Trace**: A single observability record representing one LLM API call, containing model info, timing, token usage, and user context.
- **Span**: A unit of work within a trace; multiple spans can be nested (e.g., parent trace with child spans for continuation calls).
- **Session**: A Langfuse session grouping related traces, mapped to chat/conversation ID.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of LLM calls via `/api/chat` and `/api/llmcall` produce corresponding traces in Langfuse (verified over 24h production sample).
- **SC-002**: Traces appear in Langfuse within 60 seconds of LLM call completion.
- **SC-003**: Token usage in Langfuse traces matches token usage logged in application logs (within 1% variance).
- **SC-004**: Enabling Langfuse adds less than 50ms overhead to LLM request latency (p95).
- **SC-005**: Zero LLM request failures caused by Langfuse integration issues (graceful degradation).
- **SC-006**: Developers can filter traces by userId and sessionId in Langfuse dashboard.

## Assumptions

- Langfuse cloud (cloud.langfuse.com) will be used; self-hosted is out of scope for initial implementation.
- The Vercel AI SDK's `experimental_telemetry` feature is stable enough for production use.
- Direct Langfuse REST API via native `fetch()` with `ctx.waitUntil()` will be used for Cloudflare edge compatibility (no OTEL SDK dependency).
- Langfuse free tier limits are sufficient for initial testing; paid tier will be used for production.

## Clarifications

### Session 2026-01-31

- Q: Should raw prompt content (user messages, system prompts, LLM responses) be sent to Langfuse? → A: Yes, capture full prompts and responses for complete visibility.
- Q: Should trace sampling be supported for production cost control? → A: No sampling; 100% trace capture always for complete visibility.
- Q: Which Cloudflare edge fallback strategy should be used? → A: Direct Langfuse REST API via native `fetch()` and `ctx.waitUntil()` for simplicity.

## Out of Scope

- Prompt management via Langfuse (storing/versioning prompts in Langfuse).
- Langfuse evaluation/scoring features.
- Custom dashboards or alerts in Langfuse.
- Tracing for non-LLM API calls (e.g., database, external services).
- Self-hosted Langfuse deployment.

## Technical Context (for planning phase)

Key files to be modified:
- `app/lib/.server/llm/stream-text.ts` - Core streaming wrapper
- `app/routes/api.chat.ts` - Main chat endpoint
- `app/routes/api.llmcall.ts` - Direct LLM call endpoint
- `.env.example` - Environment variable documentation
- `package.json` - New dependencies

New files to create:
- `app/lib/.server/telemetry/langfuse.server.ts` - Langfuse initialization and helpers

Dependencies to add:
- `langfuse` - Langfuse JS/TS SDK for trace creation and REST API client

Environment variables:
- `LANGFUSE_PUBLIC_KEY` - Langfuse project public key
- `LANGFUSE_SECRET_KEY` - Langfuse project secret key
- `LANGFUSE_BASE_URL` - Langfuse API endpoint (default: https://cloud.langfuse.com)
- `LANGFUSE_ENABLED` - Feature flag (default: false)
