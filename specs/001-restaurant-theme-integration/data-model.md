# Data Model: Restaurant Theme Integration

**Feature**: 001-restaurant-theme-integration  
**Date**: 2025-12-02

## Entity Definitions

### RestaurantThemeId (Type Union)

A string literal union representing valid restaurant theme identifiers.

```typescript
type RestaurantThemeId =
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
```

**Constraints**:
- Lowercase, no spaces
- Must correspond to a theme prompt file (case-insensitive match to filename)
- Immutable set of 12 values

---

### RestaurantTheme (Interface)

Represents a complete restaurant theme with metadata and prompt content.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `RestaurantThemeId` | Yes | Unique theme identifier |
| `label` | `string` | Yes | Human-readable display name |
| `description` | `string` | Yes | Brief theme description |
| `cuisines` | `string[]` | Yes | Cuisine types this theme suits (e.g., 'asian', 'vietnamese') |
| `styleTags` | `string[]` | Yes | Style descriptors (e.g., 'casual', 'fine-dining') |
| `templateName` | `string` | Yes | Must match `STARTER_TEMPLATES[].name` exactly |
| `prompt` | `string` | Yes | Raw markdown content from theme file |

**Validation Rules**:
- `templateName` must have corresponding entry in `STARTER_TEMPLATES`
- `cuisines` and `styleTags` arrays must not be empty
- `prompt` loaded at build time via Vite raw import

---

### Template (Interface Extension)

Extended template interface with optional restaurant fields.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Template identifier (existing) |
| `label` | `string` | Yes | Display name (existing) |
| `description` | `string` | Yes | Template description (existing) |
| `githubRepo` | `string` | Yes | GitHub repository path (existing) |
| `tags` | `string[]` | No | Searchable tags (existing) |
| `icon` | `string` | No | Icon class name (existing) |
| `category` | `'generic' \| 'restaurant'` | No | **NEW**: Template category |
| `restaurantThemeId` | `RestaurantThemeId` | No | **NEW**: Associated theme ID |

**Validation Rules**:
- If `category === 'restaurant'`, then `restaurantThemeId` should be set
- If `restaurantThemeId` is set, it must be a valid `RestaurantThemeId`
- Existing templates without these fields remain valid

---

## Relationships

```
┌─────────────────┐          ┌──────────────────┐
│    Template     │          │ RestaurantTheme  │
├─────────────────┤          ├──────────────────┤
│ name            │◄────────►│ templateName     │
│ restaurantThemeId ────────►│ id               │
│ category        │          │ cuisines[]       │
│ tags[]          │          │ styleTags[]      │
│ ...             │          │ prompt           │
└─────────────────┘          └──────────────────┘
        │                            │
        │                            │
        ▼                            ▼
┌─────────────────┐          ┌──────────────────┐
│ Template        │          │ Theme Prompt     │
│ Selection       │          │ (.md files)      │
│ (LLM-based)     │          │ app/theme-prompts│
└─────────────────┘          └──────────────────┘
```

**Relationship Notes**:
- `Template.restaurantThemeId` → `RestaurantTheme.id`: One-to-one (optional)
- `Template.name` ↔ `RestaurantTheme.templateName`: Bidirectional lookup key
- `RestaurantTheme.prompt` ← Theme prompt `.md` file: Loaded at build time

---

## State Management

### Client State (React)

```typescript
// In Chat.client.tsx
const [restaurantThemeId, setRestaurantThemeId] = useState<RestaurantThemeId | null>(null);
```

**Lifecycle**:
1. Initial: `null`
2. After template selection: Set to theme ID if restaurant template selected
3. On template load failure: Reset to `null`
4. On new conversation: Persists until explicitly changed

### Request Body (API)

```typescript
// In api.chat.ts request body
{
  // ... existing fields
  restaurantThemeId?: string;  // Passed from client state
}
```

**Validation**:
- Server treats as optional string
- Type cast to `RestaurantThemeId` only when accessing registry

---

## Registry Data Structure

```typescript
// app/theme-prompts/registry.ts
export const RESTAURANT_THEMES: RestaurantTheme[] = [
  {
    id: 'bamboobistro',
    label: 'The Bamboo Bistro (Asian Casual)',
    description: 'Modern Asian casual dining - night market vibes with zen aesthetics',
    cuisines: ['asian', 'chinese', 'ramen', 'thai', 'japanese', 'izakaya', 'dim-sum'],
    styleTags: ['casual', 'energetic', 'night-market', 'modern'],
    templateName: 'Bamboo Bistro',
    prompt: BambooBistroPrompt,  // Imported via ?raw
  },
  // ... 11 more themes
];
```

**Utility Functions**:
- `getThemeById(id: RestaurantThemeId): RestaurantTheme | undefined`
- `getThemeByTemplateName(name: string): RestaurantTheme | undefined`
- `getThemePrompt(id: RestaurantThemeId): string | null`
- `getThemeList(): Array<{ id, label, cuisines }>`

