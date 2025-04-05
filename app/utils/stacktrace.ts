/**
 * Cleans webcontainer URLs from stack traces to show relative paths instead
 * and enhances with additional context when available
 */
export function cleanStackTrace(stackTrace: string): string {
  if (!stackTrace) {
    return 'No stack trace available';
  }

  // Function to clean a single URL
  const cleanUrl = (url: string): string => {
    const regex = /^https?:\/\/[^\/]+\.webcontainer-api\.io(\/.*)?$/;

    if (!regex.test(url)) {
      return url;
    }

    const pathRegex = /^https?:\/\/[^\/]+\.webcontainer-api\.io\/(.*?)$/;
    const match = url.match(pathRegex);

    // Get relative path
    const relativePath = match?.[1] || '';

    // Format it nicely as a project path
    return relativePath ? `project/${relativePath}` : '';
  };

  // Extract line and column numbers for clearer error location
  const extractLineAndColumn = (line: string): string => {
    const lineColMatch = line.match(/:(\d+):(\d+)/);

    if (lineColMatch) {
      return ` (line ${lineColMatch[1]}, column ${lineColMatch[2]})`;
    }

    return '';
  };

  // Split the stack trace into lines and process each line
  return stackTrace
    .split('\n')
    .map((line) => {
      // Add line/column info
      const lineInfo = extractLineAndColumn(line);

      // Clean WebContainer URLs
      return line.replace(/(https?:\/\/[^\/]+\.webcontainer-api\.io\/[^\s\)]+)/g, (match) => {
        const cleanedUrl = cleanUrl(match);

        return cleanedUrl + lineInfo;
      });
    })
    .join('\n');
}

/**
 * Extract a code snippet from a stack trace if possible
 */
export function extractCodeSnippet(stackTrace: string): string | undefined {
  const lines = stackTrace.split('\n');

  // Look for code snippets that are often included in stack traces
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Some stack traces include the code with a '>' prefix
    if (line.startsWith('> ')) {
      // Try to get a few lines of context if available
      const start = Math.max(0, i - 2);
      const end = Math.min(lines.length, i + 3);

      return lines.slice(start, end).join('\n');
    }
  }

  return undefined;
}

/**
 * Parse error message to extract useful information
 */
export function parseErrorMessage(errorMessage: string): {
  type: string;
  details: string;
  file?: string;
  line?: number;
  column?: number;
} {
  // Default result
  const result = {
    type: 'Error',
    details: errorMessage,
  };

  // Extract error type
  const errorTypeMatch = errorMessage.match(/^(\w+Error):/);

  if (errorTypeMatch) {
    result.type = errorTypeMatch[1];
    result.details = errorMessage.slice(errorTypeMatch[0].length).trim();
  }

  // Extract file, line, and column information
  const fileLineMatch = errorMessage.match(/at\s+(?:\w+\s+)?\(?([^:]+):(\d+)(?::(\d+))?\)?/);

  if (fileLineMatch) {
    return {
      ...result,
      file: fileLineMatch[1],
      line: parseInt(fileLineMatch[2], 10),
      column: fileLineMatch[3] ? parseInt(fileLineMatch[3], 10) : undefined,
    };
  }

  return result;
}
