# Quick Start Guide: Tasks T013-T015

**Phase 3 Remaining Tasks**: Orchestration and PCC UI
**Prerequisites**: T008-T012 completed ✅
**Status**: Ready to implement

---

## Overview

The core crawler agent (T008-T012) is complete and tested. The remaining tasks wire up the UI and orchestration:

- **T013**: Route handler for SSE-based crawler execution
- **T014**: PCC UI components (badges, chips)
- **T015**: Error toast integration

---

## T013: Orchestration in api.site.generate.ts

### Goal
Create or update the Remix route handler to:
1. Accept user prompts via chat
2. Collect missing data conversationally
3. Execute crawler via `executeCrawl()`
4. Stream SSE events to PCC
5. Persist results via `persistCrawlResult()`

### File Location
`/Users/khoitran/Documents/Projects/huskit/website-agent/app/routes/api.site.generate.ts`

### Implementation Pattern

```typescript
import { executeCrawl, persistCrawlResult } from '~/lib/services/crawlerAgent.server';
import { createToastFromError } from '~/lib/services/crawlerAgent.schema';
import type { ActionFunctionArgs } from '@remix-run/node';

export async function action({ request }: ActionFunctionArgs) {
  // 1. Parse incoming request
  const formData = await request.formData();
  const message = formData.get('message') as string;
  const tenantId = formData.get('tenantId') as string;

  // 2. Conversational collection (state machine)
  const { googleMapsUrl, legacySite, socialProfiles, ready } =
    await collectInputs(message, tenantId);

  if (!ready) {
    // Return prompt for missing data
    return eventStream((send) => {
      send({ event: 'prompt', data: 'Please provide your Google Maps URL' });
    });
  }

  // 3. Execute crawler
  return eventStream((send) => {
    // Send heartbeat every 5s
    const heartbeat = setInterval(() => {
      send({ event: 'heartbeat', data: { timestamp: Date.now() } });
    }, 5000);

    try {
      // Emit start event
      send({ event: 'crawl.start', data: { correlationId } });

      // Execute crawl
      const result = await executeCrawl({
        tenantId,
        sourceUrl: googleMapsUrl,
      }, authenticatedTenantId);

      // Persist to Supabase
      const rawPayloadRef = await persistCrawlResult(
        result,
        { sourceUrl: googleMapsUrl, fetchedAt: new Date() },
        24 // TTL hours
      );

      // Emit completion
      send({
        event: 'crawl.complete',
        data: {
          placeId: result.placeId,
          missingSections: result.missingSections,
          quotaState: result.quotaState,
          rawPayloadRef,
        }
      });

      // Handle errors
      if (result.error) {
        const toast = createToastFromError(result.error);
        send({ event: 'toast', data: toast });
      }

    } catch (error) {
      send({ event: 'crawl.error', data: { message: error.message } });
    } finally {
      clearInterval(heartbeat);
    }
  });
}

// Helper: SSE stream wrapper
function eventStream(handler: (send: SendFn) => void | Promise<void>) {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: { event: string; data: any }) => {
        controller.enqueue(
          encoder.encode(`event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`)
        );
      };

      await handler(send);
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

### Conversational State Machine

```typescript
interface ConversationState {
  googleMapsUrl?: string;
  legacySite?: string;
  socialProfiles?: string[];
  ready: boolean;
}

