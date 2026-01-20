---
name: testing-vitest-playwright-msw
description: Use when writing or running tests in the website-agent codebase. Covers Vitest for unit/integration tests, Playwright for E2E tests, MSW for API mocking, test file conventions, coverage requirements, and testing patterns for stores/parsers/API routes. Triggers include "test", "vitest", "playwright", "msw", "unit test", "integration test", "e2e test", "mock api", "test coverage", "pnpm test", "test file", "describe", "it", "expect", "beforeEach", "test:watch".
---

# Testing Skill (Vitest + Playwright + MSW)

## Goal

Write and run tests following codebase conventions: Vitest for unit/integration, Playwright for E2E, MSW for API mocking.

## Test Commands

```bash
pnpm test                    # Run all Vitest tests once
pnpm run test:watch          # Run tests in watch mode
pnpm exec vitest run <path>  # Run single test file
pnpm exec vitest run -t "pattern"  # Run tests matching pattern
```

## Directory Structure

```
tests/
├── unit/                    # Unit tests for pure functions
│   └── *.test.ts
├── integration/             # Integration tests for stores/services
│   └── *.test.ts
└── preview/                 # Playwright E2E tests
    └── *.spec.ts

test/
└── stubs/                   # Test stubs and mocks
```

## Vitest Test Patterns

### Basic Test Structure

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('ComponentName', () => {
  beforeEach(() => {
    // Setup before each test
  });

  afterEach(() => {
    // Cleanup after each test
    vi.clearAllMocks();
  });

  it('should do something specific', () => {
    const result = someFunction(input);
    expect(result).toBe(expected);
  });

  it('should handle edge case', () => {
    expect(() => someFunction(invalid)).toThrow('Error message');
  });
});
```

### Testing Nanostores

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { atom, map } from 'nanostores';

describe('chatStore', () => {
  let store: ReturnType<typeof atom<boolean>>;

  beforeEach(() => {
    store = atom(false);
  });

  it('should initialize with default value', () => {
    expect(store.get()).toBe(false);
  });

  it('should update value', () => {
    store.set(true);
    expect(store.get()).toBe(true);
  });

  it('should notify subscribers', () => {
    const values: boolean[] = [];
    store.subscribe((v) => values.push(v));
    
    store.set(true);
    store.set(false);
    
    expect(values).toEqual([false, true, false]); // Initial + updates
  });
});
```

### Testing Parsers/Utilities

```typescript
import { describe, it, expect } from 'vitest';
import { parseMessage } from '~/lib/runtime/message-parser';

describe('message-parser', () => {
  it('should parse file action', () => {
    const input = `<boltAction type="file" filePath="/src/app.ts">
      const x = 1;
    </boltAction>`;
    
    const result = parseMessage(input);
    
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'file',
      filePath: '/src/app.ts',
    });
  });

  it('should handle malformed input', () => {
    const input = 'plain text without actions';
    const result = parseMessage(input);
    expect(result).toHaveLength(0);
  });
});
```

### Testing API Routes

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { action, loader } from '~/routes/api.my-route';

// Mock dependencies
vi.mock('~/lib/security', () => ({
  withSecurity: (handler: Function) => handler,
  sanitizeErrorMessage: (e: Error) => e.message,
}));

describe('api.my-route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('validates request body', async () => {
    const request = new Request('http://localhost/api/my-route', {
      method: 'POST',
      body: JSON.stringify({ invalid: 'data' }),
    });

    const response = await action({ request, params: {}, context: {} });
    
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe(true);
  });

  it('returns success on valid request', async () => {
    const request = new Request('http://localhost/api/my-route', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test' }),
    });

    const response = await action({ request, params: {}, context: {} });
    
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.success).toBe(true);
  });
});
```

### Mocking with vi.mock

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock at module level
vi.mock('~/lib/services/mcpService', () => ({
  MCPService: {
    getInstance: vi.fn(() => ({
      tools: {},
      isValidToolName: vi.fn().mockReturnValue(false),
    })),
  },
}));

// Mock fetch globally
vi.stubGlobal('fetch', vi.fn());

describe('service with mocks', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockReset();
  });

  it('handles API response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: 'test' }), { status: 200 })
    );

    const result = await myService.fetchData();
    
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/'),
      expect.any(Object)
    );
    expect(result).toEqual({ data: 'test' });
  });
});
```

## MSW (Mock Service Worker)

### Setup MSW Handler

