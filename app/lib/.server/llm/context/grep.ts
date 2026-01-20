/**
 * Grep Fallback for Specific Text Search
 *
 * Provides file content search for specific text patterns mentioned in user queries.
 * Extracts quoted strings, prices ($XX.XX), and hex colors (#XXXXXX) from user messages
 * and searches file contents for matches.
 *
 * @module context/grep
 */

import type { FileMap, File } from '~/lib/.server/llm/constants';

/**
 * Regular expression pattern for extracting searchable text from user messages.
 *
 * Matches:
 * - Quoted strings (single or double quotes): "hello" or 'world'
 * - Hex colors (3-6 digits): #fff, #21C6FF
 * - Prices with optional cents: $14, $14.99, $1234.56
 */
const PATTERN_REGEX = /["']([^"']+)["']|#[0-9A-Fa-f]{3,6}|\$\d+(?:\.\d{2})?/g;

/**
 * Extracts searchable patterns from a user message.
 *
 * @param userMessage - The user's query/message to analyze
 * @returns Array of unique patterns found in the message
 *
 * @example
 * ```typescript
 * extractPatterns('change "$14" to "$16"');
 * // Returns: ['$14', '$16']
 *
 * extractPatterns('update the color to #21C6FF');
 * // Returns: ['#21C6FF']
 *
 * extractPatterns('change "Open 9am-10pm" text');
 * // Returns: ['Open 9am-10pm']
 * ```
 */
export function extractPatterns(userMessage: string): string[] {
  const matches = userMessage.match(PATTERN_REGEX);

  if (!matches) {
    return [];
  }

  // Extract content from quoted strings (remove quotes)
  const patterns = matches.map((match) => {
    // If it's a quoted string, extract the content
    if ((match.startsWith('"') && match.endsWith('"')) || (match.startsWith("'") && match.endsWith("'"))) {
      return match.slice(1, -1);
    }

    return match;
  });

  // Return unique patterns
  return [...new Set(patterns)];
}

/**
 * Searches file contents for specific text patterns mentioned in user message.
 *
 * Extracts quoted strings, prices ($XX.XX), and hex colors (#XXXXXX) from the user
 * message, then searches through all file contents for matches. Files containing
 * any of the patterns are returned.
 *
 * @param userMessage - The user's query/message to analyze for patterns
 * @param files - FileMap containing all project files with their contents
 * @returns Array of unique file paths that contain matched patterns
 *
 * @example
 * ```typescript
 * const files: FileMap = {
 *   '/home/project/src/data/menu.json': {
 *     type: 'file',
 *     content: '{ "price": "$14.99" }',
 *     isBinary: false
 *   }
 * };
 *
 * grepForSpecificText('change "$14.99" to "$16.99"', files);
 * // Returns: ['/home/project/src/data/menu.json']
 * ```
 */
export function grepForSpecificText(userMessage: string, files: FileMap): string[] {
  const patterns = extractPatterns(userMessage);

  if (patterns.length === 0) {
    return [];
  }

  const matchingPaths: Set<string> = new Set();

  for (const [path, entry] of Object.entries(files)) {
    // Skip non-file entries (folders) and undefined entries
    if (!entry || entry.type !== 'file') {
      continue;
    }

    const file = entry as File;

    // Skip binary files
    if (file.isBinary) {
      continue;
    }

    // Check if file content contains any of the patterns
    for (const pattern of patterns) {
      if (file.content.includes(pattern)) {
        matchingPaths.add(path);
        break; // Found a match, no need to check other patterns for this file
      }
    }
  }

  return [...matchingPaths];
}
