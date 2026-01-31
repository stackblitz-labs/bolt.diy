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

### Database & Migrations
```bash
pnpm run migrate:auth     # Run Better Auth database migration
```

### Templates
```bash
pnpm run templates:seed   # Seed template registry
pnpm run templates:clone  # Clone starter templates
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
- **Authentication**: Better Auth 1.4.1 (email/password + OAuth, Drizzle adapter)
- **Database**: Supabase/PostgreSQL with Drizzle ORM 0.44.7
- **Storage**: Cloudflare R2/S3 for workspace archives, WebContainer FS for active edits
- **Deployment**: Cloudflare Pages (edge functions) with 30s timeout constraint
- **Desktop**: Electron 33.2.0 (optional)

### Project Structure

```
app/
├── routes/                    # Remix file-based routing
│   ├── _index.tsx            # Main chat interface
│   ├── chat.$id.tsx          # Individual chat sessions
│   ├── auth.login.tsx        # Email/password + OAuth login
│   ├── auth.signup.tsx       # Email/password + OAuth signup
│   ├── auth.logout.tsx       # Logout route
│   ├── api.auth.$.ts         # Better Auth API catch-all route
│   ├── api.projects.ts       # Project list/create
│   ├── api.projects.$id.ts   # Project CRUD
│   ├── api.projects.$id.messages.ts       # Message management
│   ├── api.projects.$id.messages.recent.ts
│   ├── api.projects.$id.messages.append.ts
│   ├── api.projects.$id.snapshot.ts       # Snapshot management
│   ├── api.crawler.search.ts   # Business search by name+address
│   ├── api.crawler.extract.ts  # Google Maps data extraction (multi-method)
│   ├── api.crawler.generate.ts # Website content generation from crawler
│   ├── api.project.generate.ts # Project generation
│   ├── api.site.generate.ts    # Site generation
│   ├── api.info-collection.ts  # Restaurant info collection
│   ├── api.llmcall.ts          # LLM call endpoint
│   ├── api.enhancer.ts         # Content enhancement
│   ├── api.health.ts           # Health check
│   ├── api.system.*.ts         # System diagnostics/info
│   ├── api.*.ts               # Other API routes (AI streaming, etc.)
│   └── webcontainer.*.tsx     # WebContainer preview/connect
├── components/
│   ├── auth/                  # Authentication UI
│   │   ├── AuthGuard.tsx     # Route protection
│   │   ├── AuthModal.tsx     # Auth modal dialog
│   │   ├── LoginForm.tsx     # Email/password login
│   │   ├── SignupForm.tsx    # Email/password signup
│   │   ├── GoogleSignInButton.tsx # OAuth button
│   │   ├── UserMenu.tsx      # User menu component
│   │   └── AuthStateSync.tsx # Session synchronization
│   ├── workbench/            # Main IDE-like interface (PCC - Prompt Command Center)
│   │   ├── Workbench.client.tsx
│   │   ├── Preview.tsx       # Live preview iframe
│   │   └── Terminal/         # Integrated terminal
│   ├── chat/                 # Chat UI components
│   ├── landing/              # Landing & home pages
│   ├── projects/             # Project management UI
│   ├── editor/               # CodeMirror-based editor
│   ├── @settings/            # Settings panels (providers, GitHub, GitLab, etc.)
│   └── ui/                   # Reusable shadcn/ui components
├── lib/
│   ├── auth/                  # Better Auth integration
│   │   ├── auth.server.ts    # Server-side auth setup (Drizzle adapter)
│   │   ├── auth.client.ts    # Client-side auth client
│   │   ├── schema.ts         # Auth database schema
│   │   ├── session.server.ts # Session management
│   │   └── guards.server.ts  # Auth guards/middleware
│   ├── db/                    # Database/ORM layer
│   │   ├── drizzle.server.ts # Drizzle ORM setup with PostgreSQL
│   │   └── supabase.server.ts # Supabase connection via Drizzle
│   ├── services/              # Server-side business logic
│   │   ├── projects.server.ts          # Project CRUD operations
│   │   ├── projectGenerationService.ts # Website generation pipeline
│   │   ├── websiteGenerationService.ts # HTML/CSS generation
│   │   ├── crawlerService.ts           # Crawler client
│   │   ├── crawlerClient.server.ts     # Server-side crawler
│   │   ├── crawlerAgent.server.ts      # Crawler agent logic
│   │   ├── infoCollectionService.server.ts # Business info collection
│   │   ├── contentTransformer.ts       # Content transformation
│   │   └── sseUtils.ts                 # SSE utilities
│   ├── .server/llm/          # Server-side LLM integration (Remix .server pattern)
│   │   ├── stream-text.ts    # AI streaming with SSE
│   │   └── providers/        # LLM provider implementations
│   ├── runtime/              # Code execution runtime
│   │   ├── action-runner.ts  # Executes AI-generated actions
│   │   └── message-parser.ts # Parses AI responses into actions
│   ├── stores/               # Nanostores for reactive state (24+ stores)
│   │   ├── workbench.ts      # Main workbench state
│   │   ├── files.ts          # File system state
│   │   ├── chat.ts           # Chat history
│   │   ├── editor.ts         # Editor state
│   │   ├── auth.ts           # Auth state
│   │   ├── profile.ts        # User profile
│   │   ├── infoCollection.ts # Info collection state
│   │   └── ...               # + 17 more stores
│   ├── persistence/          # IndexedDB + message sync infrastructure
│   ├── webcontainer/         # WebContainer setup and utilities
│   ├── modules/llm/          # LLM provider registry and management
│   └── hooks/                # React hooks
├── types/                    # TypeScript type definitions
│   ├── project.ts            # Project types
│   ├── crawler.ts            # Crawler types
│   ├── generation.ts         # Generation types
│   ├── info-collection.ts    # Info collection types
│   ├── restaurant-theme.ts   # Restaurant theme types
│   ├── template.ts           # Template types
│   └── message-loading.ts    # Message loading types
└── utils/                    # Utility functions

