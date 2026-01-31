---
name: planning-quality
description: "Website-agent planning gate with architecture layer enforcement, Cloudflare/WebContainer constraints, and boundary verification. Triggers: 'plan feature', 'architecture review', 'design review', 'API route design', 'streaming plan', 'Cloudflare timeout', 'WebContainer', 'server boundary', '.server rules', 'beads planning', 'speckit plan'."
---

# Website-Agent Planning Quality Gate

A planning gate tailored to the website-agent (bolt.diy fork) Remix 2.15 + TypeScript + Cloudflare Pages + WebContainer architecture. Ensures plans respect project boundaries, runtime constraints, and verification requirements before implementation.

## When to Use

- Planning new features or systems
- Reviewing architecture before implementation
- Designing streaming/API routes
- Planning WebContainer runtime changes
- Modifying state/persistence patterns
- Adding integrations or services

## Non-Negotiable Constraints (Project Reality)

### Cloudflare Pages
- **30s hard timeout**: All requests must complete within 30 seconds
- **Stateless**: No server memory persists between requests
- **SSE heartbeats**: Must send heartbeats every ~5s to prevent timeout

### Server-Only (.server)
- Secrets, API keys, and network calls MUST live in `.server` modules or API routes
- Never import `~/lib/.server/*` into client-bundled code

### WebContainer
- **Client-side only**: Gate with `!import.meta.env.SSR`
- **~1GB memory limit**: Avoid large dependency installs, don't duplicate file trees
- **Async boot**: Must wait until WebContainer ready before operations

### State Management
- **nanostores**: Reactive UI state
- **zustand**: Complex state patterns
- **IndexedDB**: Client-side persistence (via `app/lib/persistence/`)

---

## Architecture Layers (website-agent)

### Experience Layer (`app/routes/`, `app/components/`)
User-facing UI built with Remix + React + shadcn/ui + UnoCSS.

| Path | Responsibility |
|------|----------------|
| `app/routes/_index.tsx` | Main chat interface |
| `app/routes/chat.$id.tsx` | Individual chat sessions |
| `app/components/chat/` | Chat UI, messages |
| `app/components/workbench/` | IDE-like interface |
| `app/components/ui/` | shadcn/ui primitives |

### Intelligence Layer (`app/lib/.server/llm/`, `app/lib/modules/llm/`)
AI orchestration — **always server-side**.

| Path | Responsibility |
|------|----------------|
| `app/lib/modules/llm/providers/*.ts` | LLM provider implementations |
| `app/lib/modules/llm/manager.ts` | LLMManager singleton |
| `app/lib/.server/llm/stream-text.ts` | SSE streaming |
| `app/routes/api.chat.ts` | Main chat API route |

### Collaboration Layer (`app/lib/stores/`, `app/lib/webcontainer/`)
Client state + in-browser code execution.

| Path | Responsibility |
|------|----------------|
| `app/lib/stores/*.ts` | Nanostores for reactive state |
| `app/lib/persistence/*.ts` | IndexedDB + localStorage |
| `app/lib/webcontainer/` | WebContainer API |
| `app/lib/runtime/` | message-parser, action-runner |

### Integration Layer (`app/routes/api.*.ts`, `app/lib/services/`)
External service connections.

| Path | Responsibility |
|------|----------------|
| `app/routes/api.github-*.ts` | GitHub integration |
| `app/routes/api.supabase*.ts` | Supabase/PostgreSQL |
| `app/lib/services/*.ts` | Service helpers |
| `app/lib/security.ts` | `withSecurity` middleware |

### Delivery Layer (`functions/`, `electron/`)
Runtime environments.

| Path | Responsibility |
|------|----------------|
| `functions/[[path]].ts` | Cloudflare edge function |
| `electron/` | Desktop app |
| `wrangler.toml` | Cloudflare config |

### Allowed Dependency Directions

```
Experience → Collaboration → (indirect) Integration (via API calls)
Experience → Integration (API routes only, via fetch)
Intelligence → (exposed to Experience via API routes only)
Integration → external services
```

**FORBIDDEN**:
- ❌ Collaboration importing `.server` modules
- ❌ Experience importing Intelligence directly
- ❌ Any layer importing `~/lib/.server/*` in client code

---

## Phase Workflow (Beads/Speckit Aligned)

### Phase 0: Preflight (Architecture + Constraints)

After gathering requirements, verify these decisions exist:

- [ ] **Layer placement**: Each component mapped to a layer + target file path
- [ ] **Boundary plan**: Server vs client code separation documented
- [ ] **Cloudflare plan**: Request lifecycle, timeout budget, streaming strategy
- [ ] **WebContainer plan**: Boot gating, memory impact, command sequencing
- [ ] **State plan**: Which stores, persistence mechanism, sync strategy
- [ ] **Security plan**: Input validation, auth/authz, secret handling

### Phase 1: Design Verification (Contracts + Feasibility)

Before implementation, verify:

- [ ] **Imports**: All `~/...` paths, no relative cross-layer imports
- [ ] **`.server` placement**: Secrets/network in correct locations
- [ ] **API contracts**: Zod schemas defined, no `any`
- [ ] **SSE heartbeat**: Implemented if streaming endpoint
- [ ] **Time budget**: Operations fit within 30s
- [ ] **Client gating**: WebContainer code guarded by `!import.meta.env.SSR`

---

## Cloudflare Pages Planning Checklist

