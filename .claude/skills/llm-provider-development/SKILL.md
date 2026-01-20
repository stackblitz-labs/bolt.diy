---
name: llm-provider-development
description: Use when adding or modifying an LLM provider in app/lib/modules/llm/providers/. Covers BaseProvider interface, model definitions, Vercel AI SDK integration, registry wiring, API key handling, dynamic model fetching, and streaming. Triggers include "add provider", "new LLM", "add model", "providers/", "LLMManager", "registry.ts", "Vercel AI SDK", "getModelInstance", "staticModels", "getDynamicModels".
---

# LLM Provider Development Skill

## Goal

Add or modify LLM providers following the established patterns for the Vercel AI SDK integration, ensuring proper registration, model definitions, and streaming support.

## Architecture Overview

```
app/lib/modules/llm/
├── providers/           # Individual provider implementations
│   ├── anthropic.ts     # Example: Anthropic (Claude)
│   ├── openai.ts        # Example: OpenAI (GPT)
│   └── <your-provider>.ts
├── base-provider.ts     # Abstract base class all providers extend
├── types.ts             # ModelInfo, ProviderInfo, ProviderConfig
├── registry.ts          # Exports all providers for auto-registration
└── manager.ts           # LLMManager singleton - registers & manages providers
```

## Step-by-Step: Adding a New Provider

### Step 1: Create Provider File

Create `app/lib/modules/llm/providers/<provider-name>.ts`:

```typescript
import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { LanguageModelV1 } from 'ai';
import type { IProviderSetting } from '~/types/model';
import { createMyProvider } from '@ai-sdk/my-provider'; // or custom SDK

export default class MyProvider extends BaseProvider {
  // Required: Provider display name (used as key in registry)
  name = 'MyProvider';
  
  // Optional: Link to get API key
  getApiKeyLink = 'https://my-provider.com/api-keys';
  
  // Required: Configuration for API key and base URL
  config = {
    apiTokenKey: 'MY_PROVIDER_API_KEY',    // Env var name
    baseUrlKey: 'MY_PROVIDER_BASE_URL',     // Optional: for custom endpoints
    baseUrl: 'https://api.my-provider.com', // Optional: default base URL
  };

  // Required: Fallback models (always available, no API call needed)
  staticModels: ModelInfo[] = [
    {
      name: 'my-model-v1',              // API model identifier
      label: 'My Model v1',              // Display name in UI
      provider: 'MyProvider',            // Must match this.name
      maxTokenAllowed: 128000,           // Context window size
      maxCompletionTokens: 4096,         // Max output tokens (optional)
    },
    {
      name: 'my-model-v2',
      label: 'My Model v2 (200k context)',
      provider: 'MyProvider',
      maxTokenAllowed: 200000,
      maxCompletionTokens: 8192,
    },
  ];

  // Required: Create model instance for streaming
  getModelInstance = (options: {
    model: string;
    serverEnv: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModelV1 => {
    const { apiKeys, providerSettings, serverEnv, model } = options;
    
    // Get API key from various sources (cookies, env, settings)
    const { apiKey, baseUrl } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings,
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: 'MY_PROVIDER_BASE_URL',
      defaultApiTokenKey: 'MY_PROVIDER_API_KEY',
    });

    // Create provider instance using Vercel AI SDK
    const provider = createMyProvider({
      apiKey,
      baseURL: baseUrl,
    });

    return provider(model);
  };

  // Optional: Fetch models dynamically from API
  async getDynamicModels(
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    serverEnv?: Record<string, string>,
  ): Promise<ModelInfo[]> {
    const { apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: settings,
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: '',
      defaultApiTokenKey: 'MY_PROVIDER_API_KEY',
    });

    if (!apiKey) {
      throw `Missing API Key for ${this.name}`;
    }

    // Fetch models from provider API
    const response = await fetch('https://api.my-provider.com/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    const data = await response.json();
    
    // Filter out static models to avoid duplicates
    const staticIds = this.staticModels.map(m => m.name);
    
    return data.models
      .filter((m: any) => !staticIds.includes(m.id))
      .map((m: any) => ({
        name: m.id,
        label: m.name || m.id,
        provider: this.name,
        maxTokenAllowed: m.context_length || 32000,
        maxCompletionTokens: m.max_output_tokens,
      }));
  }
}
```

### Step 2: Register in Registry

Add export to `app/lib/modules/llm/registry.ts`:

```typescript
// ... existing imports
import MyProvider from './providers/my-provider';

export {
  // ... existing exports
  MyProvider,
};
```

That's it! The `LLMManager` automatically discovers and registers providers exported from registry.

### Step 3: Add Environment Variable (optional)

Document in `.env.example`:

```bash
# MyProvider API Key
MY_PROVIDER_API_KEY=
MY_PROVIDER_BASE_URL=  # Optional: custom endpoint
```

## Key Interfaces

### ModelInfo (types.ts)

```typescript
interface ModelInfo {
  name: string;              // API model identifier (e.g., "gpt-4o")
  label: string;             // Display name (e.g., "GPT-4o (128k)")
  provider: string;          // Provider name (must match provider.name)
  maxTokenAllowed: number;   // Context window size
  maxCompletionTokens?: number; // Max output tokens
}
```

