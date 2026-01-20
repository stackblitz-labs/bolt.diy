/**
 * Context File Selection
 *
 * Core function for selecting relevant files based on user queries without
 * making LLM calls. Uses a scoring algorithm that combines:
 * - Core bundle patterns (+10)
 * - Keyword matching (+5)
 * - Recently edited files (+8)
 * - Chat history mentions (+3)
 *
 * @module context/getContextFiles
 */

import { createScopedLogger } from '~/utils/logger';
import type { ContextOptions, ScoredFile } from './types';
import { DEFAULT_BOOST_WEIGHTS, DEFAULT_MAX_FILES } from './types';
import { CORE_PATTERNS, KEYWORD_MAP } from './patterns';

const logger = createScopedLogger('context-selection');

/**
 * Selects relevant files for context based on user message and scoring algorithm.
 *
 * The function applies multiple scoring signals to each file:
 * 1. **Core Bundle** (+10): Files matching CORE_PATTERNS (pages, layout, styles)
 * 2. **Keyword Match** (+5): Files matching keywords from user query
 * 3. **Recently Edited** (+8): Files edited in current chat session
 * 4. **Chat Mention** (+3): Files mentioned by name in chat history
 *
 * Files are sorted by total score (descending) and limited to maxFiles.
 *
 * @param userMessage - The user's query/message to analyze for keywords
 * @param allFiles - Array of all available file paths to consider
 * @param options - Optional configuration for boosts and limits
 * @returns Array of selected file paths, sorted by relevance score
 *
 * @example
 * ```typescript
 * const files = getContextFiles(
 *   'change the header color',
 *   ['/home/project/src/Hero.tsx', '/home/project/src/index.css'],
 *   { recentlyEdited: ['/home/project/src/Hero.tsx'] }
 * );
 * // Returns: ['/home/project/src/Hero.tsx', '/home/project/src/index.css']
 * ```
 */
export function getContextFiles(userMessage: string, allFiles: string[], options: ContextOptions = {}): string[] {
  const startTime = performance.now();
  const { recentlyEdited = [], chatHistory = [], maxFiles = DEFAULT_MAX_FILES } = options;
  const weights = DEFAULT_BOOST_WEIGHTS;

  // Map to track scores and signals for each file
  const scores = new Map<string, ScoredFile>();

  // Helper to add score to a file
  const addScore = (filePath: string, points: number, signal: string) => {
    const existing = scores.get(filePath);

    if (existing) {
      existing.score += points;
      existing.signals?.push(signal);
    } else {
      scores.set(filePath, {
        path: filePath,
        score: points,
        signals: [signal],
      });
    }
  };

  // 1. Score core bundle files (+10)
  for (const file of allFiles) {
    for (const pattern of CORE_PATTERNS) {
      if (file.includes(pattern)) {
        addScore(file, weights.core, 'core');
        break; // Only count core once per file
      }
    }
  }

  // 2. Score keyword matches (+5)
  const queryLower = userMessage.toLowerCase();

  for (const [keyword, patterns] of Object.entries(KEYWORD_MAP)) {
    // Check if keyword appears in user message
    if (queryLower.includes(keyword)) {
      // Find files matching any of the keyword's patterns
      for (const pattern of patterns) {
        for (const file of allFiles) {
          if (file.includes(pattern)) {
            addScore(file, weights.keywordMatch, `keyword:${keyword}`);
          }
        }
      }
    }
  }

  // 3. Score recently edited files (+8)
  for (const editedFile of recentlyEdited) {
    // Check if the edited file exists in allFiles (handle path variations)
    const matchingFile = allFiles.find((f) => f === editedFile || f.endsWith(editedFile) || editedFile.endsWith(f));

    if (matchingFile) {
      addScore(matchingFile, weights.recentlyEdited, 'recentlyEdited');
    }
  }

  // 4. Score files mentioned in chat history (+3)
  if (chatHistory.length > 0) {
    const chatText = chatHistory.join(' ').toLowerCase();

    for (const file of allFiles) {
      // Extract basename without extension for matching
      const basename = file
        .split('/')
        .pop()
        ?.replace(/\.[^.]+$/, '')
        .toLowerCase();

      if (basename && basename.length > 2 && chatText.includes(basename)) {
        addScore(file, weights.chatMention, 'chatMention');
      }
    }
  }

  // Sort by score (descending) and limit to maxFiles
  const sortedFiles = [...scores.values()]
    .filter((f) => f.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxFiles);

  const duration = performance.now() - startTime;

  logger.debug(`Context selection completed`, {
    filesSelected: sortedFiles.length,
    totalFiles: allFiles.length,
    duration: `${duration.toFixed(2)}ms`,
    topFiles: sortedFiles.slice(0, 3).map((f) => ({
      path: f.path.split('/').pop(),
      score: f.score,
      signals: f.signals,
    })),
  });

  return sortedFiles.map((f) => f.path);
}

/**
 * Get detailed scoring information for debugging purposes.
 *
 * @param userMessage - The user's query/message to analyze
 * @param allFiles - Array of all available file paths
 * @param options - Optional configuration
 * @returns Array of ScoredFile objects with full scoring details
 */
export function getContextFilesWithScores(
  userMessage: string,
  allFiles: string[],
  options: ContextOptions = {},
): ScoredFile[] {
  const { recentlyEdited = [], chatHistory = [], maxFiles = DEFAULT_MAX_FILES } = options;
  const weights = DEFAULT_BOOST_WEIGHTS;

  const scores = new Map<string, ScoredFile>();

  const addScore = (filePath: string, points: number, signal: string) => {
    const existing = scores.get(filePath);

    if (existing) {
      existing.score += points;
      existing.signals?.push(signal);
    } else {
      scores.set(filePath, {
        path: filePath,
        score: points,
        signals: [signal],
      });
    }
  };

  // Apply all scoring (same logic as getContextFiles)
  for (const file of allFiles) {
    for (const pattern of CORE_PATTERNS) {
      if (file.includes(pattern)) {
        addScore(file, weights.core, 'core');
        break;
      }
    }
  }

  const queryLower = userMessage.toLowerCase();

  for (const [keyword, patterns] of Object.entries(KEYWORD_MAP)) {
    if (queryLower.includes(keyword)) {
      for (const pattern of patterns) {
        for (const file of allFiles) {
          if (file.includes(pattern)) {
            addScore(file, weights.keywordMatch, `keyword:${keyword}`);
          }
        }
      }
    }
  }

  for (const editedFile of recentlyEdited) {
    const matchingFile = allFiles.find((f) => f === editedFile || f.endsWith(editedFile) || editedFile.endsWith(f));

    if (matchingFile) {
      addScore(matchingFile, weights.recentlyEdited, 'recentlyEdited');
    }
  }

  if (chatHistory.length > 0) {
    const chatText = chatHistory.join(' ').toLowerCase();

    for (const file of allFiles) {
      const basename = file
        .split('/')
        .pop()
        ?.replace(/\.[^.]+$/, '')
        .toLowerCase();

      if (basename && basename.length > 2 && chatText.includes(basename)) {
        addScore(file, weights.chatMention, 'chatMention');
      }
    }
  }

  return [...scores.values()]
    .filter((f) => f.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxFiles);
}
