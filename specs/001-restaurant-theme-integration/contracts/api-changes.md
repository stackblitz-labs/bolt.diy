# API Contract Changes: Restaurant Theme Integration

**Feature**: 001-restaurant-theme-integration  
**Date**: 2025-12-02

## Overview

This feature does not introduce new API endpoints. It extends the existing `/api/chat` request body with an optional field.

---

## Modified Endpoint: POST /api/chat

### Request Body Changes

**Added Field**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `restaurantThemeId` | `string` | No | Restaurant theme identifier for prompt injection |

### Updated Request Schema

```typescript
interface ChatRequestBody {
  messages: Message[];
  files: FileMap;
  promptId?: string;
  contextOptimization: boolean;
  chatMode: 'discuss' | 'build';
  designScheme?: DesignScheme;
  restaurantThemeId?: string;  // NEW
  supabase?: {
    isConnected: boolean;
    hasSelectedProject: boolean;
    credentials?: {
      anonKey?: string;
      supabaseUrl?: string;
    };
  };
  maxLLMSteps: number;
}
```

### Behavior

| Condition | Behavior |
|-----------|----------|
| `restaurantThemeId` not provided | No theme injection; standard generation |
| `restaurantThemeId` provided + `chatMode === 'build'` | Theme prompt injected into system prompt |
| `restaurantThemeId` provided + `chatMode === 'discuss'` | Theme ignored; no injection |
| `restaurantThemeId` invalid (not in registry) | Warning logged; no injection; continues normally |

### Response

No changes to response format.

---

## Internal Function Changes

### streamText() Function Signature

**File**: `app/lib/.server/llm/stream-text.ts`

**Added Parameter**:

```typescript
export async function streamText(props: {
  // ... existing props
  restaurantThemeId?: string;  // NEW
}): Promise<StreamResult>
```

### Propagation Points

The `restaurantThemeId` is propagated through:

1. **Client** (`Chat.client.tsx`): Included in `useChat` body
2. **API Route** (`api.chat.ts`): Destructured from request body
3. **Main streamText call**: Passed to generate initial response
4. **Continuation streamText call**: Passed when max tokens triggers continuation

---

## No New Endpoints

The following were considered but not implemented:

| Potential Endpoint | Reason Not Implemented |
|--------------------|------------------------|
| `GET /api/themes` | Theme list embedded in client bundle via Vite imports |
| `GET /api/themes/:id` | Theme data embedded in client bundle |
| `POST /api/theme-preview` | Out of scope for v1 |

---

## Backward Compatibility

| Scenario | Impact |
|----------|--------|
| Client without `restaurantThemeId` field | Works unchanged; no theme injection |
| Old client version | Works unchanged; field is optional |
| New client, old server | Server ignores unknown field |

The change is fully backward compatible. No migration required.

