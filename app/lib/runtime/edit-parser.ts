import type Parser from 'web-tree-sitter';
import { ENABLE_AST_MATCHING } from './ast-context';

export interface EditBlock {
  filePath: string;
  searchContent: string;
  replaceContent: string;
  lineNumber?: number;
}

export interface ParseResult {
  blocks: EditBlock[];
  errors: string[];
}

export interface EditApplyResult {
  success: boolean;
  newContent: string;
  strategy: 'exact' | 'normalized' | 'fuzzy' | 'failed';
  error?: string;
}

/**
 * Parse raw SEARCH/REPLACE content into structured edit blocks.
 * Expected format:
 * path/to/file.tsx
 * <<<<<<< SEARCH
 * existing code
 * =======
 * replacement code
 * >>>>>>> REPLACE
 */
export function parseEditBlocks(raw: string): ParseResult {
  const blocks: EditBlock[] = [];
  const errors: string[] = [];
  const lines = raw.replace(/\r\n/g, '\n').split('\n');

  const looksLikeFilePath = (line: string) => {
    const trimmed = line.trim();
    return /^[./\w-]+\.[A-Za-z0-9]+$/.test(trimmed);
  };

  let i = 0;

  while (i < lines.length) {
    while (i < lines.length && !lines[i].trim()) {
      i++;
    }

    if (i >= lines.length) {
      break;
    }

    const potentialPath = lines[i].trim();
    const nextLine = lines[i + 1]?.trim();

    if (!potentialPath || !nextLine?.startsWith('<<<<<<< SEARCH')) {
      i++;
      continue;
    }

    const filePath = ensureLeadingSlash(potentialPath);
    const searchStart = i + 2;
    let dividerIndex = -1;
    let replaceEnd = -1;

    for (let j = searchStart; j < lines.length; j++) {
      if (lines[j].trim().startsWith('=======')) {
        dividerIndex = j;
        break;
      }
    }

    if (dividerIndex === -1) {
      errors.push(`Missing ======= divider for block at line ${i + 1}`);
      i++;
      continue;
    }

    for (let j = dividerIndex + 1; j < lines.length; j++) {
      const line = lines[j].trim();

      if (line.startsWith('>>>>>>> REPLACE')) {
        replaceEnd = j;
        break;
      }

      // If we hit a new search marker or a file header before REPLACE, treat as malformed
      if (line.startsWith('<<<<<<< SEARCH') || looksLikeFilePath(line)) {
        break;
      }
    }

    if (replaceEnd === -1) {
      errors.push(`Missing >>>>>>> REPLACE for block at line ${i + 1}`);
      i = dividerIndex + 1;
      continue;
    }

    const searchContent = lines.slice(searchStart, dividerIndex).join('\n');
    const replaceContent = lines.slice(dividerIndex + 1, replaceEnd).join('\n');

    blocks.push({
      filePath,
      searchContent,
      replaceContent,
      lineNumber: i + 1,
    });

    i = replaceEnd + 1;
  }

  return { blocks, errors };
}

/**
 * Apply a single edit block using a multi-strategy match (exact → normalized → AST → fuzzy).
 */
export function applyEdit(fileContent: string, edit: EditBlock, tree?: Parser.Tree | null): EditApplyResult {
  if (edit.searchContent.trim() === '') {
    return {
      success: true,
      newContent: edit.replaceContent,
      strategy: 'exact',
    };
  }

  if (fileContent.includes(edit.searchContent)) {
    return {
      success: true,
      newContent: fileContent.replace(edit.searchContent, edit.replaceContent),
      strategy: 'exact',
    };
  }

  const normalizedResult = normalizedReplace(fileContent, edit);

  if (normalizedResult) {
    return {
      success: true,
      newContent: normalizedResult,
      strategy: 'normalized',
    };
  }

  if (ENABLE_AST_MATCHING && tree) {
    const astResult = astAwareReplace(fileContent, edit, tree);

    if (astResult) {
      return {
        success: true,
        newContent: astResult,
        strategy: 'normalized',
      };
    }
  }

  const fuzzyResult = fuzzyReplace(fileContent, edit);

  if (fuzzyResult) {
    return {
      success: true,
      newContent: fuzzyResult,
      strategy: 'fuzzy',
    };
  }

  return {
    success: false,
    newContent: fileContent,
    strategy: 'failed',
    error: 'Could not find matching code in file',
  };
}

function normalizedReplace(content: string, edit: EditBlock): string | null {
  const normalize = (value: string) =>
    value
      .split('\n')
      .map((line) => line.trimEnd())
      .join('\n');

  const normalizedFile = normalize(content);
  const normalizedSearch = normalize(edit.searchContent);

  if (!normalizedFile.includes(normalizedSearch)) {
    return null;
  }

  const searchLines = edit.searchContent.split('\n');
  const fileLines = content.split('\n');

  for (let i = 0; i <= fileLines.length - searchLines.length; i++) {
    let match = true;

    for (let j = 0; j < searchLines.length; j++) {
      if (fileLines[i + j].trimEnd() !== searchLines[j].trimEnd()) {
        match = false;
        break;
      }
    }

    if (match) {
      const originalIndent = fileLines[i].match(/^(\s*)/)?.[1] ?? '';
      const searchIndent = searchLines[0].match(/^(\s*)/)?.[1] ?? '';

      const adjustedReplace = edit.replaceContent.split('\n').map((line, idx) => {
        if (idx === 0) {
          return originalIndent + line.trimStart();
        }

        const lineIndent = line.match(/^(\s*)/)?.[1] ?? '';
        const relativeIndent = Math.max(0, lineIndent.length - searchIndent.length);

        return originalIndent + ' '.repeat(relativeIndent) + line.trimStart();
      });

      const newLines = [...fileLines.slice(0, i), ...adjustedReplace, ...fileLines.slice(i + searchLines.length)];

      return newLines.join('\n');
    }
  }

  return null;
}

