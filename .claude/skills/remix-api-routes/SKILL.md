---
name: remix-api-routes
description: Use when creating or modifying Remix API routes in app/routes/api.*.ts. Covers withSecurity wrapper, rate limiting, Zod validation, SSE streaming patterns, error normalization, and Cloudflare edge constraints. Triggers include "add endpoint", "create API route", "api.*.ts", "withSecurity", "SSE streaming", "rate limit", "Zod schema", "Remix action/loader", "edge timeout", "POST handler".
---

# Remix API Routes Skill

## Goal

Create secure, well-structured API routes following the codebase patterns for security, validation, streaming, and error handling.

## File Naming Convention

Routes live in `app/routes/` with dot-separated naming:

```
api.<service>.ts           → /api/<service>
api.<service>-<action>.ts  → /api/<service>-<action>
api.<service>.$id.ts       → /api/<service>/:id (dynamic param)
api.<service>.$.ts         → /api/<service>/* (catch-all)
```

**Examples from codebase:**
- `api.chat.ts` → `/api/chat`
- `api.github-branches.ts` → `/api/github-branches`
- `api.projects.$id.ts` → `/api/projects/:id`
- `api.git-proxy.$.ts` → `/api/git-proxy/*`

## Required Pattern: withSecurity Wrapper

**Always wrap handlers with `withSecurity()`** from `~/lib/security`:

```typescript
import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { withSecurity } from '~/lib/security';

export const action = withSecurity(
  async ({ request, params }: ActionFunctionArgs) => {
    // Handler implementation
  },
  {
    allowedMethods: ['POST'],  // Restrict HTTP methods
    rateLimit: true,           // Enable rate limiting (default: true)
  }
);
```

### withSecurity Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `allowedMethods` | `string[]` | all | Restrict to specific HTTP methods |
| `rateLimit` | `boolean` | `true` | Apply rate limiting |
| `requireAuth` | `boolean` | `false` | Require authentication |

### Rate Limit Tiers (from security.ts)

| Pattern | Limit | Window |
|---------|-------|--------|
| `/api/*` | 100 req | 15 min |
| `/api/llmcall` | 10 req | 1 min |
| `/api/github-*` | 30 req | 1 min |
| `/api/netlify-*` | 20 req | 1 min |

## Request Validation with Zod

**Always validate request bodies with Zod schemas:**

```typescript
import { z } from 'zod';

const RequestSchema = z.object({
  projectId: z.string().uuid(),
  content: z.string().min(1).max(10000),
  options: z.object({
    streaming: z.boolean().optional(),
  }).optional(),
});

type RequestBody = z.infer<typeof RequestSchema>;

export const action = withSecurity(
  async ({ request }: ActionFunctionArgs) => {
    const body = await request.json();
    
    // Validate with Zod
    const result = RequestSchema.safeParse(body);
    if (!result.success) {
      return json(
        { error: true, message: 'Invalid request', details: result.error.flatten() },
        { status: 400 }
      );
    }
    
    const data: RequestBody = result.data;
    // ... use validated data
  },
  { allowedMethods: ['POST'] }
);
```

## Response Patterns

### JSON Response (standard)

```typescript
import { json } from '@remix-run/cloudflare';

// Success
return json({ success: true, data: result });

// Error
return json(
  { error: true, message: 'Something went wrong' },
  { status: 400 }
);
```

### SSE Streaming Response

For long-running operations (LLM calls, generation):

