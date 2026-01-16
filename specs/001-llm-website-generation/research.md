# Research: LLM Website Generation

**Feature**: 001-llm-website-generation  
**Created**: 2026-01-09

## Research Questions

### RQ1: What is the optimal architecture for two-phase LLM generation?

**Findings**:

The codebase already has a working pattern in `selectStarterTemplate.ts`:

```typescript
// Phase 1: Template selection via /api/llmcall (non-streaming)
const response = await fetch('/api/llmcall', {
  method: 'POST',
  body: JSON.stringify({
    message: contextPrompt,
    model,
    provider,
    system: templateSelectionPrompt,
  }),
});

// Phase 2: Content generation via /api/chat (streaming)
// Uses streamText() with full system prompt
```

**Decision**: Follow existing pattern - use `/api/llmcall` for Phase 1 (simple, non-streaming), create new SSE endpoint for Phase 2 (streaming for progress).

**Rationale**: Keeps Phase 1 simple and fast; Phase 2 needs streaming for file-by-file progress.

---

### RQ2: Which fast models are available per provider?

**Findings**:

Analyzed `PROVIDER_LIST` in `app/utils/constants.ts` and model capabilities:

| Provider | Fast Model | Context Window | Cost/1M tokens |
|----------|-----------|----------------|----------------|
| OpenAI | gpt-4o-mini | 128K | $0.15 input |
| Anthropic | claude-3-haiku-20240307 | 200K | $0.25 input |
| Google | gemini-1.5-flash | 1M | $0.075 input |
| Groq | llama-3.1-8b-instant | 128K | Free tier |
| OpenRouter | openai/gpt-4o-mini | 128K | Pass-through |

**Decision**: Create provider-to-fast-model mapping. Fall back to user's configured model if provider not in mapping.

**Rationale**: Fast models are 10-20x cheaper and respond in 1-3s vs 10-30s for larger models.

---

### RQ3: How does WebContainer file injection work?

**Findings**:

From `app/lib/runtime/action-runner.ts`:

```typescript
// Files are written via ActionRunner
async #runFileAction(action: ActionState) {
  const webcontainer = await this.#webcontainer;
  const relativePath = nodePath.relative(webcontainer.workdir, action.filePath);
  
  // Create directories if needed
  await webcontainer.fs.mkdir(folder, { recursive: true });
  
  // Write file
  await webcontainer.fs.writeFile(relativePath, action.content);
}
```

From `app/lib/stores/workbench.ts`:

```typescript
// Bundled actions (like template injection) go through:
async _runBundledAction(data: ActionCallbackData) {
  if (data.action.type === 'file') {
    await artifact.runner.runAction(data, false);
    this.#editorStore.updateFile(fullPath, data.action.content);
  }
}
```

**Decision**: Use existing `workbenchStore` pattern to inject files. Stream files via SSE, client processes each file event.

**Rationale**: Reuses battle-tested code path; ensures files appear in both WebContainer and editor.

---

### RQ4: How to handle long-running generation without timeout?

**Findings**:

Cloudflare Pages has 30s edge timeout but:
1. SSE connections can stay open longer with heartbeats
2. Existing `/api/chat` handles long streams with `StreamRecoveryManager`

From `api.chat.ts`:
```typescript
const streamRecovery = new StreamRecoveryManager({
  timeout: 45000,
  maxRetries: 2,
});

// Heartbeat in SSE
const heartbeat = setInterval(() => {
  send({ event: 'heartbeat', data: { timestamp: Date.now() } });
}, 5000);
```

**Decision**: Use SSE with 5s heartbeat. Show "taking longer than usual" after 60s but don't abort.

**Rationale**: Matches existing patterns; keeps connection alive; user can still wait.

---

### RQ5: What business profile data is available from crawler?

**Findings**:

From `app/types/project.ts`:
```typescript
interface BusinessProfile {
  session_id?: string;
  gmaps_url?: string;
  crawled_data?: BusinessData;  // From crawler
  generated_content?: GeneratedContent;  // AI-enhanced
  crawled_at?: string;
}
```

`BusinessData` includes:
- name, address, phone, website
- rating, reviews_count
- hours (Record<string, string>)
- reviews (array)
- menu (categories with items)
- photos (array)

`GeneratedContent` (from `/api/crawler/generate`) includes:
- brandStrategy (usp, targetAudience, toneOfVoice)
- visualAssets (colorPalette, typography)
- businessIdentity (tagline, description)
- contentSections (hero, about, products)

**Decision**: Prefer `generated_content` when available (richer); fall back to `crawled_data` for basic info.

**Rationale**: Generated content has AI-enhanced brand strategy which produces better websites.

---

### RQ6: How to save snapshot after generation?

**Findings**:

From `projects.server.ts`:
```typescript
export async function saveSnapshot(
  projectId: string,
  input: SaveSnapshotRequest,
  userId?: string,
): Promise<SaveSnapshotResponse> {
  // Validates size (50MB limit)
  // Upserts to project_snapshots table
  // Returns { updated_at }
}
```

Snapshot format:
```typescript
interface FileMap {
  [path: string]: {
    type: 'file' | 'folder';
    content?: string;  // Only for files
  };
}
```

**Decision**: After all files are generated, collect into FileMap and call `saveSnapshot()`.

**Rationale**: Simple, uses existing infrastructure, one DB call.

---

## Existing Code to Reuse

| Component | Location | Purpose |
|-----------|----------|---------|
| `selectTemplateFromCrawlerData()` | `selectStarterTemplate.ts` | LLM template selection |
| `getThemePrompt()` | `theme-prompts/registry.ts` | Get theme design guidelines |
| `transformToTemplateContent()` | `contentTransformer.ts` | Map crawler data to template format |
| `saveSnapshot()` | `projects.server.ts` | Persist generated files |
| `getSystemPrompt()` | `prompts.ts` | Base Bolt system prompt |
| `streamText()` | `stream-text.ts` | LLM streaming with Vercel AI SDK |

## Gaps Identified

1. **No direct generation endpoint**: Must create `/api/project/generate`
2. **No progress tracking**: Need SSE events for UI feedback
3. **No fast model resolver**: Need provider-to-fast-model mapping
4. **No CreateProjectDialog integration**: Building step doesn't trigger generation

## Implementation Priority

1. **P1**: Fast model resolver, generation service, API endpoint
2. **P1**: CreateProjectDialog SSE integration
3. **P2**: Auto-save snapshot, WebContainer injection
4. **P3**: Error recovery, "taking longer" message, retry logic
