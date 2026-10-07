# Integration Guide for Performance Optimizations

This guide shows you how to integrate the new performance optimization tools into the existing bolt.diy codebase.

## Step 1: Initialize Performance Monitoring

Add to your app entry point (already done in `app/root.tsx`):

```typescript
// app/root.tsx
import { PerformanceMonitor } from '~/utils/performance-monitor';

export default function App() {
  useEffect(() => {
    // Performance monitoring auto-initializes, but you can track app start
    PerformanceMonitor.endMeasurement('app-launch');
  }, []);

  return <Outlet />;
}
```

## Step 2: Migrate Syntax Highlighting to Worker

### Find Current Shiki Usage

Search for `import { getHighlighter }` or `import ... from 'shiki'` in your codebase.

### Replace with Worker-Based Version

**Before:**
```typescript
import { getHighlighter } from 'shiki';

async function highlightCode(code: string, lang: string) {
  const highlighter = await getHighlighter({
    themes: ['dark-plus'],
    langs: [lang],
  });
  return highlighter.codeToHtml(code, { lang, theme: 'dark-plus' });
}
```

**After:**
```typescript
import { highlightCode } from '~/utils/syntax-highlighter-client';

// Just use it directly - the worker and caching are handled automatically
async function highlight(code: string, lang: string) {
  return await highlightCode(code, lang);
}
```

### Common Files to Update

Likely locations:
- `app/components/chat/CodeBlock.tsx` (if it exists)
- `app/components/workbench/Editor.tsx` (syntax highlighting preview)
- Any component that renders markdown with code blocks

## Step 3: Add Static Composer to Chat

### Find Your Chat Input Component

Look for the main chat input/composer component. Likely in:
- `app/components/chat/ChatBox.tsx`
- `app/components/chat/BaseChat.tsx`
- `app/components/chat/Chat.client.tsx`

### Integrate Static Composer Hook

```typescript
import { useStaticComposerHandoff } from '~/components/chat/StaticComposer';

export function ChatInput() {
  // This captures any input that happened before React loaded
  const [inputValue, setInputValue] = useStaticComposerHandoff('');

  return (
    <textarea
      value={inputValue}
      onChange={(e) => setInputValue(e.target.value)}
      placeholder="How can Bolt help you today?"
      className="..."
    />
  );
}
```

### Add Static HTML to Document

In your HTML entry point or server-side render:

```typescript
// app/root.tsx - in the Layout component's <head>
import { generateStaticComposerHTML } from '~/components/chat/StaticComposer';

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <head>
        {/* ... existing head content ... */}
      </head>
      <body>
        {/* Static composer will be replaced once React loads */}
        <div
          dangerouslySetInnerHTML={{
            __html: generateStaticComposerHTML('How can Bolt help you today?')
          }}
        />
        {children}
      </body>
    </html>
  );
}
```

## Step 4: Add Performance Dashboard to Debug Menu

### Find Your Debug/Settings Menu

Look for where debug tools are rendered, likely:
- `app/components/@settings/`
- `app/components/header/` (header menu)
- Keyboard shortcut handler

### Add Dashboard Toggle

```typescript
import { useState } from 'react';
import { PerformanceDashboard } from '~/components/debug/PerformanceDashboard';

export function DebugMenu() {
  const [showPerformance, setShowPerformance] = useState(false);

  return (
    <>
      <button onClick={() => setShowPerformance(true)}>
        ⚡ Performance Dashboard
      </button>

      {showPerformance && (
        <PerformanceDashboard onClose={() => setShowPerformance(false)} />
      )}
    </>
  );
}
```

### Add Keyboard Shortcut (Optional)

```typescript
useEffect(() => {
  const handleKeyPress = (e: KeyboardEvent) => {
    // Ctrl/Cmd + Shift + P
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
      e.preventDefault();
      setShowPerformance(true);
    }
  };

  window.addEventListener('keydown', handleKeyPress);
  return () => window.removeEventListener('keydown', handleKeyPress);
}, []);
```

## Step 5: Instrument Critical User Journeys

### Chat Initialization

Find where new chats are created:

```typescript
import { PerformanceMonitor } from '~/utils/performance-monitor';

async function createNewChat() {
  await PerformanceMonitor.measureAsync('chat-init', async () => {
    // Your existing chat initialization code
    await initializeWebContainer();
    await setupEditor();
    await setupTerminal();
  }, {
    // Optional metadata
    workspaceType: 'react',
  });
}
```

### Message Sending

Find your message submission handler:

```typescript
async function sendMessage(content: string) {
  PerformanceMonitor.startMeasurement('message-send');
  
  try {
    const response = await apiClient.sendMessage(content);
    
    PerformanceMonitor.endMeasurement('message-send', {
      messageLength: content.length,
      hasCode: /```/.test(content),
    });
    
    return response;
  } catch (error) {
    PerformanceMonitor.endMeasurement('message-send', {
      error: true,
    });
    throw error;
  }
}
```

### File Operations

```typescript
async function loadFile(fileId: string) {
  return await PerformanceMonitor.measureAsync('file-load', async () => {
    const file = await fileSystem.readFile(fileId);
    return file;
  }, {
    fileId,
    fileSize: file.size,
  });
}