function fuzzyReplace(content: string, edit: EditBlock, threshold: number = 0.85): string | null {
  const searchLines = edit.searchContent.split('\n');
  const fileLines = content.split('\n');

  if (searchLines.length === 0) {
    return null;
  }

  let bestMatch = { index: -1, similarity: 0 };

  for (let i = 0; i <= fileLines.length - searchLines.length; i++) {
    const windowLines = fileLines.slice(i, i + searchLines.length);
    const similarity = calculateSimilarity(windowLines.join('\n'), edit.searchContent);

    if (similarity > bestMatch.similarity) {
      bestMatch = { index: i, similarity };
    }
  }

  if (bestMatch.index === -1 || bestMatch.similarity < threshold) {
    return null;
  }

  let matchCount = 0;

  for (let i = 0; i <= fileLines.length - searchLines.length; i++) {
    const windowLines = fileLines.slice(i, i + searchLines.length);
    const similarity = calculateSimilarity(windowLines.join('\n'), edit.searchContent);

    if (similarity >= threshold) {
      matchCount++;
    }
  }

  if (matchCount > 1) {
    return null;
  }

  const newLines = [
    ...fileLines.slice(0, bestMatch.index),
    ...edit.replaceContent.split('\n'),
    ...fileLines.slice(bestMatch.index + searchLines.length),
  ];

  return newLines.join('\n');
}

function calculateSimilarity(a: string, b: string): number {
  const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim();

  const na = normalize(a);
  const nb = normalize(b);

  if (na === nb) {
    return 1;
  }

  if (!na.length || !nb.length) {
    return 0;
  }

  const longer = na.length >= nb.length ? na : nb;
  const shorter = na.length >= nb.length ? nb : na;

  let matches = 0;

  for (let i = 0; i < shorter.length; i++) {
    if (shorter[i] === longer[i]) {
      matches++;
    }
  }

  return matches / longer.length;
}

function astAwareReplace(content: string, edit: EditBlock, tree: Parser.Tree): string | null {
  const searchLines = edit.searchContent.split('\n');
  const stack: Parser.SyntaxNode[] = [tree.rootNode];

  while (stack.length > 0) {
    const node = stack.pop()!;
    const snippet = content.slice(node.startIndex, node.endIndex);
    const span = findNormalizedSpan(snippet, searchLines);

    if (span) {
      const matched = snippet.slice(span.startIndex, span.endIndex);
      const replacement = applyIndentationFromMatch(matched, edit.replaceContent, edit.searchContent);
      const absoluteStart = node.startIndex + span.startIndex;
      const absoluteEnd = node.startIndex + span.endIndex;

      return content.slice(0, absoluteStart) + replacement + content.slice(absoluteEnd);
    }

    for (let i = 0; i < node.namedChildCount; i++) {
      const child = node.namedChild(i);

      if (child) {
        stack.push(child);
      }
    }
  }

  return null;
}

function findNormalizedSpan(snippet: string, searchLines: string[]): { startIndex: number; endIndex: number } | null {
  const snippetLines = snippet.split('\n');

  if (searchLines.length === 0) {
    return null;
  }

  const prefixLengths: number[] = [];
  let running = 0;

  for (const line of snippetLines) {
    prefixLengths.push(running);
    running += line.length + 1; // include newline
  }

  for (let i = 0; i <= snippetLines.length - searchLines.length; i++) {
    let match = true;

    for (let j = 0; j < searchLines.length; j++) {
      if (snippetLines[i + j].trimEnd() !== searchLines[j].trimEnd()) {
        match = false;
        break;
      }
    }

    if (match) {
      const startIndex = prefixLengths[i];
      const endLine = i + searchLines.length - 1;
      const endIndex = prefixLengths[endLine] + snippetLines[endLine].length + (searchLines.length > 1 ? 1 : 0);

      return { startIndex, endIndex };
    }
  }

  return null;
}

function applyIndentationFromMatch(matchText: string, replaceContent: string, searchContent: string): string {
  const matchLines = matchText.split('\n');
  const searchLines = searchContent.split('\n');
  const originalIndent = matchLines[0].match(/^(\s*)/)?.[1] ?? '';
  const searchIndent = searchLines[0].match(/^(\s*)/)?.[1] ?? '';

  const replaceLines = replaceContent.split('\n').map((line, idx) => {
    if (idx === 0) {
      return originalIndent + line.trimStart();
    }

    const lineIndent = line.match(/^(\s*)/)?.[1] ?? '';
    const relativeIndent = Math.max(0, lineIndent.length - searchIndent.length);

    return originalIndent + ' '.repeat(relativeIndent) + line.trimStart();
  });

  return replaceLines.join('\n');
}

export function sortEditsForApplication(edits: EditBlock[], fileContent: string): EditBlock[] {
  const editsWithPosition = edits.map((edit) => {
    const index = fileContent.indexOf(edit.searchContent);
    const lineNumber = index === -1 ? Infinity : fileContent.slice(0, index).split('\n').length;

    return { edit, lineNumber };
  });

  editsWithPosition.sort((a, b) => b.lineNumber - a.lineNumber);

  return editsWithPosition.map((entry) => entry.edit);
}

export function groupEditsByFile(blocks: EditBlock[]): Map<string, EditBlock[]> {
  const map = new Map<string, EditBlock[]>();

  for (const block of blocks) {
    const existing = map.get(block.filePath) ?? [];
    existing.push(block);
    map.set(block.filePath, existing);
  }

  return map;
}

function ensureLeadingSlash(filePath: string): string {
  return filePath.startsWith('/') ? filePath : `/${filePath}`;
}
