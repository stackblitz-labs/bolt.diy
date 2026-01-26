import type { LoaderFunctionArgs } from '~/lib/remix-types';
import { downloadRepository } from '~/lib/replay/Deploy';
import JSZip from 'jszip';
import { diffLines } from 'diff';

interface RepositoryFiles {
  [path: string]: string;
}

async function extractRepositoryFiles(base64Content: string): Promise<RepositoryFiles> {
  try {
    const zip = new JSZip();
    const zipData = atob(base64Content);
    const zipBuffer = new Uint8Array(zipData.length);

    for (let i = 0; i < zipData.length; i++) {
      zipBuffer[i] = zipData.charCodeAt(i);
    }

    const loadedZip = await zip.loadAsync(zipBuffer);
    const files: RepositoryFiles = {};

    for (const [path, file] of Object.entries(loadedZip.files)) {
      if (!file.dir) {
        const content = await file.async('string');
        files[path] = content;
      }
    }

    return files;
  } catch (error) {
    console.error('Error extracting repository:', error);
    return {};
  }
}

function generateUnifiedDiff(oldFiles: RepositoryFiles, newFiles: RepositoryFiles): string {
  const allPathsSet = new Set([...Object.keys(oldFiles), ...Object.keys(newFiles)]);
  const allPaths = [...allPathsSet].sort();

  const diffParts: string[] = [];

  for (const path of allPaths) {
    const oldContent = oldFiles[path];
    const newContent = newFiles[path];

    if (oldContent === newContent) {
      continue; // No changes
    }

    // Generate diff header
    const oldPath = oldContent !== undefined ? `a/${path}` : '/dev/null';
    const newPath = newContent !== undefined ? `b/${path}` : '/dev/null';

    diffParts.push(`diff --git a/${path} b/${path}`);

    if (oldContent === undefined) {
      // New file
      diffParts.push('new file mode 100644');
      diffParts.push(`--- ${oldPath}`);
      diffParts.push(`+++ ${newPath}`);

      const lines = newContent!.split('\n');
      diffParts.push(`@@ -0,0 +1,${lines.length} @@`);

      for (const line of lines) {
        diffParts.push(`+${line}`);
      }
    } else if (newContent === undefined) {
      // Deleted file
      diffParts.push('deleted file mode 100644');
      diffParts.push(`--- ${oldPath}`);
      diffParts.push(`+++ ${newPath}`);

      const lines = oldContent.split('\n');
      diffParts.push(`@@ -1,${lines.length} +0,0 @@`);

      for (const line of lines) {
        diffParts.push(`-${line}`);
      }
    } else {
      // Modified file
      diffParts.push(`--- ${oldPath}`);
      diffParts.push(`+++ ${newPath}`);

      // Generate hunks using diffLines
      const changes = diffLines(oldContent, newContent);

      // Build hunks with context
      const CONTEXT_LINES = 3;
      let oldLineNum = 1;
      let newLineNum = 1;

      interface DiffLine {
        type: 'context' | 'added' | 'removed';
        content: string;
        oldLine?: number;
        newLine?: number;
      }

      const allLines: DiffLine[] = [];

      for (const change of changes) {
        const lines = change.value.split('\n');

        // Remove trailing empty string from split
        if (lines[lines.length - 1] === '') {
          lines.pop();
        }

        for (const line of lines) {
          if (change.added) {
            allLines.push({ type: 'added', content: line, newLine: newLineNum++ });
          } else if (change.removed) {
            allLines.push({ type: 'removed', content: line, oldLine: oldLineNum++ });
          } else {
            allLines.push({
              type: 'context',
              content: line,
              oldLine: oldLineNum++,
              newLine: newLineNum++,
            });
          }
        }
      }

      // Group into hunks
      interface Hunk {
        oldStart: number;
        oldCount: number;
        newStart: number;
        newCount: number;
        lines: DiffLine[];
      }

      const hunks: Hunk[] = [];
      let currentHunk: Hunk | null = null;
      let contextBuffer: DiffLine[] = [];
      let lastChangeIdx = -1;

      for (let i = 0; i < allLines.length; i++) {
        const line = allLines[i];

        if (line.type !== 'context') {
          // Start new hunk if needed
          if (currentHunk === null) {
            const contextStart = Math.max(0, contextBuffer.length - CONTEXT_LINES);
            const leadingContext = contextBuffer.slice(contextStart);

            currentHunk = {
              oldStart: leadingContext[0]?.oldLine || line.oldLine || 1,
              newStart: leadingContext[0]?.newLine || line.newLine || 1,
              oldCount: 0,
              newCount: 0,
              lines: [...leadingContext],
            };
          }

          currentHunk.lines.push(line);
          lastChangeIdx = currentHunk.lines.length - 1;
          contextBuffer = [];
        } else {
          if (currentHunk !== null) {
            const contextSinceLastChange = currentHunk.lines.length - 1 - lastChangeIdx;

            if (contextSinceLastChange < CONTEXT_LINES * 2) {
              currentHunk.lines.push(line);
            } else {
              // Close hunk
              const trimmedLines = currentHunk.lines.slice(0, lastChangeIdx + CONTEXT_LINES + 1);
              currentHunk.lines = trimmedLines;
              currentHunk.oldCount = trimmedLines.filter((l) => l.type !== 'added').length;
              currentHunk.newCount = trimmedLines.filter((l) => l.type !== 'removed').length;
              hunks.push(currentHunk);
              currentHunk = null;
              contextBuffer = [line];
            }
          } else {
            contextBuffer.push(line);
          }
        }
      }

      // Close final hunk
      if (currentHunk !== null) {
        currentHunk.oldCount = currentHunk.lines.filter((l) => l.type !== 'added').length;
        currentHunk.newCount = currentHunk.lines.filter((l) => l.type !== 'removed').length;
        hunks.push(currentHunk);
      }

      // Output hunks
      for (const hunk of hunks) {
        diffParts.push(`@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@`);

        for (const line of hunk.lines) {
          if (line.type === 'added') {
            diffParts.push(`+${line.content}`);
          } else if (line.type === 'removed') {
            diffParts.push(`-${line.content}`);
          } else {
            diffParts.push(` ${line.content}`);
          }
        }
      }
    }

    diffParts.push(''); // Empty line between files
  }

  return diffParts.join('\n');
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const oldRepositoryId = url.searchParams.get('old');
  const newRepositoryId = url.searchParams.get('new');

  if (!oldRepositoryId || !newRepositoryId) {
    return new Response('Missing required parameters: old and new repository IDs', {
      status: 400,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  try {
    const [oldRepositoryContents, newRepositoryContents] = await Promise.all([
      downloadRepository(oldRepositoryId),
      downloadRepository(newRepositoryId),
    ]);

    const [oldFiles, newFiles] = await Promise.all([
      extractRepositoryFiles(oldRepositoryContents),
      extractRepositoryFiles(newRepositoryContents),
    ]);

    const diff = generateUnifiedDiff(oldFiles, newFiles);

    return new Response(diff, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `inline; filename="diff-${oldRepositoryId.slice(0, 8)}-${newRepositoryId.slice(0, 8)}.diff"`,
      },
    });
  } catch (error) {
    console.error('Error generating diff:', error);
    return new Response(`Error generating diff: ${error instanceof Error ? error.message : 'Unknown error'}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
};
