# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a fork of bolt.diy being adapted for HuskIT's website-agent: an AI-powered website generator that helps restaurant operators create branded websites from Google Maps data. The codebase uses Remix with WebContainer technology to enable in-browser code editing and preview.

## Development Commands

### Core Development
```bash
pnpm install              # Install dependencies
pnpm run dev              # Start development server (localhost:5171)
pnpm run build            # Build for production
pnpm run start            # Run production build locally with Wrangler
pnpm run preview          # Build and preview production locally
```

### Testing & Quality
```bash
pnpm test                 # Run Vitest tests
pnpm run test:watch       # Run tests in watch mode
pnpm run typecheck        # TypeScript type checking
pnpm run lint             # Run ESLint
pnpm run lint:fix         # Fix linting and format with Prettier
```

### Electron Desktop App
```bash
pnpm electron:dev         # Run Electron app in development
pnpm electron:build:mac   # Build for macOS
pnpm electron:build:win   # Build for Windows
pnpm electron:build:linux # Build for Linux
pnpm electron:build:dist  # Build for all platforms
```

### Docker
```bash
pnpm run dockerbuild      # Build development Docker image
pnpm run dockerbuild:prod # Build production Docker image
docker compose --profile development up   # Run dev container
docker compose --profile production up    # Run prod container
```

### Deployment
```bash
pnpm run deploy           # Deploy to Cloudflare Pages
pnpm run typegen          # Generate Wrangler types
```

## Architecture

### Technology Stack
- **Runtime**: Node.js >=18.18.0, TypeScript 5.7.2 (strict mode)
- **Framework**: Remix 2.15.2 with Vite 5.4.11
- **UI**: React 18.3.1, UnoCSS, shadcn/ui components, Radix UI primitives
- **State Management**: Nanostores (reactive stores), Zustand (complex state)
- **AI Integration**: Vercel AI SDK (ai 4.3.16) with 19+ LLM provider support
- **Code Execution**: WebContainer API 1.6.1 (in-browser Node.js environment)
- **Database**: Supabase/PostgreSQL for users/tenants/profiles/snapshots
- **Storage**: Cloudflare R2/S3 for workspace archives, WebContainer FS for active edits
- **Deployment**: Cloudflare Pages (edge functions) with 30s timeout constraint
- **Desktop**: Electron 33.2.0 (optional)

### Project Structure

```
app/
├── routes/                    # Remix file-based routing
│   ├── _index.tsx            # Main chat interface
│   ├── chat.$id.tsx          # Individual chat sessions
│   ├── api.*.ts              # API routes for AI streaming, snapshots
│   └── webcontainer.*.tsx    # WebContainer preview/connect
├── components/
│   ├── workbench/            # Main IDE-like interface (PCC - Prompt Command Center)
│   │   ├── Workbench.client.tsx
│   │   ├── Preview.tsx       # Live preview iframe
│   │   └── Terminal/         # Integrated terminal
│   ├── chat/                 # Chat UI components
│   ├── editor/               # CodeMirror-based editor
│   ├── @settings/            # Settings panels (providers, GitHub, GitLab, etc.)
│   └── ui/                   # Reusable shadcn/ui components
├── lib/
│   ├── .server/llm/          # Server-side LLM integration (Remix .server pattern)
│   │   ├── stream-text.ts    # AI streaming with SSE
│   │   └── providers/        # LLM provider implementations
│   ├── runtime/              # Code execution runtime
│   │   ├── action-runner.ts  # Executes AI-generated actions
│   │   └── message-parser.ts # Parses AI responses into actions
│   ├── stores/               # Nanostores for reactive state
│   │   ├── workbench.ts      # Main workbench state
│   │   ├── files.ts          # File system state
│   │   ├── chat.ts           # Chat history
│   │   └── editor.ts         # Editor state
│   ├── webcontainer/         # WebContainer setup and utilities
│   ├── persistence/          # IndexedDB for chat history
│   ├── modules/llm/          # LLM provider registry and management
│   └── hooks/                # React hooks
├── types/                    # TypeScript type definitions
└── utils/                    # Utility functions

templates/                    # Website templates (for HuskIT fork)
├── registry.json             # Template metadata
└── restaurant-*/             # Restaurant-specific templates

specs/001-phase1-plan/        # Current feature specifications
├── spec.md                   # Feature requirements
├── plan.md                   # Implementation plan
├── tasks.md                  # Task breakdown
└── contracts/                # API contracts (OpenAPI)

functions/[[path]].ts         # Cloudflare Pages functions
```

### Key Architectural Patterns

**1. Remix .server Pattern**
Server-side code uses `.server` suffix to ensure it never bundles to client:
- `app/lib/.server/llm/*` - LLM streaming, prompt management
- Server utilities automatically tree-shaken from client bundle

**2. WebContainer Integration**
Browser-based Node.js environment for running code:
- `webcontainer` singleton initialized in `app/lib/webcontainer/index.ts`
- File system operations sync to WebContainer FS
- Terminal commands execute in WebContainer shell
- Preview runs actual dev server (Vite, Next.js, etc.) in browser

