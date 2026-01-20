/**
 * Context Selection Types
 *
 * Types and interfaces for the hybrid context selection system that replaces
 * LLM-based file selection with a local, deterministic scoring algorithm.
 *
 * @module context/types
 */

/**
 * Configuration options for the context selection function.
 *
 * @example
 * ```typescript
 * const options: ContextOptions = {
 *   recentlyEdited: ['/home/project/src/components/Hero.tsx'],
 *   chatHistory: ['change the hero section', 'make it bolder'],
 *   maxFiles: 12
 * };
 * ```
 */
export interface ContextOptions {
  /**
   * File paths that were edited in the current chat session.
   * These files receive a +8 boost score to prioritize follow-up edits.
   * Paths should be absolute (e.g., '/home/project/src/components/Hero.tsx').
   */
  recentlyEdited?: string[];

  /**
   * Previous user messages from the chat history.
   * Used for detecting file mentions to apply +3 boost.
   * Should be plain text content (not including system/assistant messages).
   */
  chatHistory?: string[];

  /**
   * Maximum number of files to return.
   * Must be between 1 and 30.
   * @default 12
   */
  maxFiles?: number;
}

/**
 * Internal representation of a file with its computed relevance score.
 * Used for debugging and understanding why files were selected.
 *
 * @example
 * ```typescript
 * const scored: ScoredFile = {
 *   path: '/home/project/src/components/Hero.tsx',
 *   score: 23,
 *   signals: ['core', 'keyword:hero', 'recentlyEdited']
 * };
 * ```
 */
export interface ScoredFile {
  /** Absolute file path */
  path: string;

  /** Computed relevance score (sum of all applicable boosts) */
  score: number;

  /**
   * Debug information: which signals contributed to the score.
   * Possible values: 'core', 'keyword:{keyword}', 'recentlyEdited', 'grepMatch', 'chatMention'
   */
  signals?: string[];
}

/**
 * Configurable weights for different scoring signals.
 * Higher weights indicate stronger relevance signals.
 *
 * @example
 * ```typescript
 * const weights: BoostWeights = {
 *   core: 10,        // Always-included files
 *   recentlyEdited: 8, // Files edited in session
 *   keywordMatch: 5,   // Keyword-based selection
 *   grepMatch: 5,      // Specific text found
 *   chatMention: 3     // File mentioned in chat
 * };
 * ```
 */
export interface BoostWeights {
  /** Boost for files matching core bundle patterns (pages, layout, styles) */
  core: number;

  /** Boost for files edited in the current chat session */
  recentlyEdited: number;

  /** Boost for files matching keywords from user query */
  keywordMatch: number;

  /** Boost for files containing specific text (prices, colors, quoted strings) */
  grepMatch: number;

  /** Boost for files mentioned by name in chat history */
  chatMention: number;
}

/**
 * Default boost weights based on research findings.
 *
 * - Core: +10 (highest - ensures base context is always available)
 * - Recently Edited: +8 (high - prioritizes follow-up edits)
 * - Keyword Match: +5 (moderate - good signal but not definitive)
 * - Grep Match: +5 (moderate - specific text found)
 * - Chat Mention: +3 (lower - less confident signal)
 */
export const DEFAULT_BOOST_WEIGHTS: BoostWeights = {
  core: 10,
  recentlyEdited: 8,
  keywordMatch: 5,
  grepMatch: 5,
  chatMention: 3,
};

/**
 * Default maximum number of files to return from context selection.
 * Based on clarification: 10-15 files covers most edit scenarios.
 */
export const DEFAULT_MAX_FILES = 12;

/**
 * Minimum valid value for maxFiles option.
 */
export const MIN_MAX_FILES = 1;

/**
 * Maximum valid value for maxFiles option.
 */
export const MAX_MAX_FILES = 30;
