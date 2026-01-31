# Implementation Plan: Langfuse LLM Observability Integration

**Branch**: `001-langfuse-integration` | **Date**: 2026-01-31 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-langfuse-integration/spec.md`

## Summary

Integrate Langfuse LLM observability to trace all LLM calls with full metadata (model, provider, tokens, latency, prompts/responses, userId, sessionId). Uses the `langfuse` SDK directly (not OpenTelemetry) for Cloudflare Workers compatibility, with traces flushed via `ctx.waitUntil()` before edge function termination.

## Technical Context

**Language/Version**: TypeScript 5.7.2 (strict mode)
**Primary Dependencies**: Remix 2.15.2, Vercel AI SDK 4.3.16, langfuse (new)
**Storage**: N/A (traces sent to Langfuse cloud)
**Testing**: Vitest for unit tests, manual E2E verification in Langfuse dashboard
**Target Platform**: Cloudflare Pages (edge functions, 30s timeout)
**Performance Goals**: <50ms p95 overhead per LLM call (SC-004)
**Constraints**: Non-blocking async tracing, graceful degradation on failures

## Architecture

### Trace Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│  API Route (api.chat.ts)                                        │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Parent Trace                                               ││
│  │  - traceId: uuid                                            ││
│  │  - userId: session.user.id                                  ││
│  │  - sessionId: chatId                                        ││
│  │  - metadata: { chatMode, restaurantThemeId, ... }           ││
│  │                                                             ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      ││
│  │  │ Generation 1 │  │ Generation 2 │  │ Generation 3 │      ││
│  │  │ createSummary│  │ selectContext│  │ streamText   │      ││
│  │  │ (if enabled) │  │ (span only)  │  │ (main LLM)   │      ││
│  │  └──────────────┘  └──────────────┘  └──────────────┘      ││
│  │                                              │               ││
│  │                                    ┌────────┴────────┐      ││
│  │                                    │ Generation 3a   │      ││
│  │                                    │ Continuation    │      ││
│  │                                    │ (if needed)     │      ││
│  │                                    └─────────────────┘      ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ctx.waitUntil(langfuse.flushAsync())  <-- Before response ends │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
Request → Create Trace → Create Generations → Capture Usage → Flush via waitUntil
                ↓              ↓                    ↓
           userId/sessionId  model/provider    tokens/latency/content
```

## Project Structure

### Documentation (this feature)

```text
specs/001-langfuse-integration/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 research (below)
├── checklists/
│   └── requirements.md  # Validation checklist
└── contracts/           # N/A (no new API contracts)
```

### Source Code Changes

```text
app/lib/.server/telemetry/
└── langfuse.server.ts   # NEW: Langfuse client singleton and helpers

app/routes/
├── api.chat.ts          # MODIFY: Add parent trace, wrap LLM calls
└── api.llmcall.ts       # MODIFY: Add trace for direct LLM calls

worker-configuration.d.ts  # MODIFY: Add Langfuse env var types
.env.example               # MODIFY: Add Langfuse configuration
package.json               # MODIFY: Add langfuse dependency
```

---

## Phase 0: Research

### Decision 1: SDK Choice
- **Decision**: Use `langfuse` npm package (NOT `@langfuse/otel` or `@langfuse/tracing`)
- **Rationale**: The OpenTelemetry packages require Node.js ≥20 and use `NodeSDK`/`NodeTracerProvider` which are incompatible with Cloudflare Workers. The core `langfuse` package uses the Fetch API and is edge-compatible.
- **Alternatives Rejected**: `@langfuse/otel` (Node.js only), direct REST API (more code, SDK provides better DX)

### Decision 2: Flush Pattern
- **Decision**: Use `context.cloudflare?.ctx?.waitUntil(langfuse.flushAsync())`
- **Rationale**: Cloudflare Workers terminate immediately after returning a response. `waitUntil()` extends the worker lifetime to complete the flush without blocking the response.
- **Alternatives Rejected**: Blocking flush (adds latency), no flush (traces lost)

### Decision 3: Trace Context Propagation
- **Decision**: Pass trace context explicitly through function parameters
- **Rationale**: Simpler than AsyncLocalStorage (which has edge runtime issues), explicit data flow is easier to debug
- **Alternatives Rejected**: AsyncLocalStorage (edge compatibility concerns), global context (race conditions)

### Decision 4: Content Capture
- **Decision**: Capture full prompts and responses (per clarification)
- **Rationale**: Complete visibility for debugging and cost analysis
- **Alternatives Rejected**: Metadata only (less useful for debugging)

---

## Phase 1: Implementation Details

### 1. New File: `app/lib/.server/telemetry/langfuse.server.ts`