**3. AI Action Execution Flow**
```
User Prompt → Remix API Route → LLM Stream (SSE) → Message Parser →
Action Runner → WebContainer → File Changes → Preview Update
```
- Message parser (`message-parser.ts`) extracts structured actions from AI responses
- Action runner (`action-runner.ts`) executes file writes, shell commands, etc.
- All actions tracked in Nanostores for reactive UI updates

**4. State Management Strategy**
- **Nanostores**: Reactive atoms/maps for workbench, files, editor state
- **Zustand**: Complex state with middleware (chat history, settings)
- **IndexedDB**: Persistent storage for chat history via `app/lib/persistence/`
- Hot module reload preserves stores via `import.meta.hot.data`

**5. Multi-Provider LLM Architecture**
- Provider registry: `app/lib/modules/llm/registry.ts`
- Base provider interface: `app/lib/modules/llm/base-provider.ts`
- Individual providers: `app/lib/modules/llm/providers/*.ts`
- Dynamic model selection via UI, stored in cookies
- Supports OpenAI, Anthropic, Google, Groq, Ollama, and 15+ others

**6. Settings Architecture**
- Tab-based UI: `app/components/@settings/tabs/`
- Service integrations (GitHub, GitLab, Netlify, Supabase, Vercel)
- Provider configuration (Cloud vs Local providers)
- MCP server management for AI tool integration

### WebContainer Constraints
- **Memory**: ~1 GB limit for cloned templates
- **File System**: Virtual FS, synced from Nanostores file state
- **Network**: Preview server runs on random port, proxied through iframe
- **Process Limits**: Single Node.js process, limited spawn capability

### Performance Targets (Phase 1 MVP)
- Initial site generation: <3 minutes end-to-end (p95)
- Iterative edits: <20 seconds (p95)
- PCC UI interactions: <150ms
- API acknowledgements: <400ms with SSE heartbeats every 5s

### Testing Strategy
- **Unit**: Vitest for stores, parsers, utilities
- **Integration**: MSW for mocking external APIs (Google Places, LLMs)
- **E2E**: Playwright (`playwright.config.preview.ts`) for PCC workflows
- **Coverage Goals**: ≥90% for critical runtimes, ≥80% for touched files

## HuskIT-Specific Context

This fork is being adapted for restaurant website generation:
- **User Stories** (Phase 1): Generate from Google Maps, iterate via natural language, save/restore snapshots
- **Templates**: Premium restaurant templates in `/templates` directory
- **Agents**: Crawler (Google Maps), Content (AI copywriting), Website (code generation), Edit (modifications), Snapshot (versioning)
- **Orchestration**: SSE-based multi-agent workflow through Remix API routes

## Development Notes

### Path Aliases
- `~/*` maps to `app/*` (configured in tsconfig.json)
- Use path alias for all imports: `import { X } from '~/lib/...`

### Environment Variables
- Copy `.env.example` to `.env.local` for local development
- API keys configurable via UI or environment variables
- `envPrefix` in vite.config.ts exposes select vars to client

### Hot Module Reload (HMR)
- Stores persist across HMR via `import.meta.hot.data`
- Binary file content preserved across reloads
- WebContainer instance reused when possible

### Code Quality Gates
All PRs must pass:
- `pnpm run lint` (ESLint with Prettier)
- `pnpm run typecheck` (TypeScript strict mode)
- `pnpm run test` (Vitest suite)
- Zod schemas for API contracts and agent interfaces

### Security Notes
- COEP/COOP headers required for SharedArrayBuffer (WebContainer)
- Never commit secrets (`.env.local` gitignored)
- Cloudflare Pages environment variables for production
- WebContainer API requires commercial license for production use

### Common Gotchas
- **Chrome 129**: Known Vite dev mode issue, use Canary or build/start
- **Port 5171**: Default dev port, falls back if busy
- **WebContainer Boot**: Async, gates file operations until ready
- **SSR**: WebContainer only loads client-side (`!import.meta.env.SSR`)

## Constitution Principles (from .cursor/rules)

1. **Code Quality**: Typed contracts (Zod), strict TypeScript, feature flag rollback per route
2. **Testing Discipline**: SSE integration tests, schema contracts, Playwright for PCC
3. **UX Consistency**: HuskIT design tokens (`app/styles/tokens.css`), shadcn toasts, ARIA live regions, responsive (320/768/1280px)
4. **Performance Budgets**: Instrumented with `performance.mark`, telemetry for SLA compliance

## Related Documentation

- Main README: `README.md` (setup, deployment, provider configuration)
- Contributing: `CONTRIBUTING.md`
- FAQ: `FAQ.md` (common issues, recommended models)
- Changelog: `changelog.md`
- Phase 1 Spec: `specs/001-phase1-plan/spec.md`
- Agent SDK: `.agents/` directory

## Active Technologies
- TypeScript 5.7.2 (strict mode) + ai (Vercel AI SDK), nanostores, ignore (001-hybrid-context-selection)
- N/A (in-memory only) (001-hybrid-context-selection)
- TypeScript 5.7.2 (strict mode) + JSZip (already installed for GitHub zipball extraction), Remix 2.15.2, Node.js fs/promises (003-zip-template-support)
- Local filesystem (`templates/*.zip`), no database changes (003-zip-template-support)

## Recent Changes
- 001-hybrid-context-selection: Added TypeScript 5.7.2 (strict mode) + ai (Vercel AI SDK), nanostores, ignore
