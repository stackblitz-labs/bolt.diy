/**
 * Context Selection Module
 *
 * Provides hybrid context selection for restaurant websites without LLM calls.
 * Uses core bundle patterns, keyword matching, and boost scoring to select
 * relevant files for editing.
 *
 * @module context
 */

// Types and constants
export type { ContextOptions, ScoredFile, BoostWeights } from './types';
export { DEFAULT_BOOST_WEIGHTS, DEFAULT_MAX_FILES, MIN_MAX_FILES, MAX_MAX_FILES } from './types';

// Patterns and keyword mappings
export { CORE_PATTERNS, KEYWORD_MAP } from './patterns';
export type { KeywordKey } from './patterns';

// Core selection function
export { getContextFiles, getContextFilesWithScores } from './getContextFiles';

// Grep fallback function for specific text search
export { grepForSpecificText, extractPatterns } from './grep';
