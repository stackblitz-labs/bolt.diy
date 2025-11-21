# AI Agent Guide

## Build & Test
- **Build**: `pnpm run build` (Remix + Vite)
- **Lint**: `pnpm run lint` (ESLint) or `pnpm run lint:fix`
- **Typecheck**: `pnpm run typecheck`
- **Test**: `pnpm run test` (Vitest)
- **Single Test**: `pnpm exec vitest run <path/to/test>`
- **Dev**: `pnpm run dev` (Remix) or `pnpm run electron:dev`

## Architecture
- **Stack**: Remix (Vite), Cloudflare Pages, UnoCSS, TypeScript.
- **Core**: `app/` contains Remix source. `~/*` maps to `app/*`.
- **State**: Uses `nanostores` and `zustand`.
- **Electron**: `electron/` folder for desktop wrapper.
- **AI**: Uses Vercel AI SDK (`ai`) and various provider SDKs.

## Code Style
- **Conventions**: TypeScript strict mode. Functional components.
- **Styling**: Use UnoCSS utility classes.
- **Imports**: Use absolute paths `~/...` for `app/` imports.
- **Formatting**: Prettier is enforced. Run `pnpm run lint:fix`.
- **Naming**: CamelCase for variables/functions, PascalCase for components.