- [ ] Total request time budget < 30s with margin
- [ ] SSE endpoints send heartbeats every ~5s
- [ ] No reliance on server memory between requests
- [ ] Fallback UX if upstream LLM stalls
- [ ] Response streaming vs buffering strategy decided
- [ ] Error responses return quickly (don't wait for timeout)

---

## WebContainer Planning Checklist

- [ ] Code guarded with `!import.meta.env.SSR`
- [ ] Boot state checked before operations
- [ ] Memory impact assessed (avoid large installs)
- [ ] Commands serialized (no concurrent heavy operations)
- [ ] Error state handling for boot failures
- [ ] File sync strategy with nanostores defined

---

## Server/Client Boundary Checklist (.server Enforcement)

### Allowed Locations for Server-Only Code
- `app/routes/api.*.ts` (API routes)
- `app/lib/.server/**` (explicitly server-only)

### Forbidden
- ❌ Importing `~/lib/.server/*` in `app/components/`
- ❌ API keys or secrets outside `.server` modules
- ❌ Direct database calls in components

### Plan Requirement
Every module in the plan must specify:
- Target file path
- Layer assignment
- Server or client execution context

---

## Security-by-Design (Project Anchored)

### Input Validation
- [ ] Zod schemas for all API contracts
- [ ] No `any` or `@ts-expect-error`
- [ ] File upload restrictions if applicable

### API Security
- [ ] `withSecurity()` wrapper on all API routes
- [ ] Rate limiting configured
- [ ] CORS policy defined

### Secret Handling
- [ ] Secrets only in `.server` modules or env vars
- [ ] Never logged or exposed to client
- [ ] PII redaction in logs

### Authentication/Authorization
- [ ] Auth mechanism documented
- [ ] Principle of least privilege
- [ ] Token handling secure

---

## Maintainability Guardrails

### SRP Smell Check (Per Layer)
- Experience components: UI only, no business logic
- Intelligence: AI orchestration only, no UI concerns
- Collaboration: State + runtime only, no network calls
- Integration: External service calls only

### DIP Smell Check
- High-level modules (use cases) depend on abstractions (ports)
- Concrete implementations in Integration layer

### Error Handling
- User-facing errors: toast notifications (react-toastify)
- API errors: consistent shape, meaningful messages
- Never silence errors with empty catch blocks

### YAGNI
- [ ] Is this abstraction necessary now?
- [ ] Can it be simpler?

---

## Required Output Artifacts

### 1. senior-architecture-review.md

```markdown
# Architecture Review: [Feature Name]

## Scope & Critical Paths
- User journeys affected: ...
- Latency-sensitive operations: ...
- Data flows: ...

## Layer Placement

| Component | Layer | Target File Path | Context |
|-----------|-------|------------------|---------|
| [name] | Experience/Intelligence/etc | `app/...` | client/server |

## Cloudflare Plan
- Request timeout budget: Xms
- Streaming strategy: [yes/no, heartbeat interval]
- Fallback behavior: ...

## WebContainer Plan
- Impacts WebContainer: [yes/no]
- Boot gating strategy: ...
- Memory considerations: ...

## Boundary Verification
- [ ] All server code in `.server` or API routes
- [ ] No forbidden imports
- [ ] Client code guards for SSR

## Security Threats (Top 5)

| Threat | Vector | Mitigation |
|--------|--------|------------|
| ... | ... | ... |

## Verification Commands
```bash
pnpm run typecheck
pnpm run lint
pnpm test
pnpm run build
```
```

### 2. risk-register.md

```markdown
# Risk Register: [Feature Name]

| Risk | Category | Likelihood | Impact | Mitigation | Detection |
|------|----------|------------|--------|------------|-----------|
| Cloudflare timeout | Performance | Medium | High | Streaming + heartbeats | APM alerts |
| WebContainer OOM | Runtime | Low | High | Memory budgeting | Error monitoring |
| .server leak | Security | Low | Critical | Build-time checks | Build failure |
| SSE stall | UX | Medium | Medium | Heartbeat timeout | User reports |
```

---

## Verification Commands (Must Run / Must Pass)

Before closing any implementation:

```bash
pnpm run typecheck   # TypeScript checking
pnpm run lint        # ESLint + Prettier
pnpm test            # Vitest tests
pnpm run build       # Production build
```

---

## Gate Criteria

### Phase 0 Gate: Pass/Fail

**FAIL** if missing:
- Layer placement for all components
- Cloudflare timeout/streaming plan (if API route)
- WebContainer plan (if runtime changes)
- `.server` boundary compliance plan
- Verification commands listed

**PASS** if:
- All layers + file paths documented
- Constraints acknowledged with specific plans
- Security threats identified

### Phase 1 Gate: Pass/Fail

**FAIL** if:
- Import paths not verified
- `.server` boundary violated
- API contracts missing Zod schemas
- No test plan

**PASS** if:
- All Phase 0 decisions reflected in concrete design
- Boundary checks documented
- Risk mitigations have test coverage

---

## References (Internal)

- **AGENTS.md**: Commands, code style, architecture overview
- **repo-orientation skill**: Layer map and boundaries
- **remix-api-routes skill**: API route patterns with `withSecurity`
- **ai-streaming-and-recovery skill**: SSE streaming patterns
- **state-nanostores-zustand skill**: State management patterns
- **webcontainer-runtime-actions skill**: Action execution pipeline
- **testing-vitest-playwright-msw skill**: Test patterns