### ProviderConfig (types.ts)

```typescript
interface ProviderConfig {
  apiTokenKey?: string;  // Env var for API key
  baseUrlKey?: string;   // Env var for base URL
  baseUrl?: string;      // Default base URL
}
```

### BaseProvider Methods

| Method | Required | Description |
|--------|----------|-------------|
| `name` | ✅ | Provider display name (registry key) |
| `config` | ✅ | API key and base URL configuration |
| `staticModels` | ✅ | Fallback models (no API needed) |
| `getModelInstance()` | ✅ | Create LanguageModelV1 for streaming |
| `getDynamicModels()` | ❌ | Fetch models from API (cached) |
| `getApiKeyLink` | ❌ | URL to get API key |
| `labelForGetApiKey` | ❌ | Custom label for API key link |
| `icon` | ❌ | Provider icon path |

## Vercel AI SDK Providers

Use official `@ai-sdk/*` packages when available:

| Provider | Package |
|----------|---------|
| OpenAI | `@ai-sdk/openai` |
| Anthropic | `@ai-sdk/anthropic` |
| Google | `@ai-sdk/google` |
| Mistral | `@ai-sdk/mistral` |
| Cohere | `@ai-sdk/cohere` |
| Amazon Bedrock | `@ai-sdk/amazon-bedrock` |
| Azure OpenAI | `@ai-sdk/azure` |

For OpenAI-compatible APIs, use `@ai-sdk/openai` with custom `baseURL`:

```typescript
import { createOpenAI } from '@ai-sdk/openai';

const provider = createOpenAI({
  baseURL: 'https://custom-api.example.com/v1',
  apiKey,
});
```

## API Key Resolution Order

The `getProviderBaseUrlAndKey()` helper resolves keys in this order:

1. **apiKeys** - From UI cookie storage (user-provided)
2. **serverEnv** - From Remix request context
3. **process.env** - From Node.js environment
4. **manager.env** - From LLMManager instance

## Error Handling

### Never Leak API Keys

```typescript
// ❌ BAD
throw new Error(`Invalid API key: ${apiKey}`);

// ✅ GOOD  
throw `Missing API Key configuration for ${this.name} provider`;
```

### Handle Missing Keys Gracefully

```typescript
async getDynamicModels(...): Promise<ModelInfo[]> {
  const { apiKey } = this.getProviderBaseUrlAndKey({...});
  
  if (!apiKey) {
    // Return empty array instead of throwing
    // Static models will still be available
    return [];
  }
  
  // ... fetch dynamic models
}
```

## Testing Providers

Create test file `test/lib/modules/llm/providers/my-provider.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import MyProvider from '~/lib/modules/llm/providers/my-provider';

describe('MyProvider', () => {
  const provider = new MyProvider();

  it('has correct name', () => {
    expect(provider.name).toBe('MyProvider');
  });

  it('has static models defined', () => {
    expect(provider.staticModels.length).toBeGreaterThan(0);
    expect(provider.staticModels[0]).toHaveProperty('name');
    expect(provider.staticModels[0]).toHaveProperty('maxTokenAllowed');
  });

  it('creates model instance', () => {
    const model = provider.getModelInstance({
      model: 'my-model-v1',
      serverEnv: {} as Env,
      apiKeys: { MyProvider: 'test-key' },
    });
    
    expect(model).toBeDefined();
  });

  it('fetches dynamic models with valid key', async () => {
    // Mock fetch
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      json: async () => ({ models: [{ id: 'new-model', name: 'New Model' }] }),
    } as Response);

    const models = await provider.getDynamicModels(
      { MyProvider: 'test-key' },
      undefined,
      {}
    );

    expect(models).toHaveLength(1);
    expect(models[0].name).toBe('new-model');
  });
});
```

## Checklist

- [ ] Provider file created in `app/lib/modules/llm/providers/`
- [ ] Extends `BaseProvider` class
- [ ] `name` matches provider display name
- [ ] `config.apiTokenKey` set for env var lookup
- [ ] `staticModels` defined with fallback models
- [ ] `getModelInstance()` returns valid `LanguageModelV1`
- [ ] Exported in `registry.ts`
- [ ] Uses `@ai-sdk/*` package or OpenAI-compatible wrapper
- [ ] API key never logged or leaked in errors
- [ ] Optional: `getDynamicModels()` for API-based model list
- [ ] Optional: `getApiKeyLink` for UI help
- [ ] Tests added for provider class
- [ ] Env var documented in `.env.example`

## References

- `app/lib/modules/llm/base-provider.ts` - Base class and helpers
- `app/lib/modules/llm/types.ts` - Type definitions
- `app/lib/modules/llm/registry.ts` - Provider registration
- `app/lib/modules/llm/manager.ts` - LLMManager singleton
- `app/lib/modules/llm/providers/anthropic.ts` - Reference implementation
- `app/lib/modules/llm/providers/openai.ts` - OpenAI example
- `references/provider-template.ts` - Starter template