async function collectInputs(
  message: string,
  tenantId: string
): Promise<ConversationState> {
  // Retrieve state from session/DB
  const state = await getConversationState(tenantId);

  // Parse user input
  if (!state.googleMapsUrl) {
    const url = extractGoogleMapsUrl(message);
    if (url) {
      state.googleMapsUrl = url;
      // Prompt for optional data
      return { ...state, ready: false };
    }
    return { ...state, ready: false };
  }

  // Optional: legacy site
  if (!state.legacySite && message.includes('http')) {
    state.legacySite = extractUrl(message);
  }

  // Check if user wants to skip
  if (message.match(/skip|no|just.*maps/i)) {
    state.ready = true;
  }

  // Ready when required inputs collected
  state.ready = !!state.googleMapsUrl;

  await saveConversationState(tenantId, state);
  return state;
}
```

---

## T014: PCC Provenance Badges and Chips

### Goal
Create React components for:
- Provenance badges (Maps, Website, Social icons + tooltips)
- "Needs data" chips (actionable, keyboard accessible)

### File Location
`/Users/khoitran/Documents/Projects/huskit/website-agent/app/components/workbench/PromptCommandCenter.tsx`

### Component Implementations

#### Provenance Badge

```typescript
import { createProvenanceBadge } from '~/lib/services/crawlerAgent.schema';
import type { SectionType, SourceUsed } from '~/lib/services/crawlerAgent.schema';

interface ProvenanceBadgeProps {
  section: SectionType;
  sources: SourceUsed[];
}

export function ProvenanceBadge({ section, sources }: ProvenanceBadgeProps) {
  const badge = createProvenanceBadge(section, sources);

  return (
    <div
      className="provenance-badge-container"
      role="status"
      aria-label={`Data sources for ${section}`}
    >
      {sources.map((source, idx) => {
        const Icon = getSourceIcon(source.type); // Maps/Website/Social icons
        const timestamp = new Date(source.timestamp).toLocaleString();

        return (
          <span
            key={idx}
            className="provenance-badge"
            title={`From ${source.type} at ${timestamp}`}
            aria-label={`${section} sourced from ${source.type} on ${timestamp}`}
          >
            <Icon className="w-4 h-4" />
            <span className="sr-only">{source.type}</span>
          </span>
        );
      })}
    </div>
  );
}

// Icon mapping
function getSourceIcon(type: 'maps' | 'website' | 'social') {
  const icons = {
    maps: MapPinIcon,
    website: GlobeIcon,
    social: ShareIcon,
  };
  return icons[type];
}
```

#### Needs Data Chip

```typescript
import { createNeedsDataChip } from '~/lib/services/crawlerAgent.schema';
import type { SectionType } from '~/lib/services/crawlerAgent.schema';

interface NeedsDataChipProps {
  section: SectionType;
  onRequest: (section: SectionType) => void;
}

export function NeedsDataChip({ section, onRequest }: NeedsDataChipProps) {
  const chip = createNeedsDataChip(section);

  const handleClick = () => {
    onRequest(section);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onRequest(section);
    }
  };

  return (
    <button
      className="needs-data-chip"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={chip.ariaLabel}
      role="button"
      tabIndex={0}
    >
      <span className="warning-icon" aria-hidden="true">⚠️</span>
      <span>{chip.label}</span>
      {chip.guidance && (
        <span className="chip-guidance" aria-live="polite">
          {chip.guidance}
        </span>
      )}
    </button>
  );
}
```

#### Styles (in component or CSS module)

```css
.provenance-badge-container {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.provenance-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  background: var(--color-badge-bg);
  cursor: help;
  transition: background 0.2s;
}

.provenance-badge:hover,
.provenance-badge:focus {
  background: var(--color-badge-bg-hover);
}