function switchFile(fileId: string) {
  PerformanceMonitor.measureSync('file-switch', () => {
    editor.loadFile(fileId);
  }, { fileId });
}
```

### Streaming Messages

Monitor frame rate during streaming:

```typescript
import { FrameRateMonitor } from '~/utils/frame-rate-monitor';

function StreamingMessage({ content }: { content: string }) {
  const monitorRef = useRef<FrameRateMonitor | null>(null);

  useEffect(() => {
    // Start monitoring when streaming begins
    if (content && !monitorRef.current) {
      monitorRef.current = new FrameRateMonitor(60, (fps, dropped) => {
        if (fps < 55) {
          console.warn(`Frame rate dropped to ${fps}fps`);
        }
      });
      monitorRef.current.start();
    }

    // Stop when streaming completes
    if (isComplete && monitorRef.current) {
      const stats = monitorRef.current.getStats();
      PerformanceMonitor.trackJourney('streaming-fps', stats.currentFps, {
        droppedFrames: stats.droppedFrames,
        budgetCompliance: stats.budgetCompliance,
      });
      monitorRef.current.stop();
      monitorRef.current = null;
    }
  }, [content, isComplete]);

  return <div>{content}</div>;
}
```

## Step 6: Run Benchmarks

Ensure benchmarks pass:

```bash
# Run all performance benchmarks
pnpm vitest bench

# Run with verbose output
pnpm vitest bench --reporter=verbose

# Run in watch mode during development
pnpm vitest bench --watch
```

## Step 7: Collect Baseline Metrics

After integration, run the app normally for a few days to collect baseline metrics:

1. Use the app as you normally would
2. Open the Performance Dashboard periodically
3. Check P75 metrics for each journey
4. Export data for analysis

```typescript
// In browser console
const stats = window.PerformanceMonitor.getJourneyStats('chat-init');
console.table(stats);

// Export all data
const data = window.PerformanceMonitor.exportEvents();
console.log(JSON.stringify(data, null, 2));
```

## Step 8: Set Performance Budgets

Based on baseline metrics, set performance budgets in your CI:

```javascript
// scripts/check-performance-budgets.js
const budgets = {
  'chat-init': 300,        // 300ms max
  'message-send': 200,     // 200ms max
  'file-load': 1000,       // 1s max
  'file-switch': 100,      // 100ms max
};

// Check against collected metrics
// Fail CI if P75 exceeds budget
```

## Common Integration Points

### WebContainer Initialization

```typescript
// Make it lazy - only initialize when needed
let containerPromise: Promise<WebContainer> | null = null;

async function getWebContainer() {
  if (!containerPromise) {
    containerPromise = PerformanceMonitor.measureAsync(
      'webcontainer-boot',
      () => WebContainer.boot()
    );
  }
  return containerPromise;
}
```

### CodeMirror Setup

```typescript
import { PerformanceMonitor } from '~/utils/performance-monitor';

const editor = PerformanceMonitor.measureSync('editor-init', () => {
  return new EditorView({
    state: EditorState.create({
      doc: initialContent,
      extensions: [...],
    }),
  });
});
```

### Terminal Setup

```typescript
import { PerformanceMonitor } from '~/utils/performance-monitor';

await PerformanceMonitor.measureAsync('terminal-init', async () => {
  terminal = new Terminal();
  terminal.open(containerElement);
  await terminal.loadAddon(new FitAddon());
});
```

## Verification

After integration, verify everything works:

1. ✅ Performance monitoring is collecting data
2. ✅ Syntax highlighting is non-blocking (check FPS during streaming)
3. ✅ Static composer allows immediate typing
4. ✅ Dashboard shows collected metrics
5. ✅ Benchmarks pass in CI

Check the dashboard after using the app:

```
Expected Journeys to See:
- page-load
- chat-init
- message-send
- file-load
- file-switch
- web-vital-* (FCP, LCP, etc.)
```

## Troubleshooting

### Worker Not Loading

If the syntax highlighter worker fails:

```typescript
// Check browser console for errors
// Verify worker file is built correctly
// Check Content Security Policy (CSP) settings
```

### Static Composer Not Appearing

```typescript
// Verify the HTML is injected before React loads
// Check for CSP issues with inline scripts
// Ensure the ID matches: 'bolt-static-composer'
```

### Performance Data Not Collecting

```typescript
// Check localStorage is available
// Verify PerformanceMonitor.init() was called
// Check browser console for errors
```

## Next Steps

After successful integration:

1. **Analyze bottlenecks** using the dashboard
2. **Optimize hot paths** based on data
3. **Add more instrumentation** for specific features
4. **Set up CI gates** to prevent regressions
5. **Monitor production** with sampling

## Questions?

Refer to:
- [Performance Optimization Guide](./docs/PERFORMANCE_OPTIMIZATION.md)
- [Performance Sprint Overview](./PERFORMANCE_SPRINT.md)
- Inline documentation in source files
