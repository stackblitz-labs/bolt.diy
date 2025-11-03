/**
 * Preprocesses markdown content to automatically fence code-like content
 * that wasn't properly wrapped in code blocks by the AI
 */

/**
 * Detects if a line looks like code based on common patterns
 */
function looksLikeCode(line: string): boolean {
  const trimmed = line.trim();

  // Empty lines are not code
  if (!trimmed) {
    return false;
  }

  const codePatterns = [
    /^"use (client|server)"/, // Next.js directives
    /^import\s+/, // import statements
    /^export\s+(default\s+)?(function|const|class|interface|type)/, // exports
    /^(const|let|var|function|class|interface|type|enum)\s+/, // declarations
    /^<[A-Z][a-zA-Z0-9]*(\s|>|$)/, // JSX components (capitalized)
    /^<\/[A-Z][a-zA-Z0-9]*>/, // JSX closing tags
    /^<[a-z]+\s+\w+=/, // HTML with attributes
    /^[a-zA-Z0-9_]+\s*[:=]\s*\{/, // object/style assignments
    /^[a-zA-Z0-9_]+\([^)]*\)\s*[{:]/, // function calls/definitions
    /^\s*\/\/|^\s*\/\*|^\s*\*/, // comments
    /^return\s+/, // return statements
    /^}\s*$/, // closing braces
    /^}\)$/, // closing patterns
    /^>$/, // JSX fragment closers
    /^\.[a-zA-Z]+\(/, // method chains (.replace, .map, etc)
    /^if\s*\(/, // if statements
    /^for\s*\(/, // for loops
    /^while\s*\(/, // while loops
    /^else/, // else statements
    /^await\s+/, // await expressions
    /^(async\s+)?function/, // async functions
    /^\w+\s*[+\-*/]=\s*/, // assignment operators
    /^(private|public|protected|static)\s+/, // access modifiers
    /^@\w+/, // decorators
  ];

  return codePatterns.some((pattern) => pattern.test(trimmed));
}

/**
 * More aggressive: if we detect ANY code pattern, wrap everything in a code block
 */
export function autoFenceCodeBlocks(markdown: string): string {
  if (!markdown) {
    return markdown;
  }

  // Don't process if already has complete code blocks
  if (markdown.includes('```')) {
    return markdown;
  }

  const lines = markdown.split('\n');
  let codeLineCount = 0;

  // Count how many lines look like code
  for (const line of lines) {
    if (looksLikeCode(line)) {
      codeLineCount++;
    }
  }

  // If more than 20% of non-empty lines look like code, wrap the whole thing
  const nonEmptyLines = lines.filter((l) => l.trim()).length;
  const codeRatio = nonEmptyLines > 0 ? codeLineCount / nonEmptyLines : 0;

  // Wrap if we detect enough code:
  // - Single line: wrap if it's 100% code
  // - Small blocks (2-9 lines): need 2+ code lines and 20%+ ratio
  // - Larger blocks: need 3+ code lines and 20%+ ratio
  if (nonEmptyLines === 1 && codeLineCount === 1) {
    return '```tsx\n' + markdown + '\n```';
  }

  const minCodeLines = nonEmptyLines < 10 ? 2 : 3;

  if (codeLineCount >= minCodeLines && codeRatio > 0.2) {
    return '```tsx\n' + markdown + '\n```';
  }

  return markdown;
}
