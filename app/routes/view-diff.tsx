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
} from '~/components/ui/Icon';

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
function DiffLine({ line }: { line: HunkLine }) {
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

  const textColor =
    line.type === 'added'
      ? 'text-green-800 dark:text-green-300'
      : line.type === 'removed'
        ? 'text-red-800 dark:text-red-300'
        : 'text-bolt-elements-textPrimary';

  const lineNumColor =
    line.type === 'added'
      ? 'text-green-600 dark:text-green-500 bg-green-100 dark:bg-green-900/30'
      : line.type === 'removed'
        ? 'text-red-600 dark:text-red-500 bg-red-100 dark:bg-red-900/30'
        : 'text-bolt-elements-textSecondary bg-bolt-elements-background-depth-2';

  const sign = line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' ';

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
      <div
        className={`w-6 flex-shrink-0 text-center py-0.5 select-none font-mono text-xs font-bold ${textColor}`}
      >
        {sign}
      </div>
      <pre className={`flex-1 py-0.5 pr-4 font-mono text-xs ${textColor} whitespace-pre overflow-x-auto`}>
        {line.content || ' '}
      </pre>
    </div>
  );
}

// Expand button component
function ExpandButton({
  hiddenLines,
  onExpand,
}: {
  hiddenLines: number;
  onExpand: () => void;
}) {
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
}: {
  hunks: Hunk[];
  oldContent?: string;
  newContent?: string;
}) {
  const [expandedSections, setExpandedSections] = useState<Record<string, HunkLine[]>>({});

  const oldLines = useMemo(() => oldContent?.split('\n') || [], [oldContent]);
  const newLines = useMemo(() => newContent?.split('\n') || [], [newContent]);
  const totalLines = Math.max(oldLines.length, newLines.length);

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
    [hunks]
  );

  const getHiddenLinesAfter = useCallback((): { count: number; startOld: number; startNew: number } => {
    if (hunks.length === 0) return { count: 0, startOld: 0, startNew: 0 };
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
    [expandedSections, oldLines, newLines]
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
                  <DiffLine key={`expanded-${beforeKey}-${lineIndex}`} line={line} />
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
                <DiffLine key={`${hunkIndex}-${lineIndex}`} line={line} />
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
            <DiffLine key={`expanded-after-${lineIndex}`} line={line} />
          ))}
        </div>
      )}
    </div>
  );
}

// Full diff view for a file using CodeMirror merge view
function CodeMirrorDiffView({ oldContent, newContent, path }: { oldContent: string; newContent: string; path: string }) {
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
    if (!containerRef.current) return;

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
function FileDiffView({ diff, isExpanded, onToggleExpand }: { diff: FileDiff; isExpanded: boolean; onToggleExpand: () => void }) {
  const [showFullDiff, setShowFullDiff] = useState(false);

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

  const totalAdditions = diff.hunks.reduce(
    (sum, hunk) => sum + hunk.lines.filter((l) => l.type === 'added').length,
    0
  );
  const totalDeletions = diff.hunks.reduce(
    (sum, hunk) => sum + hunk.lines.filter((l) => l.type === 'removed').length,
    0
  );

  return (
    <div className="bg-bolt-elements-background-depth-2 rounded-xl border border-bolt-elements-borderColor overflow-hidden shadow-sm">
      {/* File header */}
      <button
        onClick={onToggleExpand}
        className="w-full flex items-center gap-3 px-4 py-3 bg-bolt-elements-background-depth-1 hover:bg-bolt-elements-background-depth-2 border-b border-bolt-elements-borderColor transition-colors"
      >
        <div className="flex items-center gap-2">
          {getDiffTypeIcon(diff.type)}
          <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${getDiffTypeColor(diff.type)}`}>
            {diff.type.toUpperCase()}
          </span>
        </div>
        <span className="font-mono text-sm text-bolt-elements-textPrimary flex-1 text-left truncate">
          {diff.path}
        </span>
        <div className="flex items-center gap-3 text-xs font-medium">
          {totalAdditions > 0 && (
            <span className="text-green-600 dark:text-green-400">+{totalAdditions}</span>
          )}
          {totalDeletions > 0 && (
            <span className="text-red-600 dark:text-red-400">-{totalDeletions}</span>
          )}
          <ChevronDown
            size={16}
            className={`text-bolt-elements-textSecondary transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* Diff content */}
      {isExpanded && (
        <div>
          {/* Toggle between hunk view and full CodeMirror view */}
          {diff.type === 'modified' && (
            <div className="flex items-center justify-end gap-2 px-4 py-2 bg-bolt-elements-background-depth-1 border-b border-bolt-elements-borderColor/50">
              <button
                onClick={() => setShowFullDiff(false)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  !showFullDiff
                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                    : 'text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-2'
                }`}
              >
                Collapsed
              </button>
              <button
                onClick={() => setShowFullDiff(true)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  showFullDiff
                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                    : 'text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-2'
                }`}
              >
                Full File
              </button>
            </div>
          )}

          {showFullDiff && diff.type === 'modified' && diff.oldContent && diff.newContent ? (
            <div className="p-4">
              <CodeMirrorDiffView
                oldContent={diff.oldContent}
                newContent={diff.newContent}
                path={diff.path}
              />
            </div>
          ) : (
            <HunksView
              hunks={diff.hunks}
              oldContent={diff.oldContent}
              newContent={diff.newContent}
            />
          )}
        </div>
      )}
    </div>
  );
}

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
    <div className="h-full bg-gradient-to-br from-bolt-elements-background-depth-1 via-bolt-elements-background-depth-1 to-bolt-elements-background-depth-2 p-6">
      <div className="max-w-7xl mx-auto w-full h-full overflow-y-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg ring-2 ring-purple-500/20">
            <GitCompareArrows className="text-white" size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-bolt-elements-textHeading mb-1">Repository Diff</h1>
            <p className="text-bolt-elements-textSecondary text-sm">
              Compare changes between repository versions
            </p>
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
                  {oldRepositoryId || (
                    <span className="text-bolt-elements-textSecondary italic">Not provided</span>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wide">
                  New Repository ID
                </label>
                <div className="p-4 bg-bolt-elements-background-depth-1 rounded-xl border border-bolt-elements-borderColor border-opacity-50 font-mono text-sm break-all text-bolt-elements-textPrimary shadow-inner">
                  {newRepositoryId || (
                    <span className="text-bolt-elements-textSecondary italic">Not provided</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Loading */}
          {loading && (
            <div className="bg-bolt-elements-background-depth-2 rounded-2xl border border-bolt-elements-borderColor border-opacity-30 shadow-sm p-8 backdrop-blur-sm">
              <div className="flex items-center justify-center">
                <div className="w-8 h-8 border-3 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                <span className="ml-4 text-bolt-elements-textSecondary font-medium">
                  Loading repositories...
                </span>
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
                    <span className="font-semibold text-bolt-elements-textHeading">
                      {diffs.length} files changed
                    </span>
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
  );
}

export default RepositoryDiff;
