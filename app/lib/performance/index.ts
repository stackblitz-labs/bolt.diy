/**
 * Performance Optimization System
 * Export all performance utilities for easy importing
 */

// Core metrics and monitoring
export {
  performanceMonitor,
  journeys,
  observeWebVitals,
  type PerformanceMetric,
} from './metrics';

// Prefetching
export {
  prefetchManager,
  usePrefetchOnHover,
  prefetchComponent,
  prefetchOnVisible,
} from './prefetch';

// Streaming optimizations
export {
  streamingOptimizer,
  BatchedDOMUpdater,
  batchedDOMUpdater,
  ContentBlockMemoizer,
  throttleToFrame,
  measureRender,
  optimizeForHighlighting,
} from './streaming-optimizer';

// WebContainer optimization
export {
  prebootWebContainer,
  getWebContainer,
  isWebContainerReady,
  resetWebContainer,
  getWebContainerPreconnect,
} from './webcontainer-optimizer';

// CodeMirror optimizations
export {
  createOptimizedExtensions,
  preprocessCodeForHighlighting,
  loadLanguageSupport,
  languageCache,
  detectLanguage,
  optimizedEditorConfig,
  codeMirrorMonitor,
  CodeMirrorPerformanceMonitor,
} from './codemirror-optimizer';