```typescript
// tests/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  // Mock Google Places API
  http.get('https://maps.googleapis.com/maps/api/place/*', () => {
    return HttpResponse.json({
      result: {
        name: 'Test Restaurant',
        formatted_address: '123 Main St',
      },
    });
  }),

  // Mock LLM API
  http.post('/api/chat', () => {
    return new Response(
      'data: {"content":"Hello"}\n\ndata: [DONE]\n\n',
      { headers: { 'Content-Type': 'text/event-stream' } }
    );
  }),

  // Mock with dynamic response
  http.post('/api/projects/:id', ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      created: true,
    });
  }),
];
```

### Setup MSW Server

```typescript
// tests/mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);

// vitest.setup.ts
import { beforeAll, afterAll, afterEach } from 'vitest';
import { server } from './tests/mocks/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### Override Handlers in Tests

```typescript
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';

describe('error handling', () => {
  it('handles API errors', async () => {
    // Override for this specific test
    server.use(
      http.get('/api/data', () => {
        return new HttpResponse(null, { status: 500 });
      })
    );

    await expect(fetchData()).rejects.toThrow('Server error');
  });
});
```

## Playwright E2E Tests

### Test File Structure

```typescript
// tests/preview/smoke.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('homepage loads', async ({ page }) => {
    await page.goto('/');
    
    await expect(page).toHaveTitle(/HuskIT/);
    await expect(page.locator('main')).toBeVisible();
  });

  test('chat interface works', async ({ page }) => {
    await page.goto('/');
    
    const chatInput = page.getByRole('textbox', { name: /message/i });
    await expect(chatInput).toBeVisible();
    
    await chatInput.fill('Hello');
    await page.keyboard.press('Enter');
    
    await expect(page.locator('.chat-message')).toBeVisible();
  });
});
```

### Playwright Config

```typescript
// playwright.config.preview.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/preview',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  
  use: {
    baseURL: process.env.PREVIEW_URL || 'http://localhost:5171',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: process.env.CI ? undefined : {
    command: 'pnpm run start',
    port: 5171,
    reuseExistingServer: !process.env.CI,
  },
});
```

### Run Playwright Tests

```bash
# Install Playwright browsers (first time)
npx playwright install

# Run E2E tests
npx playwright test --config=playwright.config.preview.ts

# Run with UI mode
npx playwright test --config=playwright.config.preview.ts --ui

# Run specific test file
npx playwright test tests/preview/smoke.spec.ts
```

## Coverage Requirements

From constitution:
- **≥90%** for critical runtimes (message-parser, action-runner)
- **≥80%** for touched files

Check coverage:
```bash
pnpm test -- --coverage
```

## Test File Naming

| Type | Pattern | Location |
|------|---------|----------|
| Unit | `*.test.ts` | `tests/unit/` |
| Integration | `*.test.ts` | `tests/integration/` |
| E2E | `*.spec.ts` | `tests/preview/` |
| Component | `*.test.tsx` | `tests/unit/` |

## Testing Async/Streaming

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('SSE streaming', () => {
  it('handles stream correctly', async () => {
    const chunks: string[] = [];
    
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue('data: {"content":"Hello"}\n\n');
        controller.enqueue('data: {"content":" World"}\n\n');
        controller.close();
      },
    });

    const reader = stream.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(decoder.decode(value));
    }

    expect(chunks.join('')).toContain('Hello');
    expect(chunks.join('')).toContain('World');
  });
});
```

## Checklist

- [ ] Test file in correct directory (`tests/unit/`, `tests/integration/`, `tests/preview/`)
- [ ] Proper naming: `.test.ts` for unit/integration, `.spec.ts` for E2E
- [ ] Use `describe()` blocks to group related tests
- [ ] Use `beforeEach()`/`afterEach()` for setup/cleanup
- [ ] Clear mocks with `vi.clearAllMocks()` in afterEach
- [ ] Mock external services with MSW for API tests
- [ ] Use `vi.mock()` for module-level mocking
- [ ] Test both success and error paths
- [ ] Use `expect().toMatchObject()` for partial matching
- [ ] Avoid testing implementation details
- [ ] E2E tests use Playwright locators (`getByRole`, `getByText`)

## References

- `tests/` - Test directories
- `vitest.setup.ts` - Vitest global setup
- `playwright.config.preview.ts` - Playwright configuration
- `test/stubs/` - Test stubs and mocks
