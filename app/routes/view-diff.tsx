import { useSearchParams } from '@remix-run/react';
import { downloadRepository } from '~/lib/replay/Deploy';
import { useEffect, useState } from 'react';
import JSZip from 'jszip';
import { diffLines } from 'diff';
import {
  PlusCircle,
  MinusCircle,
  PenSquare,
  File,
  GitCompareArrows,
  GitBranch,
  AlertTriangle,
  Files,
  Code,
  CheckCircle,
} from '~/components/ui/Icon';
import { Markdown } from '~/components/chat/Markdown';

interface FileDiff {
  path: string;
  type: 'added' | 'modified' | 'deleted';
  oldContent?: string;
  newContent?: string;
  diff?: string;
}

interface RepositoryFiles {
  [path: string]: string;
}

function computeDiff(oldContent: string, newContent: string): string {
  const diffResult = diffLines(oldContent, newContent, {
    ignoreCase: false,
    ignoreWhitespace: false,
  });

  let diff = '';
  diffResult.forEach((part) => {
    if (part.added) {
      diff +=
        part.value
          .split('\n')
          .map((line) => `+${line}`)
          .join('\n') + '\n';
    } else if (part.removed) {
      diff +=
        part.value
          .split('\n')
          .map((line) => `-${line}`)
          .join('\n') + '\n';
    } else {
      diff +=
        part.value
          .split('\n')
          .map((line) => ` ${line}`)
          .join('\n') + '\n';
    }
  });

  return diff;
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
        diff: newContent
          .split('\n')
          .map((line) => `+${line}`)
          .join('\n'),
      });
    } else if (oldContent && !newContent) {
      diffs.push({
        path,
        type: 'deleted',
        oldContent,
        diff: oldContent
          .split('\n')
          .map((line) => `-${line}`)
          .join('\n'),
      });
    } else if (oldContent !== newContent) {
      diffs.push({
        path,
        type: 'modified',
        oldContent,
        newContent,
        diff: computeDiff(oldContent, newContent),
      });
    }
  }

  return diffs;
}

