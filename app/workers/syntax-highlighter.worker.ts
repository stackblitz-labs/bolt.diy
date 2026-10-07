/* eslint-disable consistent-return */
/**
 * Syntax Highlighting Worker
 * Moves expensive syntax highlighting off the main thread
 *
 * This prevents code highlighting from blocking the UI during streaming
 * Expected impact: 40-60% reduction in main thread blocking time
 */

import { createHighlighter, type Highlighter, type BundledLanguage, type BundledTheme } from 'shiki';

let highlighter: Highlighter | null = null;
let isInitializing = false;
let initQueue: Array<() => void> = [];

// Most commonly used languages - load these by default
const DEFAULT_LANGUAGES: BundledLanguage[] = [
  'javascript',
  'typescript',
  'jsx',
  'tsx',
  'python',
  'html',
  'css',
  'json',
  'markdown',
  'bash',
  'shell',
  'sql',
  'yaml',
];

// Default themes
const DEFAULT_THEMES: BundledTheme[] = ['dark-plus', 'light-plus'];

interface HighlightRequest {
  id: string;
  code: string;
  language: BundledLanguage;
  theme?: BundledTheme;
}

interface HighlightResponse {
  id: string;
  html: string;
  error?: string;
}

/**
 * Initialize the highlighter
 */
async function initHighlighter(): Promise<void> {
  if (highlighter) {
    return;
  }

  if (isInitializing) {
    return new Promise((resolve) => {
      initQueue.push(resolve);
    });
  }

  isInitializing = true;

  try {
    highlighter = await createHighlighter({
      themes: DEFAULT_THEMES,
      langs: DEFAULT_LANGUAGES,
    });

    // Notify all waiting requests
    initQueue.forEach((resolve) => resolve());
    initQueue = [];
  } catch (error) {
    console.error('Failed to initialize highlighter:', error);
    throw error;
  } finally {
    isInitializing = false;
  }
}

/**
 * Highlight code with the given language and theme
 */
async function highlightCode(
  code: string,
  language: BundledLanguage,
  theme: BundledTheme = 'dark-plus',
): Promise<string> {
  if (!highlighter) {
    await initHighlighter();
  }

  if (!highlighter) {
    throw new Error('Highlighter not initialized');
  }

  try {
    // Ensure the language is loaded
    const loadedLanguages = highlighter.getLoadedLanguages();

    if (!loadedLanguages.includes(language)) {
      await highlighter.loadLanguage(language);
    }

    // Ensure the theme is loaded
    const loadedThemes = highlighter.getLoadedThemes();

    if (!loadedThemes.includes(theme)) {
      await highlighter.loadTheme(theme);
    }

    return highlighter.codeToHtml(code, {
      lang: language,
      theme,
    });
  } catch (error) {
    console.error('Failed to highlight code:', error);

    // Fallback to plain code
    return `<pre><code>${escapeHtml(code)}</code></pre>`;
  }
}

/**
 * Escape HTML entities for fallback rendering
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

// Message handler
self.addEventListener('message', async (event: MessageEvent<HighlightRequest>) => {
  const { id, code, language, theme } = event.data;

  try {
    const html = await highlightCode(code, language, theme);

    const response: HighlightResponse = {
      id,
      html,
    };

    self.postMessage(response);
  } catch (error) {
    const response: HighlightResponse = {
      id,
      html: `<pre><code>${escapeHtml(code)}</code></pre>`,
      error: error instanceof Error ? error.message : 'Unknown error',
    };

    self.postMessage(response);
  }
});

// Initialize immediately
initHighlighter().catch(console.error);

// Export type for TypeScript
export type { HighlightRequest, HighlightResponse };