.needs-data-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid var(--color-warning);
  background: var(--color-warning-bg);
  color: var(--color-warning-fg);
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.needs-data-chip:hover,
.needs-data-chip:focus {
  background: var(--color-warning-bg-hover);
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.needs-data-chip:focus {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}

.warning-icon {
  font-size: 1.125rem;
}

.chip-guidance {
  font-size: 0.875rem;
  font-weight: normal;
  opacity: 0.8;
}
```

---

## T015: Error Toast Mapping

### Goal
Map crawler error codes to accessible toasts with:
- Deterministic messaging
- CTAs for remediation
- FR-011 compliance (≥6s, role="alert", Escape dismiss)

### File Location
Same as T014: `app/components/workbench/PromptCommandCenter.tsx`

### Component Implementation

```typescript
import { useState, useEffect } from 'react';
import { createToastFromError } from '~/lib/services/crawlerAgent.schema';
import type { PCCToast } from '~/lib/services/crawlerAgent.schema';

interface AccessibleToastProps {
  toast: PCCToast;
  onDismiss: () => void;
  onCtaClick?: (ctaId: string) => void;
}

export function AccessibleToast({ toast, onDismiss, onCtaClick }: AccessibleToastProps) {
  useEffect(() => {
    // Auto-dismiss after duration
    const timer = setTimeout(() => {
      if (toast.dismissible) {
        onDismiss();
      }
    }, toast.duration);

    return () => clearTimeout(timer);
  }, [toast.duration, toast.dismissible, onDismiss]);

  useEffect(() => {
    // Keyboard handler for Escape key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && toast.dismissible) {
        onDismiss();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toast.dismissible, onDismiss]);

  const handleCtaClick = () => {
    if (toast.ctaId && onCtaClick) {
      onCtaClick(toast.ctaId);
    }
  };

  return (
    <div
      className={`pcc-toast pcc-toast-${toast.type}`}
      role={toast.role}
      aria-live={toast.role === 'alert' ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      <div className="toast-icon" aria-hidden="true">
        {getToastIcon(toast.type)}
      </div>

      <div className="toast-content">
        <p className="toast-message">{toast.message}</p>

        {toast.ctaLabel && (
          <button
            className="toast-cta"
            onClick={handleCtaClick}
            aria-label={toast.ctaLabel}
          >
            {toast.ctaLabel}
          </button>
        )}
      </div>

      {toast.dismissible && (
        <button
          className="toast-dismiss"
          onClick={onDismiss}
          aria-label="Dismiss notification"
        >
          <XIcon className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// Icon mapping
function getToastIcon(type: 'info' | 'warning' | 'error' | 'success') {
  const icons = {
    info: InfoIcon,
    warning: WarningIcon,
    error: ErrorIcon,
    success: CheckIcon,
  };
  return icons[type];
}
```

### Toast Manager Hook

```typescript
export function useToasts() {
  const [toasts, setToasts] = useState<PCCToast[]>([]);

  const showToast = (toast: PCCToast) => {
    setToasts(prev => [...prev, toast]);
  };

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return { toasts, showToast, dismissToast };
}

// Usage in PCC component
export function PromptCommandCenter() {
  const { toasts, showToast, dismissToast } = useToasts();

  // When crawl error occurs:
  if (crawlResult.error) {
    const toast = createToastFromError(crawlResult.error);
    showToast(toast);
  }

  return (
    <div className="pcc-container">
      {/* Toast container - pinned to top */}
      <div className="toast-container" aria-live="polite" aria-relevant="additions">
        {toasts.map(toast => (
          <AccessibleToast
            key={toast.id}
            toast={toast}
            onDismiss={() => dismissToast(toast.id)}
            onCtaClick={(ctaId) => handleCta(ctaId)}
          />
        ))}
      </div>

      {/* Rest of PCC UI */}
      <div className="chat-panel">
        {/* ... */}
      </div>
    </div>
  );
}
```

### Styles

```css
.toast-container {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-width: 28rem;
}

.pcc-toast {
  display: flex;
  gap: 0.75rem;
  padding: 1rem;
  border-radius: 0.5rem;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06);
  background: var(--color-surface);
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.pcc-toast-error {
  background: var(--color-error-bg);
  border: 2px solid var(--color-error);
}

.pcc-toast-warning {
  background: var(--color-warning-bg);
  border: 2px solid var(--color-warning);
}

.pcc-toast-info {
  background: var(--color-info-bg);
  border: 2px solid var(--color-info);
}

.pcc-toast-success {
  background: var(--color-success-bg);
  border: 2px solid var(--color-success);
}

.toast-icon {
  flex-shrink: 0;
  width: 1.5rem;
  height: 1.5rem;
}

.toast-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.toast-message {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.5;
}

.toast-cta {
  align-self: flex-start;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  background: var(--color-primary);
  color: var(--color-primary-fg);
  border: none;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.2s;
}

.toast-cta:hover,
.toast-cta:focus {
  background: var(--color-primary-hover);
}

.toast-cta:focus {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}

.toast-dismiss {
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 0.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.toast-dismiss:hover,
.toast-dismiss:focus {
  background: rgba(0,0,0,0.05);
}

.toast-dismiss:focus {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}
```

---

## Testing Checklist

After implementing T013-T015, verify:

- [ ] **T013 Orchestration**
  - [ ] SSE stream connects and emits events
  - [ ] Conversational flow collects inputs
  - [ ] `executeCrawl` called with correct params
  - [ ] `persistCrawlResult` saves to Supabase
  - [ ] Heartbeat emits every 5 seconds
  - [ ] Errors mapped to toasts

- [ ] **T014 PCC UI**
  - [ ] Provenance badges render with correct icons
  - [ ] Tooltips show source + timestamp
  - [ ] "Needs data" chips render for missing sections
  - [ ] Keyboard navigation works (Tab/Shift+Tab)
  - [ ] ARIA labels announced by screen readers
  - [ ] Focus indicators visible

- [ ] **T015 Error Toasts**
  - [ ] Toasts appear on crawl errors
  - [ ] Duration ≥6s for destructive toasts
  - [ ] Escape key dismisses
  - [ ] CTA buttons functional
  - [ ] role="alert" for errors
  - [ ] Auto-dismiss after duration

- [ ] **Integration**
  - [ ] End-to-end flow works (prompt → crawl → display)
  - [ ] Cache hits skip crawl
  - [ ] Force refresh bypasses cache
  - [ ] Cross-tenant requests rejected

---

## File Paths Reference

```
/Users/khoitran/Documents/Projects/huskit/website-agent/
├── app/
│   ├── routes/
│   │   └── api.site.generate.ts (T013 - create or update)
│   ├── components/
│   │   └── workbench/
│   │       └── PromptCommandCenter.tsx (T014-T015 - update)
│   └── lib/
│       └── services/
│           ├── crawlerAgent.schema.ts (✅ already created)
│           └── crawlerAgent.server.ts (✅ already created)
└── tests/
    ├── unit/
    │   └── services/
    │       └── crawlerAgent.test.ts (✅ already created)
    └── integration/
        └── api.site.generate.test.ts (✅ already created)
```

---

## API Reference

### From crawlerAgent.server.ts

```typescript
// Execute crawler request
executeCrawl(
  request: { tenantId, sourceUrl?, placeId?, forceRefresh?, ... },
  authenticatedTenantId: string
): Promise<CrawlResult>

// Persist result to Supabase
persistCrawlResult(
  result: CrawlResult,
  rawPayload: any,
  ttlHours?: number
): Promise<string> // Returns rawPayloadRef

// Invalidate cache
invalidateCachedCrawl(
  tenantId: string,
  placeId: string,
  reason: string,
  requestedBy?: string
): Promise<void>

// Get recent crawls
getRecentCrawls(
  tenantId: string,
  limit?: number
): Promise<CrawlResult[]>
```

### From crawlerAgent.schema.ts

```typescript
// Create toast from error
createToastFromError(error: CrawlError): PCCToast

// Create provenance badge
createProvenanceBadge(
  section: SectionType,
  sources: SourceUsed[]
): ProvenanceBadge

// Create "needs data" chip
createNeedsDataChip(
  section: SectionType,
  guidance?: string
): NeedsDataChip

// Error toast config
ERROR_TOAST_CONFIG: Record<CrawlErrorCode, ErrorToastConfig>
```

---

## Next Steps

1. **Start with T013**: Get the orchestration working first
2. **Then T014**: Add UI components for badges and chips
3. **Finally T015**: Wire up error toasts
4. **Test end-to-end**: Verify full flow works
5. **Check FR-011**: Validate accessibility compliance

Good luck! The foundation is solid, now bring it to life in the UI.
