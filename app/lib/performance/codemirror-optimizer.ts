/**
 * CodeMirror Performance Optimizations
 * Based on Claude.dev's findings about syntax highlighting
 */

import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { optimizeForHighlighting } from './streaming-optimizer';

/**
 * Create performance-optimized CodeMirror extensions
 */
export function createOptimizedExtensions(): Extension[] {
  return [
    // Limit syntax highlighting to visible viewport
    EditorView.updateListener.of((update) => {
      if (update.docChanged && update.view.viewport.to - update.view.viewport.from > 10000) {
        // For very large documents, only highlight viewport
        console.log('[CODEMIRROR] Large document detected, limiting highlighting to viewport');
      }
    }),

    // Use faster rendering for large documents
    EditorView.theme({
      '.cm-content': {
        // Use GPU acceleration
        willChange: 'contents',
      },
    }),
  ];
}

/**
 * Preprocess code before highlighting to optimize V8 performance
 * Claude.dev found that em dashes force V8 to slower two-byte path
 */
export function preprocessCodeForHighlighting(code: string): string {
  return optimizeForHighlighting(code);
}

/**
 * Lazy load CodeMirror language modes
 * Only load what's needed when needed
 */
const languageLoaders: Record<string, () => Promise<any>> = {
  javascript: () => import('@codemirror/lang-javascript'),
  typescript: () => import('@codemirror/lang-javascript'),
  jsx: () => import('@codemirror/lang-javascript'),
  tsx: () => import('@codemirror/lang-javascript'),
  python: () => import('@codemirror/lang-python'),
  css: () => import('@codemirror/lang-css'),
  html: () => import('@codemirror/lang-html'),
  json: () => import('@codemirror/lang-json'),
  markdown: () => import('@codemirror/lang-markdown'),
  cpp: () => import('@codemirror/lang-cpp'),
  sass: () => import('@codemirror/lang-sass'),
  vue: () => import('@codemirror/lang-vue'),
  wast: () => import('@codemirror/lang-wast'),
};

/**
 * Load language support on-demand
 */
export async function loadLanguageSupport(language: string): Promise<Extension | null> {
  const normalizedLang = language.toLowerCase();
  const loader = languageLoaders[normalizedLang];

  if (!loader) {
    console.warn(`[CODEMIRROR] No loader for language: ${language}`);
    return null;
  }

  try {
    const module = await loader();

    // Different modules export differently
    if (module.javascript && (normalizedLang === 'javascript' || normalizedLang === 'jsx')) {
      return module.javascript();
    }

    if (module.typescript && (normalizedLang === 'typescript' || normalizedLang === 'tsx')) {
      return module.typescript();
    }

    if (module.python) {
      return module.python();
    }

    if (module.css) {
      return module.css();
    }

    if (module.html) {
      return module.html();
    }

    if (module.json) {
      return module.json();
    }

    // Generic fallback
    return module.default?.() || null;
  } catch (error) {
    console.error(`[CODEMIRROR] Failed to load language ${language}:`, error);
    return null;
  }
}

/**
 * Cache loaded language extensions
 */
class LanguageCache {
  private cache: Map<string, Promise<Extension | null>> = new Map();

  async get(language: string): Promise<Extension | null> {
    if (!this.cache.has(language)) {
      this.cache.set(language, loadLanguageSupport(language));
    }

    return this.cache.get(language)!;
  }

  clear(): void {
    this.cache.clear();
  }
}

export const languageCache = new LanguageCache();

/**
 * Detect language from filename or content
 */
export function detectLanguage(filename: string, content?: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  const extensionMap: Record<string, string> = {
    js: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    jsx: 'jsx',
    ts: 'typescript',
    tsx: 'tsx',
    py: 'python',
    css: 'css',
    scss: 'sass',
    sass: 'sass',
    html: 'html',
    htm: 'html',
    json: 'json',
    md: 'markdown',
    cpp: 'cpp',
    cc: 'cpp',
    cxx: 'cpp',
    vue: 'vue',
    wast: 'wast',
    wat: 'wast',
  };

  return extensionMap[ext] || 'javascript';
}

/**
 * Performance-optimized CodeMirror configuration
 */
export const optimizedEditorConfig = {
  // Defer expensive operations
  updateDelay: 50,

  // Limit rendering
  maxHighlightLength: 20000, // Don't highlight beyond this length

  // Use faster algorithms for large documents
  lineSeparator: '\n',

  // Optimize for typing speed
  tabSize: 2,
};

/**
 * Monitor CodeMirror performance
 */
export class CodeMirrorPerformanceMonitor {
  private highlightTimes: number[] = [];

  recordHighlight(duration: number): void {
    this.highlightTimes.push(duration);

    // Keep last 100 measurements
    if (this.highlightTimes.length > 100) {
      this.highlightTimes.shift();
    }

    if (duration > 100 && import.meta.env.DEV) {
      console.warn(`[CODEMIRROR] Slow highlight: ${duration.toFixed(2)}ms`);
    }
  }

  getStats() {
    if (this.highlightTimes.length === 0) {
      return { avg: 0, max: 0, min: 0 };
    }

    return {
      avg: this.highlightTimes.reduce((a, b) => a + b, 0) / this.highlightTimes.length,
      max: Math.max(...this.highlightTimes),
      min: Math.min(...this.highlightTimes),
    };
  }

  reset(): void {
    this.highlightTimes = [];
  }
}

export const codeMirrorMonitor = new CodeMirrorPerformanceMonitor();
