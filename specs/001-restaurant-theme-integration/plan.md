# Implementation Plan: Restaurant Theme Integration

**Branch**: `001-restaurant-theme-integration` | **Date**: 2025-12-02 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/001-restaurant-theme-integration/spec.md`

## Summary

Integrate 12 existing restaurant-specific theme prompts into the website generator's LLM flow. The implementation adds a Theme Prompt Layer that enhances template selection for restaurant requests and injects domain-specific design guidelines into the system prompt, enabling contextually appropriate restaurant website generation.

## Technical Context

**Language/Version**: TypeScript 5.7.2 on Node 18+ (Remix + Vite runtime)  
**Primary Dependencies**: Remix 2.15.2, Vite 5.4.11, Vercel AI SDK, React 18  
**Storage**: N/A (theme prompts loaded as raw strings via Vite imports)  
**Testing**: Vitest (unit), manual E2E verification  
**Target Platform**: Web (Cloudflare Pages), Desktop (Electron)  
**Project Type**: Web application (existing Remix monolith)  
**Performance Goals**: Theme selection adds <100ms latency; theme injection adds negligible overhead  
**Constraints**: Must not break existing generic template functionality; theme prompts must be loaded at build time  
**Scale/Scope**: 12 fixed restaurant themes; extends existing 14 generic templates

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| No new dependencies required | ✅ Pass | Uses existing Vite `?raw` import feature |
| Backward compatible | ✅ Pass | All existing templates continue to work; restaurant fields are optional |
| Type safety | ✅ Pass | Full TypeScript coverage with strict types |
| Testable | ✅ Pass | Registry utility functions are unit-testable |

## Project Structure

### Documentation (this feature)

```text
specs/001-restaurant-theme-integration/
├── plan.md              # This file
├── research.md          # Phase 0 output - prerequisites verification
├── data-model.md        # Phase 1 output - entity definitions
├── contracts/           # Phase 1 output - no new APIs, updates to existing
│   └── api-changes.md   # Documents changes to existing API contracts
└── quickstart.md        # Phase 1 output - implementation guide
```

### Source Code (repository root)

```text
app/
├── types/
│   ├── template.ts              # MODIFY: Add category, restaurantThemeId fields
│   └── restaurant-theme.ts      # CREATE: RestaurantThemeId type, RestaurantTheme interface
├── theme-prompts/
│   ├── *.md                     # EXISTING: 12 theme prompt files (no changes)
│   └── registry.ts              # CREATE: Theme registry with imports and utilities
├── utils/
│   ├── constants.ts             # MODIFY: Add 12 restaurant templates to STARTER_TEMPLATES
│   └── selectStarterTemplate.ts # MODIFY: Enhance prompt for restaurant detection
├── components/chat/
│   └── Chat.client.tsx          # MODIFY: Add restaurantThemeId state, pass in useChat body
├── routes/
│   └── api.chat.ts              # MODIFY: Destructure and pass restaurantThemeId to streamText
└── lib/.server/llm/
    └── stream-text.ts           # MODIFY: Inject theme prompt layer into system prompt

tests/
└── unit/
    └── theme-registry.test.ts   # CREATE: Unit tests for registry utility functions
```

**Structure Decision**: This feature extends the existing Remix monolith structure. All changes are additions or modifications to existing files. No new directories needed except for `contracts/` in the spec folder.

## Implementation Phases

### Phase 1: Type Definitions & Registry (~1.5 hours)
1. Extend `Template` interface with `category` and `restaurantThemeId` optional fields
2. Create `RestaurantThemeId` type union and `RestaurantTheme` interface
3. Create theme registry with Vite raw imports and utility functions
4. Add unit tests for registry utilities

### Phase 2: Template Registry Updates (~30 min)
1. Add 12 restaurant templates to `STARTER_TEMPLATES` array (before existing templates)
2. Each template includes: name, label, description, githubRepo, tags, category, restaurantThemeId

### Phase 3: Template Selection Enhancement (~30 min)
1. Update `selectStarterTemplate.ts` prompt to prioritize restaurant templates
2. Add restaurant-specific keywords detection rules
3. Include template category in selection prompt context

### Phase 4: Client State Management (~45 min)
1. Add `restaurantThemeId` state to `ChatImpl` component
2. Include `restaurantThemeId` in `useChat` hook's body option
3. Update `sendMessage` to resolve theme ID from selected template
4. Clear theme ID on template loading failures

### Phase 5: API Layer Integration (~30 min)
1. Update request body destructuring in `api.chat.ts`
2. Pass `restaurantThemeId` to BOTH `streamText()` calls (main + continuation)

### Phase 6: System Prompt Layering (~30 min)
1. Import `getThemePrompt` from registry in `stream-text.ts`
2. Inject theme prompt layer after base prompt when `chatMode === 'build'` and `restaurantThemeId` is set
3. Add logging for theme application and warnings for missing themes

### Phase 7: Testing & Verification (~1 hour)
1. Run unit tests for registry utilities
2. Manual E2E testing with restaurant prompts
3. Regression testing with non-restaurant prompts
4. TypeScript type checking (`pnpm run typecheck`)

## File Change Summary

| File | Action | Est. Lines | Priority |
|------|--------|------------|----------|
| `app/types/template.ts` | Modify | +3 | P1 |
| `app/types/restaurant-theme.ts` | Create | ~25 | P1 |
| `app/theme-prompts/registry.ts` | Create | ~130 | P1 |
| `app/utils/constants.ts` | Modify | +130 | P1 |
| `app/utils/selectStarterTemplate.ts` | Modify | ~50 | P1 |
| `app/components/chat/Chat.client.tsx` | Modify | +15 | P1 |
| `app/routes/api.chat.ts` | Modify | +10 | P1 |
| `app/lib/.server/llm/stream-text.ts` | Modify | +30 | P1 |
| `tests/unit/theme-registry.test.ts` | Create | ~50 | P2 |

## Critical Integration Points

1. **Theme Registry → Constants**: Theme `templateName` must exactly match `STARTER_TEMPLATES[].name`
2. **Constants → Chat.client**: `restaurantThemeId` lookup depends on template name matching
3. **Chat.client → API**: `restaurantThemeId` must be included in `useChat` body
4. **API → stream-text**: Both main and continuation calls must receive `restaurantThemeId`
5. **stream-text → Registry**: Theme injection only occurs when `chatMode === 'build'`

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Theme file name mismatch | Registry imports use exact filenames; TypeScript will error on missing files |
| GitHub rate limiting | Existing error handling in Chat.client.tsx handles this; theme cleared on failure |
| Theme prompt not found | Graceful degradation with `logger.warn()` and skip injection |
| Breaking existing templates | Restaurant fields are optional; existing templates unchanged |

## Estimated Timeline

| Phase | Duration | Cumulative |
|-------|----------|------------|
| Phase 1: Types & Registry | 1.5 hours | 1.5 hours |
| Phase 2: Template Registry | 30 min | 2 hours |
| Phase 3: Selection Enhancement | 30 min | 2.5 hours |
| Phase 4: Client State | 45 min | 3.25 hours |
| Phase 5: API Integration | 30 min | 3.75 hours |
| Phase 6: Prompt Layering | 30 min | 4.25 hours |
| Phase 7: Testing | 1 hour | 5.25 hours |

**Total Estimated: ~5 hours**
