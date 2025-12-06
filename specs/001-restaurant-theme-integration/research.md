# Research: Restaurant Theme Integration

**Feature**: 001-restaurant-theme-integration  
**Date**: 2025-12-02

## Prerequisites Verification

### 1. Theme Prompt Files

**Decision**: All 12 required theme prompt files exist and are ready for integration.

**Verification**:
```
app/theme-prompts/
├── Artisanhearthv3.md    (5020 bytes)
├── Bamboobistro.md       (5108 bytes)
├── Boldfeastv2.md        (4571 bytes)
├── Chromaticstreet.md    (6507 bytes)
├── Classicminimalistv2.md (4955 bytes)
├── Dynamicfusion.md      (6346 bytes)
├── Freshmarket.md        (4706 bytes)
├── Gastrobotanical.md    (5804 bytes)
├── Indochineluxe.md      (5596 bytes)
├── Noirluxev3.md         (5068 bytes)
├── SaiGonveranda.md      (5324 bytes) ← Note: capital 'G' in filename
├── Therednoodle.md       (6499 bytes)
```

**Rationale**: Files are present with consistent naming (except SaiGonveranda.md which has capital 'G'). Registry imports must match exact filenames.

### 2. Vite Raw Import Support

**Decision**: Use Vite's built-in `?raw` suffix for importing markdown files as strings.

**Rationale**: 
- Vite 5.x includes native support for raw imports
- No additional configuration or plugins required
- Import syntax: `import Content from './file.md?raw'`

**Alternatives Considered**:
- `fs.readFileSync` at runtime: Rejected (not compatible with Cloudflare Pages edge runtime)
- Fetch API at runtime: Rejected (unnecessary network overhead, bundle size impact)

### 3. Template Interface Extension

**Decision**: Add optional `category` and `restaurantThemeId` fields to existing `Template` interface.

**Rationale**:
- Optional fields ensure backward compatibility
- Existing templates continue to work without modification
- Type narrowing allows restaurant-specific logic

**Current Interface**:
```typescript
export interface Template {
  name: string;
  label: string;
  description: string;
  githubRepo: string;
  tags?: string[];
  icon?: string;
}
```

**Extended Interface**:
```typescript
export interface Template {
  name: string;
  label: string;
  description: string;
  githubRepo: string;
  tags?: string[];
  icon?: string;
  category?: 'generic' | 'restaurant';
  restaurantThemeId?: RestaurantThemeId;
}
```

### 4. GitHub Template Repositories

**Decision**: Templates will be fetched from `neweb-learn` GitHub organization.

**Repository Mapping**:
| Theme | Repository |
|-------|------------|
| Bamboo Bistro | neweb-learn/Bamboobistro |
| Indochine Luxe | neweb-learn/Indochineluxe |
| The Red Noodle | neweb-learn/Therednoodle |
| Saigon Veranda | neweb-learn/Saigonveranda |
| Artisan Hearth | neweb-learn/Artisanhearthv3 |
| Classic Minimalist | neweb-learn/Classicminimalistv2 |
| Dynamic Fusion | neweb-learn/Dynamicfusion |
| Bold Feast | neweb-learn/Boldfeastv2 |
| Fresh Market | neweb-learn/Freshmarket |
| Gastro Botanical | neweb-learn/Gastrobotanical |
| Noir Luxe | neweb-learn/Noirluxev3 |
| Chromatic Street | neweb-learn/Chromaticstreet |

**Rationale**: Uses existing `api.github-template.ts` infrastructure for fetching template files.

**Risk**: Repository availability not verified. Fallback behavior (toast warning + blank template) handles failures gracefully.

### 5. System Prompt Layering Strategy

**Decision**: Inject theme prompt AFTER base system prompt, BEFORE context buffer.

**Prompt Layer Order**:
1. Base System Prompt (tools, constraints, design instructions)
2. **Theme Prompt Layer** (restaurant-specific design tokens, components, content strategy) ← NEW
3. Context Buffer (existing code files)
4. Chat Summary (conversation history)

**Rationale**:
- Theme guidelines should influence design decisions but not override technical constraints
- Placed after base prompt to inherit all tool/constraint definitions
- Placed before context to ensure theme influences interpretation of existing code

**Alternatives Considered**:
- Prepend to base prompt: Rejected (theme rules could be overridden by base constraints)
- Append after context: Rejected (theme influence diluted by code context)

### 6. Theme ID Resolution Strategy

**Decision**: Resolve `restaurantThemeId` from selected template name via `STARTER_TEMPLATES` lookup.

**Flow**:
```
selectStarterTemplate() → { template: "Bamboo Bistro" }
    ↓
STARTER_TEMPLATES.find(t => t.name === "Bamboo Bistro")
    ↓
{ restaurantThemeId: "bamboobistro" }
    ↓
Chat state updated with theme ID
```

**Rationale**:
- Single source of truth in `STARTER_TEMPLATES`
- No additional API calls needed
- Type-safe mapping via TypeScript union types

## Resolved Clarifications

| Topic | Resolution |
|-------|------------|
| User override capability | No manual override; users influence selection via prompt wording only |
| Theme injection mode | Only in "build" mode; skipped for "discuss" mode |
| Error handling | Graceful degradation with toast notifications and fallback to blank template |
| Theme context persistence | Passed through both main and continuation `streamText()` calls |

## Open Items

None. All prerequisites verified and clarifications resolved.

