import { createTwoFilesPatch } from 'diff';
import type { FileMap } from '~/lib/stores/files';
import { MODIFICATIONS_TAG_NAME, WORK_DIR } from './constants';

export const modificationsRegex = new RegExp(
  `^<${MODIFICATIONS_TAG_NAME}>[\\s\\S]*?<\\/${MODIFICATIONS_TAG_NAME}>\\s+`,
  'g',
);

interface ModifiedFile {
  type: 'diff' | 'file';
  content: string;
}

type FileModifications = Record<string, ModifiedFile>;

export function computeFileModifications(files: FileMap, modifiedFiles: Map<string, string>) {
  const modifications: FileModifications = {};

  let hasModifiedFiles = false;

  for (const [filePath, originalContent] of modifiedFiles) {
    const file = files[filePath];

    if (file?.type !== 'file') {
      continue;
    }

    const unifiedDiff = diffFiles(filePath, originalContent, file.content);

    if (!unifiedDiff) {
      // files are identical
      continue;
    }

    hasModifiedFiles = true;

    if (unifiedDiff.length > file.content.length) {
      // if there are lots of changes we simply grab the current file content since it's smaller than the diff
      modifications[filePath] = { type: 'file', content: file.content };
    } else {
      // otherwise we use the diff since it's smaller
      modifications[filePath] = { type: 'diff', content: unifiedDiff };
    }
  }

  if (!hasModifiedFiles) {
    return undefined;
  }

  return modifications;
}

/**
 * Computes a diff in the unified format. The only difference is that the header is omitted
 * because it will always assume that you're comparing two versions of the same file and
 * it allows us to avoid the extra characters we send back to the llm.
 *
 * @see https://www.gnu.org/software/diffutils/manual/html_node/Unified-Format.html
 */
export function diffFiles(fileName: string, oldFileContent: string, newFileContent: string) {
  let unifiedDiff = createTwoFilesPatch(fileName, fileName, oldFileContent, newFileContent);

  const patchHeaderEnd = `--- ${fileName}\n+++ ${fileName}\n`;
  const headerEndIndex = unifiedDiff.indexOf(patchHeaderEnd);

  if (headerEndIndex >= 0) {
    unifiedDiff = unifiedDiff.slice(headerEndIndex + patchHeaderEnd.length);
  }

  if (unifiedDiff === '') {
    return undefined;
  }

  return unifiedDiff;
}

const regex = new RegExp(`^${WORK_DIR}\/`);

/**
 * Strips out the work directory from the file path.
 */
export function extractRelativePath(filePath: string) {
  return filePath.replace(regex, '');
}

/**
 * Converts the unified diff to HTML.
 *
 * Example:
 *
 * ```html
 * <bolt_file_modifications>
 * <diff path="/home/project/index.js">
 * - console.log('Hello, World!');
 * + console.log('Hello, Bolt!');
 * </diff>
 * </bolt_file_modifications>
 * ```
 */
export function fileModificationsToHTML(modifications: FileModifications) {
  const entries = Object.entries(modifications);

  if (entries.length === 0) {
    return undefined;
  }

  const result: string[] = [`<${MODIFICATIONS_TAG_NAME}>`];

  for (const [filePath, { type, content }] of entries) {
    result.push(`<${type} path=${JSON.stringify(filePath)}>`, content, `</${type}>`);
  }

  result.push(`</${MODIFICATIONS_TAG_NAME}>`);

  return result.join('\n');
}

/**
 * Applies a unified diff patch to the original content.
 * Robust implementation that handles various diff formats and context mismatches gracefully.
 *
 * @param originalContent - The original file content
 * @param diffContent - The unified diff content
 * @returns The modified content
 */
