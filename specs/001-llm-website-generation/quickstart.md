# Quickstart: LLM Website Generation

## Overview

This feature adds automatic website generation during the "Building your website" phase of project creation. When a user confirms their business information, the system:

1. **Phase 1**: Uses a fast LLM to select the best restaurant template
2. **Phase 2**: Uses the user's configured LLM to generate the website code
3. **Auto-saves**: Stores the generated files as a project snapshot

## Prerequisites

- Node.js 18+
- pnpm package manager
- Configured LLM provider (OpenAI, Anthropic, Google, etc.) with valid API key
- Existing project with `business_profile` data (typically from crawler flow)

## Local Development Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Copy environment variables
cp .env.example .env.local

# 3. Configure your LLM provider API key in .env.local
# OPENAI_API_KEY=sk-...
# or
# ANTHROPIC_API_KEY=sk-ant-...

# 4. Start the dev server
pnpm run dev

# 5. Open http://localhost:5173
```

## Testing the Generation Flow

### Option 1: Full UI Flow

1. Click "New Project" in the sidebar
2. Enter business name and address
3. Paste a Google Maps URL for your business
4. Wait for data extraction
5. Review and confirm business information
6. Watch the "Building your website" step:
   - "Analyzing business details" → Template selection
   - "Generating layout & copy" → Content generation
   - "Final polish" → File injection
7. View your generated website in the preview!

### Option 2: API Testing

```bash
# Trigger generation for an existing project
curl -X POST http://localhost:5173/api/project/generate \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=YOUR_SESSION_TOKEN" \
  -d '{"projectId": "PROJECT_UUID"}'
```

Response is an SSE stream:
```
event: progress
data: {"phase":"template_selection","status":"in_progress","message":"Analyzing business details","percentage":10}

event: template_selected
data: {"name":"Bamboo Bistro","themeId":"bamboobistro","reasoning":"Selected for Asian cuisine"}

event: progress
data: {"phase":"content_generation","status":"in_progress","message":"Generating layout & copy","percentage":30}

event: file
data: {"path":"src/App.tsx","content":"...","size":2048}

event: file
data: {"path":"src/data/content.ts","content":"...","size":1024}

event: complete
data: {"success":true,"projectId":"...","template":{...},"timing":{"totalMs":45000}}
```

## Key Files

| File | Purpose |
|------|---------|
| `app/routes/api.project.generate.ts` | API endpoint for generation |
| `app/lib/services/projectGenerationService.ts` | Two-phase generation orchestration |
| `app/lib/services/fastModelResolver.ts` | Fast model selection per provider |
| `app/components/projects/CreateProjectDialog.tsx` | UI with generation progress |
| `app/theme-prompts/registry.ts` | Restaurant theme prompts |

## Configuration

### Fast Models (Phase 1)

The system automatically selects a fast/cheap model for template selection:

| Provider | Fast Model |
|----------|-----------|
| OpenAI | gpt-4o-mini |
| Anthropic | claude-3-haiku-20240307 |
| Google | gemini-1.5-flash |
| Groq | llama-3.1-8b-instant |

### Timeouts

- **Target**: 60 seconds total generation time
- **Soft warning**: "Taking longer than usual" message after 60s
- **No hard timeout**: Generation continues until complete

## Troubleshooting

### "No business profile" error

**Cause**: Project doesn't have `business_profile` data.

**Fix**: Ensure you went through the Google Maps URL flow during project creation.

### Template selection failed

**Cause**: Phase 1 LLM call failed.

**Fix**: System automatically falls back to "Classic Minimalist v2" template. Check API key configuration.

### Generation taking too long

**Cause**: Large/complex model or slow network.

**Fix**: System shows "Taking longer than usual" message. Wait for completion or check network.

### Files not appearing in editor

**Cause**: WebContainer injection failed.

**Fix**: Try refreshing the page. Check browser console for errors.

## Architecture

```
User confirms business → CreateProjectDialog
                              │
                              ▼
                     POST /api/project/generate
                              │
              ┌───────────────┴───────────────┐
              │                               │
              ▼                               ▼
      Phase 1: Template              Phase 2: Content
      (fast model, ~3s)              (user model, ~30-60s)
              │                               │
              └───────────────┬───────────────┘
                              │
                              ▼
                     SSE Stream → Client
                              │
              ┌───────────────┼───────────────┐
              │               │               │
              ▼               ▼               ▼
        Progress UI     WebContainer      Snapshot
        Updates         File Injection    Auto-Save
```

## Testing

```bash
# Run unit tests
pnpm test -- --grep "generation"

# Run specific test file
pnpm test -- specs/001-llm-website-generation/__tests__/projectGeneration.test.ts
```

## Next Steps

After generation completes:
1. Preview updates automatically in the right panel
2. Edit files in the code editor
3. Chat with Bolt to make changes
4. Deploy via Settings → Deploy