scripts/                       # Build & migration scripts
├── migrate-auth.ts           # Better Auth migration (with safety checks)
├── apply-migration-manual.ts # Manual migration application
└── templates/                # Template management scripts

supabase/                      # Supabase configuration & migrations
├── migrations/               # SQL migration files
└── .branches/                # Branch-based migration tracking

templates/                    # Website templates (for HuskIT fork)
├── registry.json             # Template metadata
└── restaurant-*/             # Restaurant-specific templates

docs/                          # Extended documentation (21 subdirectories)

specs/                         # Feature specifications (12 specs)
├── 001-phase1-plan/          # Phase 1 plan (spec, plan, tasks, contracts)
├── 002-better-auth/          # Better Auth implementation (full spec)
├── 001-crawler-api-integration/
├── 001-hybrid-context-selection/
├── 001-llm-website-generation/
├── 001-info-collection-agent/
├── 001-load-project-messages/
├── 001-project-chat-sync/
├── 001-restaurant-theme-integration/
├── 001-user-project-tables/
└── ...

functions/[[path]].ts         # Cloudflare Pages functions
```

### Key Architectural Patterns

**1. Remix .server Pattern**
Server-side code uses `.server` suffix to ensure it never bundles to client:
- `app/lib/.server/llm/*` - LLM streaming, prompt management
- `app/lib/auth/*.server.ts` - Auth guards, session management
- `app/lib/db/*.server.ts` - Database connections
- `app/lib/services/*.server.ts` - Server-side services
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
- **Nanostores**: Reactive atoms/maps for workbench, files, editor, auth, profile (24+ stores)
- **Zustand**: Complex state with middleware (chat history, settings)
- **IndexedDB**: Persistent storage for chat history via `app/lib/persistence/`
- **Supabase/PostgreSQL**: Server-side persistence for projects, messages, snapshots
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

**7. Authentication (Better Auth)**
- Server setup: `app/lib/auth/auth.server.ts` (Drizzle adapter, PostgreSQL)
- Client: `app/lib/auth/auth.client.ts` (createAuthClient from better-auth/react)
- Schema: `app/lib/auth/schema.ts` (user, session, account, verification tables)
- Guards: `app/lib/auth/guards.server.ts` (route protection)
- API route: `app/routes/api.auth.$.ts` (catch-all for Better Auth endpoints)
- Supports email/password + Google OAuth
- Auth state managed via `app/lib/stores/auth.ts` (nanostores)

**8. Project-Based Architecture**
- Projects are the core entity: each has messages, snapshots, and generation state
- Project CRUD: `app/lib/services/projects.server.ts`
- REST APIs: `api.projects.*` routes for full project lifecycle
- Chat is project-scoped with message persistence to Supabase
- Message sync infrastructure in `app/lib/persistence/` (merge, validation, sort)

**9. Crawler & Generation Pipeline**
- Crawler client: `app/lib/services/crawlerClient.server.ts` (search, extract, generate endpoints)
- Mock crawler: `app/lib/services/crawlerService.ts` (fallback with cuisine detection)
- Content transformer: `app/lib/services/contentTransformer.ts`
- Generation services: `projectGenerationService.ts`, `websiteGenerationService.ts`
- Info collection: `app/lib/services/infoCollectionService.server.ts`
- API routes: `api.crawler.search`, `api.crawler.extract`, `api.crawler.generate`, `api.project.generate`, `api.site.generate`
- Onboarding: search-first flow (name+address → verify → crawl → auto-build), manual Maps URL as fallback
- Data flow doc: `docs/backend-dataflow-maps.md` (full pipeline documentation)

**10. Database Layer (Drizzle ORM)**
- ORM setup: `app/lib/db/drizzle.server.ts`
- Supabase connection: `app/lib/db/supabase.server.ts`
- Migrations: `supabase/migrations/` (SQL files with timestamps)
- Migration scripts: `scripts/migrate-auth.ts` (automated with safety checks)

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
- **Authentication**: Email/password + Google OAuth via Better Auth
- **Projects**: Project-scoped chat with persistent messages and snapshots in Supabase
- **Crawler API**: External HuskIT Crawler service for Google Maps data extraction

## Development Notes

### Path Aliases
- `~/*` maps to `app/*` (configured in tsconfig.json)
- Use path alias for all imports: `import { X } from '~/lib/...`

### Environment Variables
- Copy `.env.example` to `.env.local` for local development
- API keys configurable via UI or environment variables
- `envPrefix` in vite.config.ts exposes select vars to client
- `CRAWLER_API_URL` - HuskIT Crawler API endpoint (default: http://localhost:4999)
- `INTERNAL_PLACES_SERVICE_URL` - Internal Places Data Service endpoint
- `INTERNAL_PLACES_SERVICE_TOKEN` - Service authentication token
- Better Auth and Supabase connection vars required for auth/database

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
- Better Auth Spec: `specs/002-better-auth/` (data model, plan, tasks, quickstart)
- Agent SDK: `.agents/` directory
- Backend Data Flow: `docs/backend-dataflow-maps.md` (crawler → generation pipeline)
- Extended docs: `docs/` directory (21 subdirectories)

## Active Technologies
- TypeScript 5.7.2 (strict mode) + Vercel AI SDK, nanostores, Drizzle ORM
- Better Auth 1.4.1 for authentication (email/password + OAuth)
- Drizzle ORM 0.44.7 + PostgreSQL (postgres 3.4.7) for database access
- Supabase for hosted PostgreSQL and migrations

## Recent Changes
- **Onboarding search flow (PR #27)**: Search-first onboarding (name+address → verify → crawl → auto-build), new `/api/crawler/search` endpoint, multi-method crawl input, `CreateProjectPage.tsx` wizard with 5 internal states
- **002-better-auth**: Implemented Better Auth with Drizzle adapter, email/password + Google OAuth, session management, auth guards, and password migration
- **Email auth fix (PR #26)**: Enabled email/password authentication, fixed login sessions, added password migration script
- **UI chat screen (PR #25)**: Updated chat components (ChatBox, Messages, AssistantMessage, UserMessage, ProgressCompilation)
- **UI frontend (PR #23)**: Enhanced landing pages, project management UI, sidebar, header
- **001-hybrid-context-selection**: Added context selection with AI SDK and nanostores
- **001-crawler-api-integration**: Crawler service for Google Maps data extraction
- **001-llm-website-generation**: Website generation pipeline from crawler data
- **001-user-project-tables**: Project and message persistence in Supabase
- **001-project-chat-sync**: Message sync infrastructure between client and server
- **001-info-collection-agent**: Restaurant business info collection agent
