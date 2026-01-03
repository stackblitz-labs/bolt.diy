# AI Agent Guide

## Commands
- **Build**: `pnpm run build` | **Dev**: `pnpm run dev` | **Typecheck**: `pnpm run typecheck`
- **Lint**: `pnpm run lint` or `pnpm run lint:fix` (ESLint + Prettier)
- **Test**: `pnpm run test` | **Single test**: `pnpm exec vitest run <path/to/test.test.ts>`
- **Electron**: `pnpm electron:dev` | **Deploy**: `pnpm run deploy` (Cloudflare Pages)

## Architecture
- **Stack**: Remix 2.15 + Vite, TypeScript strict, Cloudflare Pages (30s edge timeout)
- **Paths**: `app/` = Remix source, `~/*` alias → `app/*`. Server-only: `.server` suffix
- **State**: `nanostores` (reactive), `zustand` (complex), IndexedDB (persistence)
- **AI**: Vercel AI SDK (`ai`), 19+ LLM providers in `app/lib/modules/llm/providers/`
- **Runtime**: WebContainer API for in-browser Node.js; `app/lib/runtime/action-runner.ts`
- **Database**: Supabase/PostgreSQL (users/tenants), R2/S3 (workspace archives)

## Code Style
- **Imports**: Always use `~/...` absolute paths for `app/` imports
- **Types**: Strict TypeScript, Zod schemas for API contracts, no `any` or `@ts-expect-error`
- **UI**: UnoCSS utilities, shadcn/ui components, Radix primitives, design tokens in `app/styles/`
- **Naming**: camelCase (vars/functions), PascalCase (components), kebab-case (files)
- **Errors**: Never silence errors. Use toast notifications via react-toastify
- **Secrets**: Never commit to repo. Use `.env.local` (gitignored) or Cloudflare env vars