```typescript
export const action = withSecurity(
  async ({ request }: ActionFunctionArgs) => {
    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      async start(controller) {
        // Send heartbeat every 5s to prevent Cloudflare timeout
        const heartbeat = setInterval(() => {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        }, 5000);
        
        try {
          // Your streaming logic
          for await (const chunk of generateContent()) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
          }
          
          // Send completion
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        } catch (error) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: true })}\n\n`));
        } finally {
          clearInterval(heartbeat);
          controller.close();
        }
      },
    });
    
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  },
  { allowedMethods: ['POST'] }
);
```

## Cloudflare Edge Constraints

### 30-Second Timeout
- Cloudflare Pages functions timeout after **30 seconds**
- For long operations: use SSE streaming with heartbeats
- Heartbeat every **5 seconds** keeps connection alive

### Abort Signal Handling

```typescript
export const action = withSecurity(
  async ({ request }: ActionFunctionArgs) => {
    const abortSignal = request.signal;
    
    // Check if request was aborted
    if (abortSignal.aborted) {
      return json({ error: true, message: 'Request aborted' }, { status: 499 });
    }
    
    // Pass signal to async operations
    const result = await fetchExternalAPI(data, { signal: abortSignal });
    
    return json({ success: true, data: result });
  }
);
```

## Error Handling

### Use sanitizeErrorMessage for production

```typescript
import { sanitizeErrorMessage } from '~/lib/security';

try {
  // ... operation
} catch (error) {
  const message = sanitizeErrorMessage(error, process.env.NODE_ENV === 'development');
  return json({ error: true, message }, { status: 500 });
}
```

### Never leak sensitive information

```typescript
// ❌ BAD - leaks API key in error
return json({ error: true, message: `API key invalid: ${apiKey}` });

// ✅ GOOD - generic error
return json({ error: true, message: 'Authentication failed' });
```

## Complete Route Template

```typescript
import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { z } from 'zod';
import { withSecurity, sanitizeErrorMessage } from '~/lib/security';

// Request validation schema
const CreateItemSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
});

// GET handler (loader)
export const loader = withSecurity(
  async ({ request, params }: LoaderFunctionArgs) => {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    
    try {
      const items = await getItems({ page });
      return json({ success: true, data: items });
    } catch (error) {
      const message = sanitizeErrorMessage(error, process.env.NODE_ENV === 'development');
      return json({ error: true, message }, { status: 500 });
    }
  },
  { allowedMethods: ['GET'] }
);

// POST handler (action)
export const action = withSecurity(
  async ({ request }: ActionFunctionArgs) => {
    // Validate request body
    const body = await request.json();
    const result = CreateItemSchema.safeParse(body);
    
    if (!result.success) {
      return json(
        { error: true, message: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      );
    }
    
    try {
      const item = await createItem(result.data);
      return json({ success: true, data: item }, { status: 201 });
    } catch (error) {
      const message = sanitizeErrorMessage(error, process.env.NODE_ENV === 'development');
      return json({ error: true, message }, { status: 500 });
    }
  },
  { allowedMethods: ['POST'] }
);
```

## Checklist

- [ ] File named `api.<service>.ts` in `app/routes/`
- [ ] Handler wrapped with `withSecurity()`
- [ ] `allowedMethods` specified for action/loader
- [ ] Request body validated with Zod schema
- [ ] Errors sanitized with `sanitizeErrorMessage()`
- [ ] No secrets/API keys leaked in responses
- [ ] SSE endpoints have heartbeat (if streaming)
- [ ] Abort signal handled for long operations
- [ ] Tests added (Vitest for logic, MSW for external calls)

## Testing API Routes

```typescript
// test/routes/api.my-route.test.ts
import { describe, it, expect, vi } from 'vitest';
import { action, loader } from '~/routes/api.my-route';

describe('api.my-route', () => {
  it('validates request body', async () => {
    const request = new Request('http://localhost/api/my-route', {
      method: 'POST',
      body: JSON.stringify({ invalid: 'data' }),
    });
    
    const response = await action({ request, params: {}, context: {} });
    expect(response.status).toBe(400);
  });
  
  it('returns data on success', async () => {
    const request = new Request('http://localhost/api/my-route', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test' }),
    });
    
    const response = await action({ request, params: {}, context: {} });
    const data = await response.json();
    
    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
  });
});
```

## References

- `app/lib/security.ts` - withSecurity, rate limiting, sanitizeErrorMessage
- `app/routes/api.chat.ts` - SSE streaming example
- `app/routes/api.health.ts` - Simple loader example
- `app/routes/api.projects.$id.ts` - Dynamic params example
