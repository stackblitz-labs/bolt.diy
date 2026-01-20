---
name: repo-orientation
description: Use when navigating or understanding the website-agent (bolt.diy fork) codebase architecture. Covers Remix routes, WebContainer runtime, LLMManager/providers, nanostores, integrations, and Cloudflare Pages delivery. Triggers include "where is X implemented?", "what owns this flow?", "which layer handles this?", "file path for…", "codebase structure", "architecture overview", "how does X work?".
---

# Repo Orientation (website-agent)

## Goal

Quickly locate the correct layer/module for a change and understand client/server boundaries in this bolt.diy fork adapted for HuskIT restaurant website generation.

## Architecture Layers

### Experience Layer (`app/routes/`, `app/components/`)
User-facing UI built with Remix + React + shadcn/ui + UnoCSS.

| Path | Responsibility |
|------|----------------|
| `app/routes/_index.tsx` | Main chat interface entry |
| `app/routes/chat.$id.tsx` | Individual chat sessions |
| `app/components/chat/` | Chat UI, message rendering, attachments |
| `app/components/workbench/` | IDE-like interface (PCC - Prompt Command Center) |
| `app/components/editor/` | CodeMirror-based code editor |
| `app/components/@settings/` | Settings panels (providers, integrations) |
| `app/components/ui/` | Reusable shadcn/ui primitives |
| `app/styles/` | Design tokens, UnoCSS config |

### Intelligence Layer (`app/lib/.server/llm/`, `app/lib/modules/llm/`)
AI orchestration - always server-side.

| Path | Responsibility |
|------|----------------|
| `app/lib/modules/llm/providers/*.ts` | 19+ LLM provider implementations |
| `app/lib/modules/llm/registry.ts` | Provider registration and discovery |
| `app/lib/modules/llm/manager.ts` | LLMManager singleton |
| `app/lib/.server/llm/stream-text.ts` | SSE streaming with Vercel AI SDK |
| `app/lib/.server/llm/select-context.ts` | Context window management |
| `app/lib/services/mcpService.ts` | Model Context Protocol tools |
| `app/routes/api.chat.ts` | Main chat API route |

### Collaboration Layer (`app/lib/stores/`, `app/lib/webcontainer/`)
Client state + in-browser code execution.

| Path | Responsibility |
|------|----------------|
| `app/lib/stores/*.ts` | Nanostores for reactive UI state |
| `app/lib/persistence/*.ts` | IndexedDB + localStorage persistence |
| `app/lib/webcontainer/` | WebContainer API setup and utilities |
| `app/lib/runtime/message-parser.ts` | Parse AI output → structured actions |
| `app/lib/runtime/action-runner.ts` | Execute file writes, shell commands |
| `app/lib/hooks/` | React hooks for store subscriptions |

### Integration Layer (`app/routes/api.*.ts`, `app/lib/services/`)
External service connections.

| Path | Responsibility |
|------|----------------|
| `app/routes/api.github-*.ts` | GitHub API integration |
| `app/routes/api.gitlab-*.ts` | GitLab API integration |
| `app/routes/api.vercel-*.ts` | Vercel deployment |
| `app/routes/api.netlify-*.ts` | Netlify deployment |
| `app/routes/api.supabase*.ts` | Supabase/PostgreSQL operations |
| `app/lib/services/*.ts` | Service helpers (GitHub, GitLab, health monitor) |
| `app/lib/security.ts` | `withSecurity` middleware, rate limiting |

### Delivery Layer (`functions/`, `electron/`)
Runtime environments.

| Path | Responsibility |
|------|----------------|
| `functions/[[path]].ts` | Cloudflare Pages edge function |
| `electron/` | Desktop app (main, preload, renderer) |
| `Dockerfile` | Container builds |
| `wrangler.toml` | Cloudflare configuration |

## Critical Boundaries

### Server-only code (`.server` suffix)
Files with `.server` in the path **never bundle to client**:
```
app/lib/.server/llm/*     # LLM streaming, secrets
app/routes/api.*.ts       # API routes (implicitly server)
```

**Rule**: Network calls, API keys, and database operations MUST stay in `.server` modules or API routes.

### Import conventions
```typescript
// ✅ Always use path alias for app/ imports
import { workbenchStore } from '~/lib/stores/workbench';
import { withSecurity } from '~/lib/security';

// ❌ Never use relative imports across layers
import { something } from '../../../lib/stores/workbench';

// ❌ Never import .server modules in client components
import { streamText } from '~/lib/.server/llm/stream-text'; // BREAKS BUILD
```

### WebContainer constraints
- **Memory**: ~1 GB limit
- **Boot**: Async initialization - gate operations until ready
- **FS**: Virtual filesystem synced from nanostores
- **SSR**: Only loads client-side (`!import.meta.env.SSR`)

### Cloudflare Pages constraints
- **Timeout**: 30 seconds max per request
- **SSE**: Must send heartbeats every ~5s
- **Stateless**: No persistent server state

## Key Flows

### Prompt → Response
```
User Input → /api.chat → LLMManager → Provider → SSE Stream
    → message-parser → action-runner → WebContainer → Preview
```

### State Management
```
User Action → Nanostore update → React re-render
                ↓
         IndexedDB persistence (debounced)
```

### Deployment
```
Git Push → Cloudflare Pages → Edge Function → Remix SSR
```

## Common Questions

| Question | Answer |
|----------|--------|
| "Where do I add a new LLM provider?" | `app/lib/modules/llm/providers/` + register in `registry.ts` |
| "Where is chat streaming handled?" | `app/routes/api.chat.ts` → `app/lib/.server/llm/stream-text.ts` |
| "Where are UI components?" | `app/components/` (shadcn in `ui/`, workbench in `workbench/`) |
| "Where is state managed?" | `app/lib/stores/` (nanostores) + `app/lib/persistence/` |
| "How do I add an API route?" | `app/routes/api.<name>.ts` with `withSecurity()` |
| "Where is WebContainer setup?" | `app/lib/webcontainer/index.ts` |
| "Where are restaurant templates?" | `templates/` directory |
| "Where are feature specs?" | `specs/` directory |

## Guardrails

- Always use `~/...` imports for `app/` paths
- Never import `.server` modules into client components
- Use Zod schemas for API contracts - no `any` or `@ts-expect-error`
- Actions must flow through message-parser → action-runner
- API routes must use `withSecurity()` wrapper
- SSE endpoints need heartbeats (30s Cloudflare timeout)
- Toast notifications via react-toastify for user-facing errors

## Commands Reference

```bash
pnpm run dev          # Start dev server (localhost:5171)
pnpm run build        # Production build
pnpm run typecheck    # TypeScript checking
pnpm run lint:fix     # ESLint + Prettier
pnpm test             # Vitest tests
pnpm run deploy       # Deploy to Cloudflare Pages
```

## References

- See `references/architecture-map.md` for visual layer diagram
- See `CLAUDE.md` for full development guide
- See `docs/system-overview.md` for detailed architecture documentation
