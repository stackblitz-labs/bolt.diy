# Architecture Map

## Layer Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        EXPERIENCE LAYER                              │
│  app/routes/          app/components/         app/styles/           │
│  ├── _index.tsx       ├── chat/               └── tokens.css        │
│  ├── chat.$id.tsx     ├── workbench/                                │
│  └── api.*.ts         ├── editor/                                   │
│                       ├── @settings/                                │
│                       └── ui/                                       │
├─────────────────────────────────────────────────────────────────────┤
│                       INTELLIGENCE LAYER                             │
│  app/lib/.server/llm/              app/lib/modules/llm/             │
│  ├── stream-text.ts                ├── providers/                   │
│  ├── select-context.ts             │   ├── openai.ts                │
│  └── api-key.ts                    │   ├── anthropic.ts             │
│                                    │   └── ... (19+ providers)      │
│  app/lib/services/                 ├── registry.ts                  │
│  └── mcpService.ts                 └── manager.ts                   │
├─────────────────────────────────────────────────────────────────────┤
│                      COLLABORATION LAYER                             │
│  app/lib/stores/           app/lib/runtime/      app/lib/webcontainer/│
│  ├── workbench.ts          ├── message-parser.ts └── index.ts       │
│  ├── files.ts              └── action-runner.ts                     │
│  ├── chat.ts                                                        │
│  └── editor.ts             app/lib/persistence/                     │
│                            ├── db.ts (IndexedDB)                    │
│  app/lib/hooks/            └── useChatHistory.ts                    │
│  └── use*.ts                                                        │
├─────────────────────────────────────────────────────────────────────┤
│                       INTEGRATION LAYER                              │
│  app/routes/api.github-*.ts    app/lib/services/                    │
│  app/routes/api.gitlab-*.ts    ├── githubApiService.ts              │
│  app/routes/api.vercel-*.ts    ├── gitlabApiService.ts              │
│  app/routes/api.netlify-*.ts   └── importExportService.ts           │
│  app/routes/api.supabase*.ts                                        │
│                                app/lib/security.ts                  │
│                                └── withSecurity, rate limits        │
├─────────────────────────────────────────────────────────────────────┤
│                        DELIVERY LAYER                                │
│  functions/[[path]].ts     electron/           Dockerfile           │
│  (Cloudflare Pages)        ├── main/           docker-compose.yaml  │
│                            ├── preload/                             │
│  wrangler.toml             └── renderer/                            │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Flow: Prompt to Preview

```
┌──────────┐    ┌─────────────┐    ┌───────────────┐    ┌──────────────┐
│   User   │───▶│  Chat UI    │───▶│  /api.chat    │───▶│  LLMManager  │
│  Prompt  │    │ (workbench) │    │ (withSecurity)│    │  + Provider  │
└──────────┘    └─────────────┘    └───────────────┘    └──────────────┘
                                           │                    │
                                           │◀───────────────────┘
                                           │    SSE Stream
                                           ▼
                                   ┌───────────────┐
                                   │ message-parser│
                                   │ (extract      │
                                   │  actions)     │
                                   └───────────────┘
                                           │
                                           ▼
                                   ┌───────────────┐
                                   │ action-runner │
                                   │ (execute      │
                                   │  file/shell)  │
                                   └───────────────┘
                                           │
                                           ▼
                                   ┌───────────────┐    ┌──────────────┐
                                   │ WebContainer  │───▶│   Preview    │
                                   │ (virtual FS)  │    │   iframe     │
                                   └───────────────┘    └──────────────┘
```

## State Management Flow

```
┌──────────────┐     ┌───────────────┐     ┌─────────────────┐
│  User Action │────▶│   Nanostore   │────▶│  React Render   │
│  (click/type)│     │   (atom/map)  │     │  (subscription) │
└──────────────┘     └───────────────┘     └─────────────────┘
                            │
                            │ debounced
                            ▼
                     ┌───────────────┐
                     │   IndexedDB   │
                     │  (boltHistory)│
                     └───────────────┘
```

## Key File Paths Quick Reference

| What | Where |
|------|-------|
| Main entry | `app/routes/_index.tsx` |
| Chat route | `app/routes/chat.$id.tsx` |
| Chat API | `app/routes/api.chat.ts` |
| LLM providers | `app/lib/modules/llm/providers/*.ts` |
| Streaming | `app/lib/.server/llm/stream-text.ts` |
| Action parser | `app/lib/runtime/message-parser.ts` |
| Action executor | `app/lib/runtime/action-runner.ts` |
| WebContainer | `app/lib/webcontainer/index.ts` |
| State stores | `app/lib/stores/*.ts` |
| Persistence | `app/lib/persistence/*.ts` |
| Security | `app/lib/security.ts` |
| UI components | `app/components/ui/*.tsx` |
| Workbench | `app/components/workbench/*.tsx` |
| Settings | `app/components/@settings/*.tsx` |
| Templates | `templates/` |
| Specs | `specs/` |
| Edge function | `functions/[[path]].ts` |
