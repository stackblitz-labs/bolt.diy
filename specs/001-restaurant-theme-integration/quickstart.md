# Quickstart: Restaurant Theme Integration

**Feature**: 001-restaurant-theme-integration  
**Date**: 2025-12-02

## Prerequisites

Before starting implementation, verify:

- [x] All 12 theme prompt files exist in `app/theme-prompts/`
- [x] TypeScript 5.7+ is available (`pnpm run typecheck` works)
- [x] Dev server runs successfully (`pnpm run dev`)

## Implementation Order

Follow this exact order to minimize integration issues:

### Step 1: Type Definitions (10 min)

**File**: `app/types/restaurant-theme.ts` (create new)

```typescript
export type RestaurantThemeId =
  | 'artisanhearthv3'
  | 'bamboobistro'
  | 'boldfeastv2'
  | 'chromaticstreet'
  | 'classicminimalistv2'
  | 'dynamicfusion'
  | 'freshmarket'
  | 'gastrobotanical'
  | 'indochineluxe'
  | 'noirluxev3'
  | 'saigonveranda'
  | 'therednoodle';

export interface RestaurantTheme {
  id: RestaurantThemeId;
  label: string;
  description: string;
  cuisines: string[];
  styleTags: string[];
  templateName: string;
  prompt: string;
}
```

**File**: `app/types/template.ts` (modify)

Add two optional fields:
```typescript
category?: 'generic' | 'restaurant';
restaurantThemeId?: RestaurantThemeId;
```

### Step 2: Theme Registry (30 min)

**File**: `app/theme-prompts/registry.ts` (create new)

See `docs/architecture/templates-and-prompts.md` Phase 1.3 for complete registry code.

Key points:
- Import all 12 `.md` files using `?raw` suffix
- Export `RESTAURANT_THEMES` array
- Export utility functions: `getThemeById`, `getThemeByTemplateName`, `getThemePrompt`, `getThemeList`

### Step 3: Update STARTER_TEMPLATES (20 min)

**File**: `app/utils/constants.ts` (modify)

Add 12 restaurant templates **BEFORE** existing templates. See `docs/architecture/templates-and-prompts.md` Phase 2.1 for complete template definitions.

### Step 4: Enhance Template Selection (15 min)

**File**: `app/utils/selectStarterTemplate.ts` (modify)

Update the prompt to include restaurant detection rules. See `docs/architecture/templates-and-prompts.md` Phase 3.1.

### Step 5: Client State Management (20 min)

**File**: `app/components/chat/Chat.client.tsx` (modify)

1. Add import: `import type { RestaurantThemeId } from '~/types/restaurant-theme';`
2. Add state: `const [restaurantThemeId, setRestaurantThemeId] = useState<RestaurantThemeId | null>(null);`
3. Add to `useChat` body: `restaurantThemeId,`
4. In `sendMessage`, after template selection succeeds:
   ```typescript
   const selectedTemplateMeta = STARTER_TEMPLATES.find((t) => t.name === template);
   const themeId = (selectedTemplateMeta?.restaurantThemeId as RestaurantThemeId) ?? null;
   setRestaurantThemeId(themeId);
   ```

### Step 6: API Integration (10 min)

**File**: `app/routes/api.chat.ts` (modify)

1. Add `restaurantThemeId` to request body destructuring
2. Pass `restaurantThemeId` to **BOTH** `streamText()` calls

### Step 7: System Prompt Injection (15 min)

**File**: `app/lib/.server/llm/stream-text.ts` (modify)

1. Add import: `import { getThemePrompt } from '~/theme-prompts/registry';`
2. Add `restaurantThemeId` to function props
3. After base `systemPrompt` is built, inject theme layer:

```typescript
if (chatMode === 'build' && restaurantThemeId) {
  const themePrompt = getThemePrompt(restaurantThemeId as RestaurantThemeId);
  if (themePrompt) {
    systemPrompt = `${systemPrompt}\n\n---\n## RESTAURANT THEME GUIDELINES\n\n${themePrompt}\n---`;
  }
}
```

## Verification Checklist

After implementation, verify:

- [ ] `pnpm run typecheck` passes
- [ ] `pnpm run lint` passes
- [ ] Dev server starts without errors
- [ ] Entering "create a chinese restaurant website" selects Bamboo Bistro template
- [ ] Entering "build a todo app" selects a generic template (no theme)
- [ ] Theme prompt appears in LLM system prompt (add temporary `console.log`)
- [ ] Existing chat functionality works unchanged

## Common Issues

| Issue | Solution |
|-------|----------|
| Import error for `.md?raw` | Ensure Vite 5.x is installed; check `vite-env.d.ts` has `/// <reference types="vite/client" />` |
| Template name mismatch | Verify `STARTER_TEMPLATES[].name` exactly matches `RestaurantTheme.templateName` |
| Theme not injecting | Check `chatMode === 'build'` and `restaurantThemeId` is not null |
| TypeScript errors | Run `pnpm run typecheck` and fix any type mismatches |

## Reference

Full implementation details: `docs/architecture/templates-and-prompts.md`