function RepositoryDiff() {
  const [searchParams] = useSearchParams();
  const oldRepositoryId = searchParams.get('old');
  const newRepositoryId = searchParams.get('new');
  const [diffs, setDiffs] = useState<FileDiff[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load repositories');
      } finally {
        setLoading(false);
      }
    })();
  }, [oldRepositoryId, newRepositoryId]);

  const getDiffTypeColor = (type: string) => {
    switch (type) {
      case 'added':
        return 'text-green-700 dark:text-green-400 bg-gradient-to-r from-green-50 dark:from-green-950/30 to-emerald-50 dark:to-emerald-950/30 border-green-200 dark:border-green-800';
      case 'deleted':
        return 'text-red-700 dark:text-red-400 bg-gradient-to-r from-red-50 dark:from-red-950/30 to-rose-50 dark:to-rose-950/30 border-red-200 dark:border-red-800';
      case 'modified':
        return 'text-blue-700 dark:text-blue-400 bg-gradient-to-r from-blue-50 dark:from-blue-950/30 to-indigo-50 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800';
      default:
        return 'text-bolt-elements-textSecondary bg-bolt-elements-background-depth-2 border-bolt-elements-borderColor';
    }
  };

  const getDiffTypeIcon = (type: string): JSX.Element => {
    switch (type) {
      case 'added':
        return <PlusCircle className="text-green-500" size={20} />;
      case 'deleted':
        return <MinusCircle className="text-red-500" size={20} />;
      case 'modified':
        return <PenSquare className="text-blue-500" size={20} />;
      default:
        return <File className="text-gray-500" size={20} />;
    }
  };

  return (
    <div className="h-full bg-gradient-to-br from-bolt-elements-background-depth-1 via-bolt-elements-background-depth-1 to-bolt-elements-background-depth-2 p-6">
      <div className="max-w-7xl mx-auto w-full h-full overflow-y-auto">
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
          <div className="bg-bolt-elements-background-depth-2/80 backdrop-blur-sm rounded-2xl border border-bolt-elements-borderColor/50 shadow-lg p-6">
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
                <div className="p-4 bg-bolt-elements-background-depth-1 rounded-xl border border-bolt-elements-borderColor/50 font-mono text-sm break-all text-bolt-elements-textPrimary shadow-inner">
                  {oldRepositoryId || <span className="text-bolt-elements-textSecondary italic">Not provided</span>}
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wide">
                  New Repository ID
                </label>
                <div className="p-4 bg-bolt-elements-background-depth-1 rounded-xl border border-bolt-elements-borderColor/50 font-mono text-sm break-all text-bolt-elements-textPrimary shadow-inner">
                  {newRepositoryId || <span className="text-bolt-elements-textSecondary italic">Not provided</span>}
                </div>
              </div>
            </div>
          </div>

          {loading && (
            <div className="bg-bolt-elements-background-depth-2 rounded-2xl border border-bolt-elements-borderColor border-opacity-30 shadow-sm p-8 backdrop-blur-sm">
              <div className="flex items-center justify-center">
                <div className="w-8 h-8 border-3 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                <span className="ml-4 text-bolt-elements-textSecondary font-medium">Loading repositories...</span>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-gradient-to-r from-red-50 to-rose-50 border border-red-200/50 rounded-2xl p-6 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center shadow-sm">
                  <AlertTriangle className="text-white" size={20} />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-red-800 mb-2">Error Loading Repositories</h3>
                  <p className="text-red-700 leading-relaxed">{error}</p>
                </div>
              </div>
            </div>
          )}

          {!loading && !error && diffs.length > 0 && (
            <div className="bg-bolt-elements-background-depth-2/80 backdrop-blur-sm rounded-2xl border border-bolt-elements-borderColor/50 shadow-lg overflow-hidden">
              <div className="flex items-center gap-3 p-6 border-b border-bolt-elements-borderColor/30 bg-gradient-to-r from-bolt-elements-background-depth-2 to-bolt-elements-background-depth-1">
                <div className="flex-shrink-0 w-9 h-9 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-md ring-1 ring-green-500/20">
                  <Files className="text-white" size={18} />
                </div>
                <h2 className="text-xl font-semibold text-bolt-elements-textHeading">
                  File Changes <span className="text-bolt-elements-textSecondary font-normal">({diffs.length})</span>
                </h2>
              </div>
              <div className="divide-y divide-bolt-elements-borderColor/20">
                {diffs.map((diff, index) => (
                  <div
                    key={index}
                    className="p-6 hover:bg-bolt-elements-background-depth-1/30 transition-all duration-200 border-l-4 border-transparent hover:border-bolt-elements-borderColor/30"
                  >
                    <div className="flex items-center mb-4 gap-3 flex-wrap">
                      <div className="flex items-center gap-2.5">
                        {getDiffTypeIcon(diff.type)}
                        <span
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border shadow-sm ${getDiffTypeColor(diff.type)}`}
                        >
                          {diff.type.toUpperCase()}
                        </span>
                      </div>
                      <span className="font-mono text-sm text-bolt-elements-textPrimary bg-bolt-elements-background-depth-1 px-3 py-1.5 rounded-lg border border-bolt-elements-borderColor/50 flex-1 min-w-0 break-all shadow-inner">
                        {diff.path}
                      </span>
                    </div>

                    {diff.diff && (
                      <div className="bg-bolt-elements-background-depth-1 rounded-xl border border-bolt-elements-borderColor/50 overflow-hidden shadow-sm">
                        <div className="flex items-center gap-2 bg-bolt-elements-background-depth-2 px-4 py-3 border-b border-bolt-elements-borderColor/30">
                          <Code className="text-bolt-elements-textSecondary" size={16} />
                          <span className="text-sm font-semibold text-bolt-elements-textSecondary">
                            {diff.path.endsWith('.md') ? 'Content' : 'Diff'}
                          </span>
                        </div>
                        {diff.path.endsWith('.md') && diff.newContent ? (
                          <div className="p-6 max-h-96 overflow-y-auto">
                            <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:text-bolt-elements-textHeading prose-p:text-bolt-elements-textPrimary prose-strong:text-bolt-elements-textHeading prose-code:text-bolt-elements-textPrimary prose-pre:bg-bolt-elements-background-depth-2 prose-pre:border prose-pre:border-bolt-elements-borderColor/50">
                              <Markdown>{diff.newContent}</Markdown>
                            </div>
                          </div>
                        ) : (
                          <div className="overflow-x-auto max-h-96 overflow-y-auto">
                            <pre className="p-0 m-0 text-sm font-mono leading-relaxed">
                              <code className="block">
                                {diff.diff.split('\n').map((line, lineIndex) => {
                                  if (line.startsWith('+')) {
                                    return (
                                      <div
                                        key={lineIndex}
                                        className="px-4 py-1 bg-green-500/10 dark:bg-green-500/5 border-l-4 border-green-500 dark:border-green-400 text-green-700 dark:text-green-300 whitespace-pre font-medium"
                                      >
                                        {line}
                                      </div>
                                    );
                                  } else if (line.startsWith('-')) {
                                    return (
                                      <div
                                        key={lineIndex}
                                        className="px-4 py-1 bg-red-500/10 dark:bg-red-500/5 border-l-4 border-red-500 dark:border-red-400 text-red-700 dark:text-red-300 whitespace-pre font-medium"
                                      >
                                        {line}
                                      </div>
                                    );
                                  } else if (line.trim() === '') {
                                    return <div key={lineIndex} className="h-1" />;
                                  } else {
                                    return (
                                      <div
                                        key={lineIndex}
                                        className="px-4 py-1 text-bolt-elements-textSecondary/70 bg-bolt-elements-background-depth-1 whitespace-pre"
                                      >
                                        {line}
                                      </div>
                                    );
                                  }
                                })}
                              </code>
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

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