```typescript
import { Langfuse } from 'langfuse';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('langfuse');

// Types
export interface LangfuseTraceContext {
  traceId: string;
  userId?: string;
  sessionId?: string;
  parentObservationId?: string;
}

export interface GenerationMetadata {
  model: string;
  provider: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  latencyMs?: number;
  input?: { systemPrompt?: string; messages?: Array<{ role: string; content: string }> };
  output?: string;
  finishReason?: string;
}

// Singleton client
let langfuseInstance: Langfuse | null = null;

export function getLangfuseClient(env?: Env): Langfuse | null {
  if (env?.LANGFUSE_ENABLED !== 'true') return null;
  if (!env?.LANGFUSE_PUBLIC_KEY || !env?.LANGFUSE_SECRET_KEY) {
    logger.warn('Langfuse enabled but credentials missing');
    return null;
  }

  if (langfuseInstance) return langfuseInstance;

  try {
    langfuseInstance = new Langfuse({
      publicKey: env.LANGFUSE_PUBLIC_KEY,
      secretKey: env.LANGFUSE_SECRET_KEY,
      baseUrl: env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com',
      flushAt: 1,
      flushInterval: 0,
    });
    return langfuseInstance;
  } catch (error) {
    logger.error('Failed to initialize Langfuse:', error);
    return null;
  }
}

export function isLangfuseEnabled(env?: Env): boolean {
  return env?.LANGFUSE_ENABLED === 'true' && !!env?.LANGFUSE_PUBLIC_KEY && !!env?.LANGFUSE_SECRET_KEY;
}

export function createTrace(env: Env | undefined, options: {
  name: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
  input?: any;
}): LangfuseTraceContext | null {
  const client = getLangfuseClient(env);
  if (!client) return null;

  try {
    const trace = client.trace({
      name: options.name,
      userId: options.userId,
      sessionId: options.sessionId,
      metadata: options.metadata,
      input: options.input,
    });
    return { traceId: trace.id, userId: options.userId, sessionId: options.sessionId };
  } catch (error) {
    logger.error('Failed to create trace:', error);
    return null;
  }
}

export function createGeneration(
  env: Env | undefined,
  traceContext: LangfuseTraceContext,
  options: { name: string; model: string; modelParameters?: Record<string, any>; input?: any; startTime?: Date }
): { generationId: string; end: (metadata: Partial<GenerationMetadata>) => void } | null {
  const client = getLangfuseClient(env);
  if (!client) return null;

  try {
    const startTime = options.startTime || new Date();
    const generation = client.generation({
      traceId: traceContext.traceId,
      parentObservationId: traceContext.parentObservationId,
      name: options.name,
      model: options.model,
      modelParameters: options.modelParameters,
      input: options.input,
      startTime,
    });

    return {
      generationId: generation.id,
      end: (metadata: Partial<GenerationMetadata>) => {
        try {
          generation.end({
            output: metadata.output,
            usage: {
              promptTokens: metadata.promptTokens,
              completionTokens: metadata.completionTokens,
              totalTokens: metadata.totalTokens,
            },
            metadata: { provider: metadata.provider, finishReason: metadata.finishReason },
            endTime: new Date(),
          });
        } catch (error) {
          logger.error('Failed to end generation:', error);
        }
      },
    };
  } catch (error) {
    logger.error('Failed to create generation:', error);
    return null;
  }
}

export async function flushTraces(env?: Env): Promise<void> {
  const client = getLangfuseClient(env);
  if (!client) return;

  try {
    await client.flushAsync();
    logger.debug('Traces flushed successfully');
  } catch (error) {
    logger.error('Failed to flush traces:', error);
  }
}
```

### 2. Modify: `app/routes/api.chat.ts`

**Key Integration Points:**

| Line | Action | Description |
|------|--------|-------------|
| ~22 | Add imports | Import Langfuse helpers |
| ~152 | Create trace | Parent trace with userId, sessionId |
| ~318-333 | Wrap createSummary | Create generation, capture usage in onFinish |
| ~490-521 | Wrap main streamText | End generation in onFinish callback |
| ~736 | Add waitUntil | Flush traces before response |

**Code Changes:**

