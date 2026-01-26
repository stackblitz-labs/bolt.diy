import { useSearchParams } from '@remix-run/react';
import { downloadRepository } from '~/lib/replay/Deploy';
import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import JSZip from 'jszip';
import { diffLines } from 'diff';
import type { Change } from 'diff';
import { EditorView, minimalSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { unifiedMergeView } from '@codemirror/merge';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { python } from '@codemirror/lang-python';
import { codeToTokens, type BundledLanguage, type ThemedToken } from 'shiki';
import {
  PlusCircle,
  MinusCircle,
  PenSquare,
  File,
  GitCompareArrows,
  GitBranch,
  AlertTriangle,
  Files,
  CheckCircle,
  ChevronDown,
  Eye,
  Code,
} from '~/components/ui/Icon';
import { Markdown } from '~/components/chat/Markdown';

interface FileDiff {
  path: string;
  type: 'added' | 'modified' | 'deleted';
  oldContent?: string;
  newContent?: string;
  hunks: Hunk[];
}

interface Hunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: HunkLine[];
  hiddenLinesBefore?: number;
}

interface HunkLine {
  type: 'context' | 'added' | 'removed';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

interface RepositoryFiles {
  [path: string]: string;
}

const CONTEXT_LINES = 3;

// Get Shiki language from file extension
function getShikiLanguage(filePath: string): BundledLanguage | null {
  const ext = filePath.split('.').pop()?.toLowerCase();
  const langMap: Record<string, BundledLanguage> = {
    js: 'javascript',
    jsx: 'jsx',
    ts: 'typescript',
    tsx: 'tsx',
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'scss',
    sass: 'sass',
    json: 'json',
    md: 'markdown',
    markdown: 'markdown',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    h: 'c',
    hpp: 'cpp',
    swift: 'swift',
    kt: 'kotlin',
    php: 'php',
    sql: 'sql',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    yaml: 'yaml',
    yml: 'yaml',
    xml: 'xml',
    svg: 'xml',
    vue: 'vue',
    svelte: 'svelte',
  };
  return ext && ext in langMap ? langMap[ext] : null;
}

// Highlighted tokens per line for light and dark themes
interface HighlightedLine {
  light: ThemedToken[];
  dark: ThemedToken[];
}

// Hook to highlight code with Shiki (both light and dark themes)
function useHighlightedCode(code: string | undefined, filePath: string): Map<number, HighlightedLine> | null {
  const [highlighted, setHighlighted] = useState<Map<number, HighlightedLine> | null>(null);
  const language = getShikiLanguage(filePath);

  useEffect(() => {
    if (!code || !language) {
      setHighlighted(null);
      return;
    }

    let cancelled = false;

    const highlight = async () => {
      try {
        // Get tokens for both themes
        const [lightResult, darkResult] = await Promise.all([
          codeToTokens(code, { lang: language, theme: 'github-light' }),
          codeToTokens(code, { lang: language, theme: 'github-dark' }),
        ]);

        if (cancelled) {
          return;
        }

        const lineMap = new Map<number, HighlightedLine>();
        const maxLines = Math.max(lightResult.tokens.length, darkResult.tokens.length);

        for (let i = 0; i < maxLines; i++) {
          lineMap.set(i + 1, {
            light: lightResult.tokens[i] || [],
            dark: darkResult.tokens[i] || [],
          });
        }

        setHighlighted(lineMap);
      } catch (err) {
        console.error('Failed to highlight code:', err);
        setHighlighted(null);
      }
    };

    highlight();

    return () => {
      cancelled = true;
    };
  }, [code, language]);

  return highlighted;
}

// Render highlighted tokens with both light and dark theme support
function HighlightedContent({
  lightTokens,
  darkTokens,
  fallback,
}: {
  lightTokens?: ThemedToken[];
  darkTokens?: ThemedToken[];
  fallback: string;
}) {
  if ((!lightTokens || lightTokens.length === 0) && (!darkTokens || darkTokens.length === 0)) {
    return <>{fallback || ' '}</>;
  }

  // Use dark tokens as reference for structure, with both colors available
  const tokens = darkTokens || lightTokens || [];
  const lightList = lightTokens || [];

  return (
    <>
      {tokens.map((token, i) => {
        const lightToken = lightList[i];
        return (
          <span
            key={i}
            className="shiki-token"
            style={
              {
                '--shiki-light': lightToken?.color || 'inherit',
                '--shiki-dark': token.color || 'inherit',
              } as React.CSSProperties
            }
          >
            {token.content}
          </span>
        );
      })}
    </>
  );
}

function computeHunks(oldContent: string, newContent: string): Hunk[] {
  const diffResult = diffLines(oldContent, newContent, {
    ignoreCase: false,
    ignoreWhitespace: false,
  });

  const lines: HunkLine[] = [];
  let oldLineNum = 1;
  let newLineNum = 1;

  diffResult.forEach((part: Change) => {
    const partLines = part.value.split('\n');
    // Remove trailing empty string from split
    if (partLines[partLines.length - 1] === '') {
      partLines.pop();
    }

    partLines.forEach((line) => {
      if (part.added) {
        lines.push({
          type: 'added',
          content: line,
          newLineNumber: newLineNum++,
        });
      } else if (part.removed) {
        lines.push({
          type: 'removed',
          content: line,
          oldLineNumber: oldLineNum++,
        });
      } else {
        lines.push({
          type: 'context',
          content: line,
          oldLineNumber: oldLineNum++,
          newLineNumber: newLineNum++,
        });
      }
    });
  });

  // Group lines into hunks with context
  const hunks: Hunk[] = [];
  let currentHunk: Hunk | null = null;
  let contextBuffer: HunkLine[] = [];
  let lastChangeIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.type !== 'context') {
      // Start a new hunk if needed
      if (currentHunk === null) {
        const contextStart = Math.max(0, contextBuffer.length - CONTEXT_LINES);
        const leadingContext = contextBuffer.slice(contextStart);
        const hiddenBefore = contextBuffer.length - leadingContext.length;

        currentHunk = {
          oldStart: leadingContext[0]?.oldLineNumber || line.oldLineNumber || 1,
          newStart: leadingContext[0]?.newLineNumber || line.newLineNumber || 1,
          oldLines: 0,
          newLines: 0,
          lines: [...leadingContext],
          hiddenLinesBefore: hiddenBefore > 0 ? hiddenBefore : undefined,
        };
      }

      currentHunk.lines.push(line);
      lastChangeIndex = currentHunk.lines.length - 1;
      contextBuffer = [];
    } else {
      if (currentHunk !== null) {
        // Check if we should close the hunk
        const contextSinceLastChange = currentHunk.lines.length - 1 - lastChangeIndex;

        if (contextSinceLastChange < CONTEXT_LINES * 2) {
          currentHunk.lines.push(line);
        } else {
          // Close the current hunk, keeping only CONTEXT_LINES after last change
          const trimmedLines = currentHunk.lines.slice(0, lastChangeIndex + CONTEXT_LINES + 1);
          currentHunk.lines = trimmedLines;

          // Calculate oldLines and newLines
          currentHunk.oldLines = trimmedLines.filter((l) => l.type !== 'added').length;
          currentHunk.newLines = trimmedLines.filter((l) => l.type !== 'removed').length;

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
    currentHunk.oldLines = currentHunk.lines.filter((l) => l.type !== 'added').length;
    currentHunk.newLines = currentHunk.lines.filter((l) => l.type !== 'removed').length;
    hunks.push(currentHunk);
  }

  return hunks;
}

function computeAddedFileHunks(content: string): Hunk[] {
  const contentLines = content.split('\n');
  const lines: HunkLine[] = contentLines.map((line, index) => ({
    type: 'added' as const,
    content: line,
    newLineNumber: index + 1,
  }));

  return [
    {
      oldStart: 0,
      oldLines: 0,
      newStart: 1,
      newLines: lines.length,
      lines,
    },
  ];
}

function computeDeletedFileHunks(content: string): Hunk[] {
  const contentLines = content.split('\n');
  const lines: HunkLine[] = contentLines.map((line, index) => ({
    type: 'removed' as const,
    content: line,
    oldLineNumber: index + 1,
  }));

  return [
    {
      oldStart: 1,
      oldLines: lines.length,
      newStart: 0,
      newLines: 0,
      lines,
    },
  ];
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

function compareRepositories(oldFiles: RepositoryFiles, newFiles: RepositoryFiles): FileDiff[] {
  const allPathsSet = new Set([...Object.keys(oldFiles), ...Object.keys(newFiles)]);
  const allPaths = [...allPathsSet].sort();

  const diffs: FileDiff[] = [];

  for (const path of allPaths) {
    const oldContent = oldFiles[path];
    const newContent = newFiles[path];

    if (!oldContent && newContent) {
      diffs.push({
        path,
        type: 'added',
        newContent,
        hunks: computeAddedFileHunks(newContent),
      });
    } else if (oldContent && !newContent) {
      diffs.push({
        path,
        type: 'deleted',
        oldContent,
        hunks: computeDeletedFileHunks(oldContent),
      });
    } else if (oldContent !== newContent) {
      diffs.push({
        path,
        type: 'modified',
        oldContent,
        newContent,
        hunks: computeHunks(oldContent, newContent),
      });
    }
  }

  return diffs;
}

// GitHub-style diff line component
function DiffLine({ line, tokens }: { line: HunkLine; tokens?: HighlightedLine }) {
  const bgColor =
    line.type === 'added'
      ? 'bg-green-50 dark:bg-green-950/40'
      : line.type === 'removed'
        ? 'bg-red-50 dark:bg-red-950/40'
        : 'bg-bolt-elements-background-depth-1';

  const borderColor =
    line.type === 'added'
      ? 'border-l-green-400 dark:border-l-green-600'
      : line.type === 'removed'
        ? 'border-l-red-400 dark:border-l-red-600'
        : 'border-l-transparent';

  const lineNumColor =
    line.type === 'added'
      ? 'text-green-600 dark:text-green-500 bg-green-100 dark:bg-green-900/30'
      : line.type === 'removed'
        ? 'text-red-600 dark:text-red-500 bg-red-100 dark:bg-red-900/30'
        : 'text-bolt-elements-textSecondary bg-bolt-elements-background-depth-2';

  const sign = line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' ';
  const signColor =
    line.type === 'added'
      ? 'text-green-600 dark:text-green-400'
      : line.type === 'removed'
        ? 'text-red-600 dark:text-red-400'
        : 'text-bolt-elements-textSecondary';

  return (
    <div className={`flex ${bgColor} border-l-4 ${borderColor} hover:brightness-95 dark:hover:brightness-110`}>
      <div
        className={`w-12 flex-shrink-0 text-right pr-2 py-0.5 select-none font-mono text-xs ${lineNumColor} border-r border-bolt-elements-borderColor/30`}
      >
        {line.oldLineNumber || ''}
      </div>
      <div
        className={`w-12 flex-shrink-0 text-right pr-2 py-0.5 select-none font-mono text-xs ${lineNumColor} border-r border-bolt-elements-borderColor/30`}
      >
        {line.newLineNumber || ''}
      </div>
      <div className={`w-6 flex-shrink-0 text-center py-0.5 select-none font-mono text-xs font-bold ${signColor}`}>
        {sign}
      </div>
      <pre className="flex-1 py-0.5 pr-4 font-mono text-xs whitespace-pre overflow-x-auto">
        <HighlightedContent lightTokens={tokens?.light} darkTokens={tokens?.dark} fallback={line.content} />
      </pre>
    </div>
  );
}

// Expand button component
function ExpandButton({ hiddenLines, onExpand }: { hiddenLines: number; onExpand: () => void }) {
  return (
    <button
      onClick={onExpand}
      className="w-full flex items-center justify-center gap-2 py-1.5 bg-bolt-elements-background-depth-2 hover:bg-blue-50 dark:hover:bg-blue-950/30 border-y border-bolt-elements-borderColor/50 text-bolt-elements-textSecondary hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-xs font-medium"
    >
      <ChevronDown size={14} />
      <span>Expand {hiddenLines} hidden lines</span>
      <ChevronDown size={14} />
    </button>
  );
}

// Component that renders all hunks with expand buttons between them
function HunksView({
  hunks,
  oldContent,
  newContent,
  filePath,
}: {
  hunks: Hunk[];
  oldContent?: string;
  newContent?: string;
  filePath: string;
}) {
  const [expandedSections, setExpandedSections] = useState<Record<string, HunkLine[]>>({});

  const oldLines = useMemo(() => oldContent?.split('\n') || [], [oldContent]);
  const newLines = useMemo(() => newContent?.split('\n') || [], [newContent]);

  // Highlight old and new content
  const oldHighlighted = useHighlightedCode(oldContent, filePath);
  const newHighlighted = useHighlightedCode(newContent, filePath);

  // Get tokens for a line based on its line number and type
  const getTokensForLine = useCallback(
    (line: HunkLine): HighlightedLine | undefined => {
      if (line.type === 'removed' && line.oldLineNumber && oldHighlighted) {
        return oldHighlighted.get(line.oldLineNumber);
      }
      if ((line.type === 'added' || line.type === 'context') && line.newLineNumber && newHighlighted) {
        return newHighlighted.get(line.newLineNumber);
      }
      // Fallback to old content for context lines
      if (line.type === 'context' && line.oldLineNumber && oldHighlighted) {
        return oldHighlighted.get(line.oldLineNumber);
      }
      return undefined;
    },
    [oldHighlighted, newHighlighted],
  );

  // Calculate hidden lines between hunks and at start/end
  const getHiddenLinesBefore = useCallback(
    (hunkIndex: number): { count: number; startOld: number; startNew: number } => {
      const hunk = hunks[hunkIndex];
      if (hunkIndex === 0) {
        // Lines before the first hunk
        const firstLineOld = hunk.oldStart || 1;
        const firstLineNew = hunk.newStart || 1;
        const hiddenCount = Math.max(firstLineOld - 1, firstLineNew - 1);
        return { count: hiddenCount, startOld: 0, startNew: 0 };
      } else {
        // Lines between previous hunk and this one
        const prevHunk = hunks[hunkIndex - 1];
        const prevEndOld = (prevHunk.oldStart || 1) + prevHunk.oldLines;
        const prevEndNew = (prevHunk.newStart || 1) + prevHunk.newLines;
        const thisStartOld = hunk.oldStart || 1;
        const thisStartNew = hunk.newStart || 1;
        const hiddenCount = Math.max(thisStartOld - prevEndOld, thisStartNew - prevEndNew);
        return { count: hiddenCount, startOld: prevEndOld - 1, startNew: prevEndNew - 1 };
      }
    },
    [hunks],
  );

  const getHiddenLinesAfter = useCallback((): { count: number; startOld: number; startNew: number } => {
    if (hunks.length === 0) {
      return { count: 0, startOld: 0, startNew: 0 };
    }
    const lastHunk = hunks[hunks.length - 1];
    const endOld = (lastHunk.oldStart || 1) + lastHunk.oldLines - 1;
    const endNew = (lastHunk.newStart || 1) + lastHunk.newLines - 1;
    const remainingOld = oldLines.length - endOld;
    const remainingNew = newLines.length - endNew;
    return { count: Math.max(remainingOld, remainingNew), startOld: endOld, startNew: endNew };
  }, [hunks, oldLines.length, newLines.length]);

  const handleExpand = useCallback(
    (key: string, startOld: number, startNew: number, count: number) => {
      if (expandedSections[key]) {
        // Already expanded, collapse it
        setExpandedSections((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      } else {
        // Expand - generate the context lines
        const lines: HunkLine[] = [];
        for (let i = 0; i < count; i++) {
          const oldLineNum = startOld + i + 1;
          const newLineNum = startNew + i + 1;
          lines.push({
            type: 'context',
            content: oldLines[startOld + i] || newLines[startNew + i] || '',
            oldLineNumber: oldLineNum <= oldLines.length ? oldLineNum : undefined,
            newLineNumber: newLineNum <= newLines.length ? newLineNum : undefined,
          });
        }
        setExpandedSections((prev) => ({ ...prev, [key]: lines }));
      }
    },
    [expandedSections, oldLines, newLines],
  );

  const hiddenAfter = getHiddenLinesAfter();

  return (
    <div className="overflow-x-auto">
      {hunks.map((hunk, hunkIndex) => {
        const hiddenBefore = getHiddenLinesBefore(hunkIndex);
        const beforeKey = `before-${hunkIndex}`;
        const isBeforeExpanded = !!expandedSections[beforeKey];

        return (
          <div key={hunkIndex} className="border-b border-bolt-elements-borderColor/30 last:border-b-0">
            {/* Expand button before this hunk */}
            {hiddenBefore.count > 0 && !isBeforeExpanded && (
              <ExpandButton
                hiddenLines={hiddenBefore.count}
                onExpand={() =>
                  handleExpand(beforeKey, hiddenBefore.startOld, hiddenBefore.startNew, hiddenBefore.count)
                }
              />
            )}

            {/* Expanded lines before this hunk */}
            {isBeforeExpanded && expandedSections[beforeKey] && (
              <div className="font-mono">
                {expandedSections[beforeKey].map((line, lineIndex) => (
                  <DiffLine key={`expanded-${beforeKey}-${lineIndex}`} line={line} tokens={getTokensForLine(line)} />
                ))}
              </div>
            )}

            {/* Hunk header */}
            <div className="flex items-center bg-blue-50 dark:bg-blue-950/30 border-y border-bolt-elements-borderColor/30 px-4 py-1.5">
              <span className="font-mono text-xs text-blue-600 dark:text-blue-400">
                @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
              </span>
            </div>

            {/* Hunk lines */}
            <div className="font-mono">
              {hunk.lines.map((line, lineIndex) => (
                <DiffLine key={`${hunkIndex}-${lineIndex}`} line={line} tokens={getTokensForLine(line)} />
              ))}
            </div>
          </div>
        );
      })}

      {/* Expand button after the last hunk */}
      {hiddenAfter.count > 0 && !expandedSections['after-last'] && (
        <ExpandButton
          hiddenLines={hiddenAfter.count}
          onExpand={() => handleExpand('after-last', hiddenAfter.startOld, hiddenAfter.startNew, hiddenAfter.count)}
        />
      )}

      {/* Expanded lines after last hunk */}
      {expandedSections['after-last'] && (
        <div className="font-mono">
          {expandedSections['after-last'].map((line, lineIndex) => (
            <DiffLine key={`expanded-after-${lineIndex}`} line={line} tokens={getTokensForLine(line)} />
          ))}
        </div>
      )}
    </div>
  );
}

// Full diff view for a file using CodeMirror merge view
function CodeMirrorDiffView({
  oldContent,
  newContent,
  path,
}: {
  oldContent: string;
  newContent: string;
  path: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  const getLanguageExtension = useCallback((filePath: string) => {
    const ext = filePath.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'js':
      case 'jsx':
      case 'ts':
      case 'tsx':
        return javascript({ jsx: true, typescript: ext === 'ts' || ext === 'tsx' });
      case 'html':
      case 'htm':
        return html();
      case 'css':
      case 'scss':
      case 'sass':
        return css();
      case 'json':
        return json();
      case 'md':
      case 'markdown':
        return markdown();
      case 'py':
        return python();
      default:
        return [];
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const lang = getLanguageExtension(path);

    const state = EditorState.create({
      doc: newContent,
      extensions: [
        minimalSetup,
        lang,
        EditorView.editable.of(false),
        EditorState.readOnly.of(true),
        unifiedMergeView({
          original: oldContent,
          highlightChanges: true,
          gutter: true,
          syntaxHighlightDeletions: true,
          mergeControls: false,
        }),
        EditorView.theme({
          '&': {
            fontSize: '12px',
            maxHeight: '500px',
          },
          '.cm-scroller': {
            overflow: 'auto',
            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
          },
          '.cm-content': {
            padding: '0',
          },
          '.cm-line': {
            padding: '1px 16px 1px 4px',
          },
          '.cm-changedLine': {
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
          },
          '.cm-deletedChunk': {
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
          },
          '.cm-insertedLine': {
            backgroundColor: 'rgba(34, 197, 94, 0.15)',
          },
          '.cm-deletedLine': {
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
          },
          '.cm-changedText': {
            backgroundColor: 'rgba(59, 130, 246, 0.2)',
            borderRadius: '2px',
          },
          '.cm-gutters': {
            backgroundColor: 'var(--bolt-elements-background-depth-2)',
            borderRight: '1px solid var(--bolt-elements-borderColor)',
          },
          '.cm-lineNumbers .cm-gutterElement': {
            padding: '0 8px 0 4px',
            minWidth: '40px',
            color: 'var(--bolt-elements-textSecondary)',
          },
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
    };
  }, [oldContent, newContent, path, getLanguageExtension]);

  return <div ref={containerRef} className="overflow-hidden rounded-lg border border-bolt-elements-borderColor" />;
}

// GitHub-style file diff component
// Rendered markdown diff view
// Diff markdown by paragraphs and return inline rendered diff with expandable collapsed sections
function RenderedMarkdownDiff({
  oldContent,
  newContent,
  diffType,
  collapsed = true,
}: {
  oldContent?: string;
  newContent?: string;
  diffType: 'added' | 'modified' | 'deleted';
  collapsed?: boolean;
}) {
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());

  // Split content by double newlines to get paragraphs/blocks
  const splitIntoBlocks = (content: string): string[] => {
    return content.split(/\n\n+/).filter((block) => block.trim());
  };

  // For added files, show all content with green background
  if (diffType === 'added' && newContent) {
    return (
      <div className="p-4">
        <div className="rounded-lg overflow-hidden border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/30 p-4">
          <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:text-green-800 dark:prose-headings:text-green-300 prose-p:text-green-800 dark:prose-p:text-green-300">
            <Markdown>{newContent}</Markdown>
          </div>
        </div>
      </div>
    );
  }

  // For deleted files, show all content with red background
  if (diffType === 'deleted' && oldContent) {
    return (
      <div className="p-4">
        <div className="rounded-lg overflow-hidden border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/30 p-4 line-through opacity-70">
          <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:text-red-800 dark:prose-headings:text-red-300 prose-p:text-red-800 dark:prose-p:text-red-300">
            <Markdown>{oldContent}</Markdown>
          </div>
        </div>
      </div>
    );
  }

  // For modified files, diff by blocks and show inline
  const oldBlocks = splitIntoBlocks(oldContent || '');
  const newBlocks = splitIntoBlocks(newContent || '');

  // Use diffLines on the block-level content
  const blockDiff = diffLines(oldBlocks.join('\n---BLOCK---\n'), newBlocks.join('\n---BLOCK---\n'));

  // Process the diff result into renderable sections
  const sections: { type: 'added' | 'removed' | 'unchanged'; content: string }[] = [];

  blockDiff.forEach((part) => {
    const blocks = part.value.split('\n---BLOCK---\n').filter((b) => b.trim());
    blocks.forEach((block) => {
      if (part.added) {
        sections.push({ type: 'added', content: block });
      } else if (part.removed) {
        sections.push({ type: 'removed', content: block });
      } else {
        sections.push({ type: 'unchanged', content: block });
      }
    });
  });

  // Build display items with collapsible sections
  type DisplayItem =
    | { kind: 'section'; type: 'added' | 'removed' | 'unchanged'; content: string }
    | { kind: 'collapsed'; count: number; sections: typeof sections; id: number };

  const CONTEXT_BLOCKS = 1;
  const displayItems: DisplayItem[] = [];
  let unchangedBuffer: typeof sections = [];
  let collapseId = 0;

  const flushUnchangedBuffer = (isEnd: boolean = false) => {
    if (unchangedBuffer.length === 0) {
      return;
    }

    // When not collapsed, show all sections without collapsing
    if (!collapsed) {
      unchangedBuffer.forEach((s) => {
        displayItems.push({ kind: 'section', ...s });
      });
      unchangedBuffer = [];
      return;
    }

    if (unchangedBuffer.length > CONTEXT_BLOCKS * 2 + 1) {
      // Show leading context
      if (displayItems.length > 0) {
        unchangedBuffer.slice(0, CONTEXT_BLOCKS).forEach((s) => {
          displayItems.push({ kind: 'section', ...s });
        });
      }
      // Add collapsed indicator
      const hiddenSections = unchangedBuffer.slice(
        displayItems.length > 0 ? CONTEXT_BLOCKS : 0,
        isEnd ? undefined : -CONTEXT_BLOCKS,
      );
      if (hiddenSections.length > 0) {
        displayItems.push({
          kind: 'collapsed',
          count: hiddenSections.length,
          sections: hiddenSections,
          id: collapseId++,
        });
      }
      // Show trailing context (if not at end)
      if (!isEnd) {
        unchangedBuffer.slice(-CONTEXT_BLOCKS).forEach((s) => {
          displayItems.push({ kind: 'section', ...s });
        });
      }
    } else {
      // Show all unchanged sections
      unchangedBuffer.forEach((s) => {
        displayItems.push({ kind: 'section', ...s });
      });
    }
    unchangedBuffer = [];
  };

  sections.forEach((section) => {
    if (section.type === 'unchanged') {
      unchangedBuffer.push(section);
    } else {
      flushUnchangedBuffer();
      displayItems.push({ kind: 'section', ...section });
    }
  });
  flushUnchangedBuffer(true);

  const toggleExpand = (id: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Group consecutive changed sections together
  interface CollapsedGroup {
    kind: 'collapsed';
    id: number;
    count: number;
    sections: typeof sections;
  }
  interface UnchangedGroup {
    kind: 'unchanged';
    content: string;
  }
  interface ChangesGroup {
    kind: 'changes';
    items: { type: 'added' | 'removed'; content: string }[];
  }
  type RenderGroup = CollapsedGroup | UnchangedGroup | ChangesGroup;

  const renderGroups: RenderGroup[] = [];
  let currentChangesGroup: { type: 'added' | 'removed'; content: string }[] = [];

  const flushChangesGroup = () => {
    if (currentChangesGroup.length > 0) {
      renderGroups.push({ kind: 'changes', items: [...currentChangesGroup] });
      currentChangesGroup = [];
    }
  };

  displayItems.forEach((item) => {
    if (item.kind === 'collapsed') {
      flushChangesGroup();
      renderGroups.push({
        kind: 'collapsed',
        id: item.id,
        count: item.count,
        sections: item.sections,
      });
    } else if (item.type === 'unchanged') {
      flushChangesGroup();
      renderGroups.push({ kind: 'unchanged', content: item.content });
    } else {
      // added or removed - accumulate in changes group
      currentChangesGroup.push({ type: item.type, content: item.content });
    }
  });
  flushChangesGroup();

  return (
    <div className="p-4 space-y-3">
      {renderGroups.map((group, groupIndex) => {
        if (group.kind === 'collapsed') {
          const isExpanded = expandedSections.has(group.id);
          if (isExpanded) {
            // Render the expanded sections
            return (
              <div key={`collapsed-${group.id}`}>
                {group.sections.map((section, sIndex) => (
                  <div key={`expanded-${group.id}-${sIndex}`} className="p-4 opacity-60">
                    <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:text-bolt-elements-textHeading prose-p:text-bolt-elements-textPrimary">
                      <Markdown>{section.content}</Markdown>
                    </div>
                  </div>
                ))}
              </div>
            );
          }
          // Render the expand button
          return (
            <button
              key={`collapsed-${group.id}`}
              onClick={() => toggleExpand(group.id)}
              className="w-full flex items-center justify-center gap-2 py-2 bg-bolt-elements-background-depth-2 hover:bg-blue-50 dark:hover:bg-blue-950/30 border border-bolt-elements-borderColor/50 text-bolt-elements-textSecondary hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-xs font-medium"
            >
              <ChevronDown size={14} />
              <span>Expand {group.count} hidden sections</span>
              <ChevronDown size={14} />
            </button>
          );
        }

        if (group.kind === 'unchanged') {
          return (
            <div key={`unchanged-${groupIndex}`} className="p-4 opacity-60">
              <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:text-bolt-elements-textHeading prose-p:text-bolt-elements-textPrimary">
                <Markdown>{group.content}</Markdown>
              </div>
            </div>
          );
        }

        // Render grouped changes (adjacent added/removed sections joined together)
        return (
          <div key={`changes-${groupIndex}`} className="overflow-hidden">
            {group.items.map((item, itemIndex) => {
              if (item.type === 'removed') {
                return (
                  <div
                    key={`change-${groupIndex}-${itemIndex}`}
                    className="border-l-4 border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-950/40 p-4"
                  >
                    <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:text-red-800 dark:prose-headings:text-red-300 prose-p:text-red-700 dark:prose-p:text-red-300 prose-code:text-red-700 dark:prose-code:text-red-300 line-through opacity-80">
                      <Markdown>{item.content}</Markdown>
                    </div>
                  </div>
                );
              }
              // added
              return (
                <div
                  key={`change-${groupIndex}-${itemIndex}`}
                  className="border-l-4 border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-950/40 p-4"
                >
                  <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:text-green-800 dark:prose-headings:text-green-300 prose-p:text-green-700 dark:prose-p:text-green-300 prose-code:text-green-700 dark:prose-code:text-green-300">
                    <Markdown>{item.content}</Markdown>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// Top-level view: Rendered vs Code (for markdown files)
type TopViewMode = 'rendered' | 'code';
// Code sub-mode: Collapsed vs Full File
type CodeViewMode = 'collapsed' | 'full';

function FileDiffView({
  diff,
  isExpanded,
  onToggleExpand,
}: {
  diff: FileDiff;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const isMarkdown = diff.path.endsWith('.md') || diff.path.endsWith('.markdown');
  const [topViewMode, setTopViewMode] = useState<TopViewMode>(isMarkdown ? 'rendered' : 'code');
  const [codeViewMode, setCodeViewMode] = useState<CodeViewMode>('collapsed');

  const getDiffTypeColor = (type: string) => {
    switch (type) {
      case 'added':
        return 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800';
      case 'deleted':
        return 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800';
      case 'modified':
        return 'text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800';
      default:
        return 'text-bolt-elements-textSecondary bg-bolt-elements-background-depth-2 border-bolt-elements-borderColor';
    }
  };

  const getDiffTypeIcon = (type: string): JSX.Element => {
    switch (type) {
      case 'added':
        return <PlusCircle className="text-green-500" size={18} />;
      case 'deleted':
        return <MinusCircle className="text-red-500" size={18} />;
      case 'modified':
        return <PenSquare className="text-blue-500" size={18} />;
      default:
        return <File className="text-gray-500" size={18} />;
    }
  };

  const totalAdditions = diff.hunks.reduce((sum, hunk) => sum + hunk.lines.filter((l) => l.type === 'added').length, 0);
  const totalDeletions = diff.hunks.reduce(
    (sum, hunk) => sum + hunk.lines.filter((l) => l.type === 'removed').length,
    0,
  );

  return (
    <div className="bg-bolt-elements-background-depth-2 rounded-xl border border-bolt-elements-borderColor overflow-hidden shadow-sm">
      {/* File header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-bolt-elements-background-depth-1 border-b border-bolt-elements-borderColor">
        <button
          onClick={onToggleExpand}
          className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity"
        >
          <div className="flex items-center gap-2 flex-shrink-0">
            {getDiffTypeIcon(diff.type)}
            <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${getDiffTypeColor(diff.type)}`}>
              {diff.type.toUpperCase()}
            </span>
          </div>
          <span className="font-mono text-sm text-bolt-elements-textPrimary flex-1 text-left truncate">
            {diff.path}
          </span>
        </button>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Rendered/Code toggle for markdown files - in header */}
          {isMarkdown && (
            <div className="flex items-center border border-bolt-elements-borderColor/50 rounded-lg overflow-hidden">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setTopViewMode('rendered');
                }}
                className={`px-2.5 py-1 text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  topViewMode === 'rendered'
                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                    : 'text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-2'
                }`}
              >
                <Eye size={12} />
                Rendered
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setTopViewMode('code');
                }}
                className={`px-2.5 py-1 text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  topViewMode === 'code'
                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                    : 'text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-2'
                }`}
              >
                <Code size={12} />
                Code
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 text-xs font-medium">
            {totalAdditions > 0 && <span className="text-green-600 dark:text-green-400">+{totalAdditions}</span>}
            {totalDeletions > 0 && <span className="text-red-600 dark:text-red-400">-{totalDeletions}</span>}
          </div>

          <button
            onClick={onToggleExpand}
            className="p-1 hover:bg-bolt-elements-background-depth-2 rounded transition-colors"
          >
            <ChevronDown
              size={16}
              className={`text-bolt-elements-textSecondary transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* Diff content */}
      {isExpanded && (
        <div>
          {/* Secondary toggle (Collapsed/Full) - shown for both rendered and code views */}
          {diff.type === 'modified' && (
            <div className="flex items-center justify-end gap-2 px-4 py-2 bg-bolt-elements-background-depth-1 border-b border-bolt-elements-borderColor/50">
              <button
                onClick={() => setCodeViewMode('collapsed')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  codeViewMode === 'collapsed'
                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                    : 'text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-2'
                }`}
              >
                Collapsed
              </button>
              <button
                onClick={() => setCodeViewMode('full')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  codeViewMode === 'full'
                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                    : 'text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-2'
                }`}
              >
                Full File
              </button>
            </div>
          )}

          {/* Render based on view mode */}
          {topViewMode === 'rendered' && isMarkdown ? (
            <RenderedMarkdownDiff
              oldContent={diff.oldContent}
              newContent={diff.newContent}
              diffType={diff.type}
              collapsed={codeViewMode === 'collapsed'}
            />
          ) : codeViewMode === 'full' && diff.type === 'modified' && diff.oldContent && diff.newContent ? (
            <div className="p-4">
              <CodeMirrorDiffView oldContent={diff.oldContent} newContent={diff.newContent} path={diff.path} />
            </div>
          ) : (
            <HunksView
              hunks={diff.hunks}
              oldContent={diff.oldContent}
              newContent={diff.newContent}
              filePath={diff.path}
            />
          )}
        </div>
      )}
    </div>
  );
}

// CSS for Shiki syntax highlighting with light/dark mode support
const ShikiStyles = () => (
  <style>{`
    .shiki-token {
      color: var(--shiki-light);
    }
    .dark .shiki-token {
      color: var(--shiki-dark);
    }
  `}</style>
);

function RepositoryDiff() {
  const [searchParams] = useSearchParams();
  const oldRepositoryId = searchParams.get('old');
  const newRepositoryId = searchParams.get('new');
  const [diffs, setDiffs] = useState<FileDiff[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      if (!oldRepositoryId || !newRepositoryId) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const oldRepositoryContents = await downloadRepository(oldRepositoryId);
        const newRepositoryContents = await downloadRepository(newRepositoryId);

        const oldFiles = await extractRepositoryFiles(oldRepositoryContents);
        const newFiles = await extractRepositoryFiles(newRepositoryContents);

        const fileDiffs = compareRepositories(oldFiles, newFiles);
        setDiffs(fileDiffs);
        // Auto-expand first 3 files
        setExpandedFiles(new Set(fileDiffs.slice(0, 3).map((d) => d.path)));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load repositories');
      } finally {
        setLoading(false);
      }
    })();
  }, [oldRepositoryId, newRepositoryId]);

  const toggleFileExpand = useCallback((path: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedFiles(new Set(diffs.map((d) => d.path)));
  }, [diffs]);

  const collapseAll = useCallback(() => {
    setExpandedFiles(new Set());
  }, []);

  const stats = useMemo(() => {
    return {
      added: diffs.filter((d) => d.type === 'added').length,
      modified: diffs.filter((d) => d.type === 'modified').length,
      deleted: diffs.filter((d) => d.type === 'deleted').length,
    };
  }, [diffs]);

  return (
    <>
      <ShikiStyles />
      <div className="h-full bg-gradient-to-br from-bolt-elements-background-depth-1 via-bolt-elements-background-depth-1 to-bolt-elements-background-depth-2 p-6">
        <div className="max-w-7xl mx-auto w-full h-full overflow-y-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg ring-2 ring-purple-500/20">
              <GitCompareArrows className="text-white" size={28} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-bolt-elements-textHeading mb-1">Repository Diff</h1>
              <p className="text-bolt-elements-textSecondary text-sm">Compare changes between repository versions</p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Repository IDs */}
            <div className="bg-bolt-elements-background-depth-2 bg-opacity-80 backdrop-blur-sm rounded-2xl border border-bolt-elements-borderColor border-opacity-50 shadow-lg p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex-shrink-0 w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md ring-1 ring-blue-500/20">
                  <GitBranch className="text-white" size={18} />
                </div>
                <h2 className="text-xl font-semibold text-bolt-elements-textHeading">Repository Versions</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wide">
                    Old Repository ID
                  </label>
                  <div className="p-4 bg-bolt-elements-background-depth-1 rounded-xl border border-bolt-elements-borderColor border-opacity-50 font-mono text-sm break-all text-bolt-elements-textPrimary shadow-inner">
                    {oldRepositoryId || <span className="text-bolt-elements-textSecondary italic">Not provided</span>}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wide">
                    New Repository ID
                  </label>
                  <div className="p-4 bg-bolt-elements-background-depth-1 rounded-xl border border-bolt-elements-borderColor border-opacity-50 font-mono text-sm break-all text-bolt-elements-textPrimary shadow-inner">
                    {newRepositoryId || <span className="text-bolt-elements-textSecondary italic">Not provided</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* Loading */}
            {loading && (
              <div className="bg-bolt-elements-background-depth-2 rounded-2xl border border-bolt-elements-borderColor border-opacity-30 shadow-sm p-8 backdrop-blur-sm">
                <div className="flex items-center justify-center">
                  <div className="w-8 h-8 border-3 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                  <span className="ml-4 text-bolt-elements-textSecondary font-medium">Loading repositories...</span>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30 border border-red-200 dark:border-red-800/50 rounded-2xl p-6 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center shadow-sm">
                    <AlertTriangle className="text-white" size={20} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-red-800 dark:text-red-300 mb-2">
                      Error Loading Repositories
                    </h3>
                    <p className="text-red-700 dark:text-red-400 leading-relaxed">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Diff results */}
            {!loading && !error && diffs.length > 0 && (
              <div className="space-y-4">
                {/* Stats bar */}
                <div className="flex items-center justify-between bg-bolt-elements-background-depth-2 rounded-xl border border-bolt-elements-borderColor p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Files className="text-bolt-elements-textSecondary" size={20} />
                      <span className="font-semibold text-bolt-elements-textHeading">{diffs.length} files changed</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      {stats.added > 0 && (
                        <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                          <PlusCircle size={14} />
                          {stats.added} added
                        </span>
                      )}
                      {stats.modified > 0 && (
                        <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                          <PenSquare size={14} />
                          {stats.modified} modified
                        </span>
                      )}
                      {stats.deleted > 0 && (
                        <span className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
                          <MinusCircle size={14} />
                          {stats.deleted} deleted
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={expandAll}
                      className="px-3 py-1.5 text-xs font-medium text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-1 rounded-lg transition-colors"
                    >
                      Expand all
                    </button>
                    <button
                      onClick={collapseAll}
                      className="px-3 py-1.5 text-xs font-medium text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-1 rounded-lg transition-colors"
                    >
                      Collapse all
                    </button>
                  </div>
                </div>

                {/* File diffs */}
                <div className="space-y-3">
                  {diffs.map((diff) => (
                    <FileDiffView
                      key={diff.path}
                      diff={diff}
                      isExpanded={expandedFiles.has(diff.path)}
                      onToggleExpand={() => toggleFileExpand(diff.path)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* No changes */}
            {!loading && !error && diffs.length === 0 && oldRepositoryId && newRepositoryId && (
              <div className="bg-bolt-elements-background-depth-2 rounded-2xl border border-bolt-elements-borderColor border-opacity-30 shadow-sm p-8 backdrop-blur-sm">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <CheckCircle className="text-white" size={24} />
                  </div>
                  <h3 className="text-lg font-semibold text-bolt-elements-textHeading mb-2">No Changes Found</h3>
                  <p className="text-bolt-elements-textSecondary">
                    The repositories are identical - no differences detected.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default RepositoryDiff;
