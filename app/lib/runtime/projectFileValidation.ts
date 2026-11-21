/** Stable revision for exact file concurrency checks without asking the model to copy the whole file. */
export async function getFileRevision(content: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Prepare generated source for saving. The parser's formatted output is discarded. */
export async function validateProjectSource(
  filePath: string,
  content: string,
  { repairJsxMap = false } = {},
): Promise<{ content: string; sourceRepair?: string }> {
  if (!/\.(?:[cm]?[jt]s|[jt]sx)$/i.test(filePath)) {
    return { content };
  }

  const typescript = /\.(?:[cm]?ts|tsx)$/i.test(filePath);

  const [{ format }, parser, estree] = await Promise.all([
    import('prettier/standalone'),
    typescript ? import('prettier/plugins/typescript') : import('prettier/plugins/babel'),
    import('prettier/plugins/estree'),
  ]);

  const parse = (source: string) =>
    format(source, {
      filepath: filePath,
      parser: typescript ? 'typescript' : 'babel',
      plugins: [parser.default, estree.default],
    });

  try {
    await parse(content);

    return { content };
  } catch (error) {
    const corrected = /\.tsx$/i.test(filePath) ? fixEarlyJsxMapBrace(content, error) : undefined;

    if (corrected && repairJsxMap) {
      try {
        await parse(corrected);

        return {
          content: corrected,
          sourceRepair: 'Kept the typed array and its .map() call inside the JSX expression.',
        };
      } catch {
        // A repair is only applied if the entire corrected file parses.
      }
    }

    const detail = error instanceof Error ? error.message.split('\n')[0].slice(0, 300) : 'Invalid syntax';

    const flattened =
      !/[\r\n]/.test(content.trim()) &&
      /^\s*import[ \t].*?[ \t]from[ \t]+['"][^'"]+['"][ \t]+(?:import|export|type|interface|const|let|function|class)\b/.test(
        content,
      );
    const hint = corrected
      ? 'Keep the whole .map() inside the JSX expression, as in {([... ] as const).map(item => ...)}.'
      : flattened
        ? 'The source arrived on one line with missing statement separators. Resend complete code with real line breaks between imports and declarations. If a long response is cut off, split it into smaller complete modules.'
        : 'Fix the generated code, preserve real line breaks, and retry.';
    throw new Error(`Syntax check failed for ${filePath}: ${detail}. File was not saved. ${hint}`);
  }
}

function fixEarlyJsxMapBrace(content: string, error: unknown): string | undefined {
  if (!(error instanceof SyntaxError) || !error.message.includes("Did you mean `{'>'}` or `&gt;`?")) {
    return undefined;
  }

  const location = (error as SyntaxError & { loc?: { start?: { line: number; column: number } } }).loc?.start;

  if (!location) {
    return undefined;
  }

  const lines = content.split(/(?<=\n)/);
  const lineIndex = location.line - 1;
  const arrowLine = lines[lineIndex];

  if (!arrowLine || arrowLine[location.column - 1] !== '>') {
    return undefined;
  }

  const arrowPrefix = arrowLine.slice(0, location.column);
  const start = arrowPrefix.trimStart().startsWith('{[') ? lineIndex : lineIndex - 1;
  const prefix = (start === lineIndex ? '' : (lines[start] ?? '')) + arrowPrefix;

  const match =
    /^([ \t]*\{)(\[[^\r\n]*\][ \t]+as[ \t]+const)\}(\.map\([ \t]*(?:\r?\n[ \t]*)?\([^()\r\n]*\)[ \t]*=>)$/.exec(prefix);

  if (!match) {
    return undefined;
  }

  const [, opening, receiver, callback] = match;
  lines.splice(start, lineIndex - start + 1, `${opening}(${receiver})${callback}${arrowLine.slice(location.column)}`);

  return lines.join('');
}
