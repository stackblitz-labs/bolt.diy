# Performance Improvements & Optimizations

This document outlines the performance optimizations and stability improvements made to enhance the application for personal development tools.

## Table of Contents

1. [Overview](#overview)
2. [Key Improvements](#key-improvements)
3. [New Components & Utilities](#new-components--utilities)
4. [Configuration](#configuration)
5. [Best Practices](#best-practices)

## Overview

The codebase has been optimized to:
- **Prevent crashes** through comprehensive error handling
- **Improve performance** with efficient resource management
- **Reduce memory leaks** with proper cleanup
- **Enhance stability** with retry logic and graceful degradation
- **Tailor features** for personal development workflows

## Key Improvements

### 1. Production Logging Fixes

**Problem**: Console.log statements in production code can impact performance and expose debug information.

**Solution**: Conditional logging based on environment.

**Files Modified**:
- `app/lib/.server/llm/switchable-stream.ts:50-54`
- `app/lib/services/localModelHealthMonitor.ts:222-224,239-241,264-266`

**Example**:
```typescript
// Before
console.log(error);

// After
if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.error('[SwitchableStream] Stream pump error:', error);
}
```

### 2. Exponential Backoff for Retries

**Problem**: Linear retries without backoff can cause retry storms and overwhelm failing services.

**Solution**: Implemented exponential backoff with jitter.

**Files Modified**:
- `app/lib/.server/llm/stream-recovery.ts`

**Features**:
- Base delay: 1 second
- Maximum delay: 30 seconds
- Random jitter up to 30% to prevent thundering herd
- Configurable retry parameters

**Example**:
```typescript
const manager = new StreamRecoveryManager({
  maxRetries: 3,
  timeout: 30000,
  baseRetryDelay: 1000,
  maxRetryDelay: 30000,
});
```

### 3. Fixed Duplicate State Updates

**Problem**: Duplicate `setState` calls waste render cycles and can cause inconsistent state.

**Files Modified**:
- `app/lib/hooks/useConnectionStatus.ts:48-66`

**Changes**:
- Removed duplicate `setAcknowledgedIssue()` calls
- Added proper localStorage synchronization
- Added error handling for localStorage operations

### 4. Generic Error Boundary Component

**Problem**: Missing error boundaries lead to white screen of death on component errors.

**Solution**: Created reusable error boundary component with rich features.

**New File**: `app/components/ui/ErrorBoundary.tsx`

**Features**:
- Customizable fallback UI
- Error logging with context
- Reset functionality
- Development-mode error details
- Higher-order component wrapper
- Error handler hook for async errors

**Usage**:
```typescript
import { ErrorBoundary } from '~/components/ui/ErrorBoundary';

// Basic usage
<ErrorBoundary context="My Feature">
  <MyComponent />
</ErrorBoundary>

// With custom error handler
<ErrorBoundary
  context="API Calls"
  onError={(error, errorInfo) => {
    // Send to error tracking service
  }}
>
  <APIComponent />
</ErrorBoundary>

// As HOC
const SafeComponent = withErrorBoundary(MyComponent, {
  context: 'Safe Component'
});

// Hook for async errors
function MyComponent() {
  const { handleError } = useErrorHandler();

  const fetchData = async () => {
    try {
      await api.fetch();
    } catch (error) {
      handleError(error, 'Data Fetching');
    }
  };
}
```

### 5. Performance Utilities

**New File**: `app/utils/performance.ts`

**Utilities Included**:

#### Resource Management Hooks
- `useDebounce` - Debounce with automatic cleanup
- `useThrottle` - Throttle with automatic cleanup
- `useInterval` - setInterval with automatic cleanup
- `useTimeout` - setTimeout with automatic cleanup
- `useAbortController` - AbortController with automatic cleanup
- `useEventListener` - Event listeners with automatic cleanup

#### Caching
- `LRUCache` - Least Recently Used cache with size limit

#### Processing
- `processInChunks` - Process large arrays without blocking UI
- `retryWithBackoff` - Retry failed operations with exponential backoff

#### Storage
- `safeLocalStorage` - localStorage with error handling
- `safeJSONParse` - JSON.parse with fallback

#### Monitoring (Development Only)
- `useRenderCount` - Track component render count
- `useComponentLifetime` - Measure component lifetime

**Examples**:
```typescript
import {
  useDebounce,
  useInterval,
  LRUCache,
  processInChunks
} from '~/utils/performance';

// Debounced search
const debouncedSearch = useDebounce((query) => {
  searchAPI(query);
}, 300);

// Auto-cleanup interval
useInterval(() => {
  checkHealth();
}, 30000); // Check every 30s

// LRU cache for expensive computations
const cache = new LRUCache<string, Result>(100);

if (cache.has(key)) {
  return cache.get(key);
}

const result = expensiveComputation();
cache.set(key, result);

// Process large arrays
const results = await processInChunks(
  items,
  async (item) => await process(item),
  50, // chunk size
  10  // delay between chunks (ms)
);
```

### 6. Development Tools Configuration

**New File**: `app/config/devtools.config.ts`

**Features**:
- Centralized configuration for development workflows
- Performance settings
- Error handling preferences
- Feature toggles
- Editor and terminal settings
- Persistent user preferences
- Multiple presets (performance, privacy, full-featured, minimal)

**Usage**:
```typescript
import {
  getDevToolsConfig,
  saveDevToolsConfig,
  applyDevToolsPreset
} from '~/config/devtools.config';

// Get current config
const config = getDevToolsConfig();

// Update specific settings
saveDevToolsConfig({
  performance: {
    enableVirtualScrolling: true,
  },
  features: {
    preferredAIProviders: ['Anthropic', 'Ollama'],
  },
});

// Apply preset
applyDevToolsPreset('privacy'); // Use local AI only
```

**Available Presets**:
- `performance` - Maximum performance, disable heavy features
- `privacy` - Privacy-focused, local AI only
- `fullFeatured` - All features enabled (default)
- `minimal` - Essential features only

## Configuration

### Performance Settings

```typescript
{
  performance: {
    enableVirtualScrolling: true,
    maxItemsBeforeVirtualization: 100,
    batchProcessingChunkSize: 50,
    fileOperationDebounce: 300,
    enablePerformanceMonitoring: true,
  }
}
```

### Error Handling

```typescript
{
  errorHandling: {
    enableErrorBoundaries: true,
    showDetailedErrors: true,
    maxRetryAttempts: 3,
    baseRetryDelay: 1000,
    enableAutoRecovery: true,
  }
}
```

### Features for Personal Development

```typescript
{
  features: {
    enableSnippetsLibrary: true,
    enableProjectTemplates: true,
    enableGitIntegration: true,
    enableDeployment: true,
    enableDatabaseIntegration: true,
    enableAISuggestions: true,
    preferredAIProviders: [
      'Anthropic',
      'OpenAI',
      'Ollama',    // Local AI for privacy
      'LMStudio',  // Local AI for offline work
    ],
  }
}
```

## Best Practices

### 1. Always Use Error Boundaries

Wrap all major features in error boundaries to prevent crashes:

```typescript
<ErrorBoundary context="Feature Name">
  <YourComponent />
</ErrorBoundary>
```

### 2. Clean Up Resources

Use the performance hooks to ensure proper cleanup:

```typescript
// ❌ Bad - memory leak
useEffect(() => {
  const interval = setInterval(() => {}, 1000);
  // Missing cleanup!
}, []);

// ✅ Good - automatic cleanup
useInterval(() => {
  // Your code
}, 1000);
```

### 3. Debounce Expensive Operations

```typescript
// ❌ Bad - runs on every keystroke
const handleSearch = (query) => {
  expensiveAPICall(query);
};

// ✅ Good - debounced
const handleSearch = useDebounce((query) => {
  expensiveAPICall(query);
}, 300);
```

### 4. Use LRU Cache for Repeated Computations

```typescript
const cache = new LRUCache<string, Result>(100);

function getResult(key: string): Result {
  if (cache.has(key)) {
    return cache.get(key)!;
  }

  const result = expensiveComputation(key);
  cache.set(key, result);
  return result;
}
```

### 5. Process Large Arrays in Chunks

```typescript
// ❌ Bad - blocks UI
const results = items.map(item => heavyProcess(item));

// ✅ Good - non-blocking
const results = await processInChunks(
  items,
  item => heavyProcess(item),
  50  // process 50 at a time
);
```

### 6. Handle Async Errors Properly

```typescript
function MyComponent() {
  const { handleError } = useErrorHandler();

  const fetchData = async () => {
    try {
      await api.fetch();
    } catch (error) {
      handleError(error, 'Data Fetching');
    }
  };

  return <button onClick={fetchData}>Fetch</button>;
}
```

### 7. Use Retry Logic for Network Operations

```typescript
import { retryWithBackoff } from '~/utils/performance';

const data = await retryWithBackoff(
  async () => await fetch('/api/data'),
  {
    maxRetries: 3,
    baseDelay: 1000,
    onRetry: (attempt, error) => {
      console.log(`Retry attempt ${attempt}:`, error);
    },
  }
);
```

## Performance Monitoring

In development mode, you can monitor component performance:

```typescript
function MyComponent() {
  // Track renders
  const renderCount = useRenderCount('MyComponent');

  // Track lifetime
  useComponentLifetime('MyComponent');

  return <div>Rendered {renderCount} times</div>;
}
```

## Impact Summary

| Improvement | Impact | Files Modified/Created |
|-------------|--------|------------------------|
| Production logging fixes | Reduced console overhead, better security | 2 files modified |
| Exponential backoff | Prevents retry storms, better error recovery | 1 file modified |
| Fixed duplicate updates | Fewer render cycles, better performance | 1 file modified |
| Error boundaries | Prevents crashes, better UX | 1 file created |
| Performance utilities | Prevents memory leaks, better resource management | 1 file created |
| Dev tools config | Tailored for personal development, customizable | 1 file created |

## Migration Guide

### For Existing Code

1. **Add Error Boundaries**: Wrap features in `<ErrorBoundary>`
2. **Replace setInterval/setTimeout**: Use `useInterval`/`useTimeout` hooks
3. **Add Debouncing**: Use `useDebounce` for input handlers
4. **Cache Results**: Use `LRUCache` for expensive computations
5. **Handle Errors**: Use `useErrorHandler` for async operations

### For New Code

1. **Start with Error Boundary**: Always wrap new features
2. **Use Performance Hooks**: Prefer hooks over raw timers
3. **Configure Features**: Use devtools config for feature flags
4. **Monitor Performance**: Use monitoring hooks in development

## Future Improvements

1. Add virtual scrolling to FileTree component
2. Implement request deduplication for API calls
3. Add service worker for offline support
4. Implement code splitting for faster initial load
5. Add performance budgets and monitoring
6. Implement IndexedDB caching for large datasets
7. Add telemetry for error tracking (opt-in)

## Questions?

For questions or suggestions, please open an issue in the repository.