export function applyPatch(originalContent: string, diffContent: string): string {
  try {
    const originalLines = originalContent.split('\n');
    const diffLines = diffContent.split('\n');
    const result: string[] = [];

    let originalIndex = 0;
    let diffIndex = 0;

    while (diffIndex < diffLines.length) {
      const diffLine = diffLines[diffIndex];

      // Skip empty lines
      if (!diffLine.trim()) {
        diffIndex++;
        continue;
      }

      /*
       * Parse the hunk header - support both formats:
       * 1. @@ -line,count +line,count @@ (with line numbers)
       * 2. @@ .. @@ (without line numbers, as mentioned in prompt)
       */
      const hunkMatch = diffLine.match(/^@@ -(\d+),?(\d+)? \+(\d+),?(\d+)? @@/) || diffLine.match(/^@@ \.\. @@/);

      if (hunkMatch) {
        let oldStart = 0;
        let oldCount = 0;
        let newCount = 0;

        // If we have line numbers, use them; otherwise, start from current position
        if (hunkMatch[1] && hunkMatch[3]) {
          oldStart = parseInt(hunkMatch[1], 10);
          oldCount = parseInt(hunkMatch[2] || '1', 10);
          newCount = parseInt(hunkMatch[4] || '1', 10);

          // Add all lines before this hunk (unchanged)
          while (originalIndex < oldStart - 1) {
            if (originalIndex < originalLines.length) {
              result.push(originalLines[originalIndex]);
            }

            originalIndex++;
          }
        }

        diffIndex++;

        // Process the hunk content
        let addedLines = 0;
        let removedLines = 0;

        while (diffIndex < diffLines.length) {
          const line = diffLines[diffIndex];

          // Check if we've reached the next hunk
          if (
            line.startsWith('@@') &&
            (line.match(/^@@ -(\d+),?(\d+)? \+(\d+),?(\d+)? @@/) || line.match(/^@@ \.\. @@/))
          ) {
            break;
          }

          if (line.startsWith(' ')) {
            // Context line - should match the original at this position
            if (originalIndex < originalLines.length) {
              const expectedLine = line.slice(1);
              const actualLine = originalLines[originalIndex];

              // Verify the context line matches (with flexibility for whitespace)
              if (actualLine === expectedLine || actualLine.trim() === expectedLine.trim()) {
                result.push(originalLines[originalIndex]);
                originalIndex++;
              } else {
                // Context mismatch - try to find the line nearby
                let found = false;
                const searchRange = 5; // Look within 5 lines

                for (
                  let i = Math.max(0, originalIndex - searchRange);
                  i < Math.min(originalLines.length, originalIndex + searchRange);
                  i++
                ) {
                  if (originalLines[i] === expectedLine || originalLines[i].trim() === expectedLine.trim()) {
                    // Found the context line nearby, add skipped lines and continue
                    while (originalIndex < i) {
                      result.push(originalLines[originalIndex]);
                      originalIndex++;
                    }
                    result.push(originalLines[originalIndex]);
                    originalIndex++;
                    found = true;
                    break;
                  }
                }

                if (!found) {
                  /*
                   * If we can't find the context, just add the original line and continue
                   * This prevents the patch from failing due to minor mismatches
                   */
                  result.push(originalLines[originalIndex]);
                  originalIndex++;
                }
              }
            } else {
              // We've reached the end of the original file
              console.warn('Reached end of file while processing context');
            }
          } else if (line.startsWith('-')) {
            // Remove line - should match the original at this position
            if (originalIndex < originalLines.length) {
              const expectedLine = line.slice(1);
              const actualLine = originalLines[originalIndex];

              // Verify the line to remove matches (with flexibility for whitespace)
              if (actualLine === expectedLine || actualLine.trim() === expectedLine.trim()) {
                originalIndex++; // Skip this line (remove it)
                removedLines++;
              } else {
                // Line doesn't match exactly - try to find it nearby
                let found = false;
                const searchRange = 5; // Look within 5 lines

                for (
                  let i = Math.max(0, originalIndex - searchRange);
                  i < Math.min(originalLines.length, originalIndex + searchRange);
                  i++
                ) {
                  if (originalLines[i] === expectedLine || originalLines[i].trim() === expectedLine.trim()) {
                    // Found the line to remove nearby, add skipped lines and skip the target
                    while (originalIndex < i) {
                      result.push(originalLines[originalIndex]);
                      originalIndex++;
                    }
                    originalIndex++; // Skip the line to remove
                    removedLines++;
                    found = true;
                    break;
                  }
                }

                if (!found) {
                  /*
                   * If we can't find the line to remove, just skip it and continue
                   * This prevents the patch from failing due to minor mismatches
                   */
                  console.warn('Line to remove not found, skipping', {
                    expected: expectedLine,
                    lineNumber: originalIndex + 1,
                  });
                }
              }
            } else {
              // We've reached the end of the original file
              console.warn('Reached end of file while processing deletion');
            }
          } else if (line.startsWith('+')) {
            // Add line - always add it
            result.push(line.slice(1));
            addedLines++;
          }

          diffIndex++;
        }

        // Log statistics for debugging but don't fail
        if (oldCount > 0 && (Math.abs(removedLines - oldCount) > 2 || Math.abs(addedLines - newCount) > 2)) {
          console.warn('Hunk statistics mismatch (continuing anyway)', {
            removedLines,
            oldCount,
            addedLines,
            newCount,
            hunkHeader: diffLine,
          });
        }

        continue;
      }

      // If we reach here, it's not a hunk header - skip it
      diffIndex++;
    }

    // Add remaining original lines
    while (originalIndex < originalLines.length) {
      result.push(originalLines[originalIndex]);
      originalIndex++;
    }

    return result.join('\n');
  } catch (error) {
    console.error('Failed to apply patch:', error);

    // Return the original content if patch application fails
    return originalContent;
  }
}
