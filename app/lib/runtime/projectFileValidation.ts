/** Stable revision for exact file concurrency checks without asking the model to copy the whole file. */
export async function getFileRevision(content: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Parse before saving; formatting is discarded so supplied bytes and line breaks stay unchanged. */
export async function assertValidProjectSource(filePath: string, content: string): Promise<void> {
  if (!/\.(?:[cm]?[jt]s|[jt]sx)$/i.test(filePath)) {
    return;
  }

  const typescript = /\.(?:[cm]?ts|tsx)$/i.test(filePath);

  const [{ format }, parser, estree] = await Promise.all([
    import('prettier/standalone'),
    typescript ? import('prettier/plugins/typescript') : import('prettier/plugins/babel'),
    import('prettier/plugins/estree'),
  ]);

  try {
    await format(content, {
      filepath: filePath,
      parser: typescript ? 'typescript' : 'babel',
      plugins: [parser.default, estree.default],
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message.split('\n')[0].slice(0, 300) : 'Invalid syntax';
    throw new Error(
      `Syntax check failed for ${filePath}: ${detail}. File was not saved. Fix the generated code, preserve real line breaks, and retry.`,
    );
  }
}