```typescript
// After line 22 - Add imports
import {
  createTrace, createGeneration, flushTraces, isLangfuseEnabled,
  type LangfuseTraceContext,
} from '~/lib/.server/telemetry/langfuse.server';

// After line 152 - Create parent trace
const env = context.cloudflare?.env;
const traceContext = createTrace(env, {
  name: 'chat-request',
  userId: session?.user?.id,
  sessionId: chatId, // Extract from request body
  metadata: { chatMode, restaurantThemeId, contextOptimization },
});

// Around line 318 - Wrap createSummary
const summaryGeneration = traceContext ? createGeneration(env, traceContext, {
  name: 'create-summary',
  model: currentModel || 'unknown',
}) : null;
const summaryStartTime = performance.now();
// In onFinish callback:
summaryGeneration?.end({
  promptTokens: resp.usage.promptTokens,
  completionTokens: resp.usage.completionTokens,
  latencyMs: performance.now() - summaryStartTime,
  output: resp.text?.slice(0, 1000),
});

// Around line 618 - Wrap main streamText
const mainGeneration = traceContext ? createGeneration(env, traceContext, {
  name: 'stream-text-main',
  model: currentModel || 'unknown',
}) : null;
const mainStartTime = performance.now();
// In onFinish callback:
mainGeneration?.end({
  promptTokens: usage?.promptTokens,
  completionTokens: usage?.completionTokens,
  latencyMs: performance.now() - mainStartTime,
  output: content?.slice(0, 2000),
  finishReason,
});

// Before return Response - Flush traces
if (isLangfuseEnabled(env)) {
  context.cloudflare?.ctx?.waitUntil(flushTraces(env));
}
```

### 3. Modify: `app/routes/api.llmcall.ts`

**Key Integration Points:**

| Line | Action | Description |
|------|--------|-------------|
| ~12 | Add imports | Import Langfuse helpers |
| ~67 | Create trace | Parent trace for direct LLM call |
| ~99-151 | Wrap streamText | Create generation for streaming mode |
| ~152-240 | Wrap generateText | Create generation for non-streaming mode |

### 4. Modify: `worker-configuration.d.ts`

```typescript
interface Env {
  // ... existing keys ...

  // Langfuse LLM Observability
  LANGFUSE_ENABLED?: string;
  LANGFUSE_PUBLIC_KEY?: string;
  LANGFUSE_SECRET_KEY?: string;
  LANGFUSE_BASE_URL?: string;
}
```

### 5. Modify: `.env.example`

```bash
# ============================================================================
# Langfuse LLM Observability (Optional)
# ============================================================================
LANGFUSE_ENABLED=false
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
# LANGFUSE_BASE_URL=https://cloud.langfuse.com
```

### 6. Modify: `package.json`

```json
{
  "dependencies": {
    "langfuse": "^3.30.0"
  }
}
```

---

## Implementation Sequence

| Order | Task | File(s) | FR Coverage |
|-------|------|---------|-------------|
| 1 | Add langfuse dependency | package.json | - |
| 2 | Add Langfuse env types | worker-configuration.d.ts | FR-006 |
| 3 | Update .env.example | .env.example | FR-006 |
| 4 | Create telemetry module | app/lib/.server/telemetry/langfuse.server.ts | FR-007, FR-008, FR-009 |
| 5 | Integrate api.chat.ts | app/routes/api.chat.ts | FR-001, FR-003, FR-004, FR-005, FR-010 |
| 6 | Integrate api.llmcall.ts | app/routes/api.llmcall.ts | FR-002, FR-003 |
| 7 | Test locally | - | All |
| 8 | Deploy & verify | Cloudflare Pages | SC-001 to SC-006 |

---

## Verification Plan

### Local Testing
1. Set `LANGFUSE_ENABLED=true` and credentials in `.env.local`
2. Run `pnpm dev`
3. Make chat request via UI or curl
4. Verify trace appears in Langfuse dashboard

### Production Verification
1. Deploy to Cloudflare Pages with Langfuse env vars
2. Make authenticated chat requests
3. Verify in Langfuse:
   - Traces appear within 60s (SC-002)
   - userId and sessionId are present (SC-006)
   - Token usage matches app logs (SC-003)
   - Nested spans for multi-step calls (FR-010)

### Graceful Degradation Test
1. Set `LANGFUSE_ENABLED=true` with invalid credentials
2. Verify app starts and functions normally
3. Verify warning logged but no errors thrown

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| SDK incompatible with Cloudflare | Using `langfuse` (not OTEL packages) - verified edge-compatible |
| Lost traces on streaming | Using `ctx.waitUntil()` for flush after response |
| Performance overhead | Async/non-blocking design, <50ms target |
| Sensitive data in traces | Full content capture per spec; configurable in Langfuse settings |
| Credential exposure | Env vars only, never in code or logs |

---

## Dependencies

- **New**: `langfuse@^3.30.0`
- **Existing**: Vercel AI SDK (provides usage data), Remix (route handlers)

## Success Criteria Mapping

| Success Criteria | Implementation |
|------------------|----------------|
| SC-001: 100% trace coverage | All streamText/generateText wrapped |
| SC-002: <60s to Langfuse | Direct SDK with flushAsync |
| SC-003: Token accuracy | Using AI SDK's usage object |
| SC-004: <50ms overhead | Non-blocking async design |
| SC-005: Zero failures from tracing | Try/catch with graceful degradation |
| SC-006: Filter by userId/sessionId | Passed to createTrace |
