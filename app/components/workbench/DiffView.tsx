import { memo, useMemo, useState, useEffect, useCallback } from 'react';
import { useStore } from '@nanostores/react';
import { workbenchStore } from '~/lib/stores/workbench';
import type { FileMap } from '~/lib/stores/files';
import type { EditorDocument } from '~/components/editor/codemirror/CodeMirrorEditor';
import { diffLines, type Change } from 'diff';
import { getHighlighter } from 'shiki';
import '~/styles/diff-view.css';
import { diffFiles, extractRelativePath } from '~/utils/diff';
import { ActionRunner } from '~/lib/runtime/action-runner';
import type { FileHistory } from '~/types/actions';
import { getLanguageFromExtension } from '~/utils/getLanguageFromExtension';

interface CodeComparisonProps {
  beforeCode: string;
  afterCode: string;
  language: string;
  filename: string;
  lightTheme: string;
  darkTheme: string;
}

interface DiffBlock {
  lineNumber: number;
  content: string;
  type: 'added' | 'removed' | 'unchanged';
  correspondingLine?: number;
}

interface FullscreenButtonProps {
  onClick: () => void;
  isFullscreen: boolean;
}

const FullscreenButton = memo(({ onClick, isFullscreen }: FullscreenButtonProps) => (
  <button
    onClick={onClick}
    className="ml-4 p-1 rounded hover:bg-bolt-elements-background-depth-3 text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary transition-colors"
    title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
  >
    <div className={isFullscreen ? "i-ph:corners-in" : "i-ph:corners-out"} />
  </button>
));

const FullscreenOverlay = memo(({ isFullscreen, children }: { isFullscreen: boolean; children: React.ReactNode }) => {
  if (!isFullscreen) return <>{children}</>;
  
  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-6">
      <div className="w-full h-full max-w-[90vw] max-h-[90vh] bg-bolt-elements-background-depth-2 rounded-lg border border-bolt-elements-borderColor shadow-xl overflow-hidden">
        {children}
      </div>
    </div>
  );
});

const MAX_FILE_SIZE = 1024 * 1024; // 1MB
const BINARY_REGEX = /[\x00-\x08\x0E-\x1F]/;

const isBinaryFile = (content: string) => {
  return content.length > MAX_FILE_SIZE || BINARY_REGEX.test(content);
};

const processChanges = (beforeCode: string, afterCode: string) => {
  try {
    if (isBinaryFile(beforeCode) || isBinaryFile(afterCode)) {
      return {
        beforeLines: [],
        afterLines: [],
        hasChanges: false,
        lineChanges: { before: new Set(), after: new Set() },
        unifiedBlocks: [],
        isBinary: true
      };
    }

    // Normalizar quebras de linha para evitar falsos positivos
    const normalizedBefore = beforeCode.replace(/\r\n/g, '\n').trim();
    const normalizedAfter = afterCode.replace(/\r\n/g, '\n').trim();

    // Se os conteúdos são idênticos após normalização, não há mudanças
    if (normalizedBefore === normalizedAfter) {
      return {
        beforeLines: normalizedBefore.split('\n'),
        afterLines: normalizedAfter.split('\n'),
        hasChanges: false,
        lineChanges: { before: new Set(), after: new Set() },
        unifiedBlocks: []
      };
    }

    // Processar as diferenças com configurações mais precisas
    const changes = diffLines(normalizedBefore, normalizedAfter, {
      newlineIsToken: true,
      ignoreWhitespace: false,
      ignoreCase: false
    });

    // Mapear as mudanças com mais precisão
    const beforeLines = normalizedBefore.split('\n');
    const afterLines = normalizedAfter.split('\n');
    const lineChanges = {
      before: new Set<number>(),
      after: new Set<number>()
    };

    let beforeLineNumber = 0;
    let afterLineNumber = 0;

    const unifiedBlocks = changes.map(change => {
      const lines = change.value.split('\n').filter(line => line.length > 0);
      
      if (change.added) {
        lines.forEach((_, i) => lineChanges.after.add(afterLineNumber + i));
        const block = lines.map((line, i) => ({
          lineNumber: afterLineNumber + i,
          content: line,
          type: 'added' as const
        }));
        afterLineNumber += lines.length;
        return block;
      }

      if (change.removed) {
        lines.forEach((_, i) => lineChanges.before.add(beforeLineNumber + i));
        const block = lines.map((line, i) => ({
          lineNumber: beforeLineNumber + i,
          content: line,
          type: 'removed' as const
        }));
        beforeLineNumber += lines.length;
        return block;
      }

      const block = lines.map((line, i) => ({
        lineNumber: afterLineNumber + i,
        content: line,
        type: 'unchanged' as const,
        correspondingLine: beforeLineNumber + i
      }));
      beforeLineNumber += lines.length;
      afterLineNumber += lines.length;
      return block;
    }).flat();

    return {
      beforeLines,
      afterLines,
      hasChanges: lineChanges.before.size > 0 || lineChanges.after.size > 0,
      lineChanges,
      unifiedBlocks,
      isBinary: false
    };
  } catch (error) {
    console.error('Error processing changes:', error);
    return {
      beforeLines: [],
      afterLines: [],
      hasChanges: false,
      lineChanges: { before: new Set(), after: new Set() },
      unifiedBlocks: [],
      error: true,
      isBinary: false
    };
  }
};

const lineNumberStyles = "w-12 shrink-0 pl-2 py-0.5 text-left font-mono text-bolt-elements-textTertiary border-r border-bolt-elements-borderColor bg-bolt-elements-background-depth-1";
const lineContentStyles = "px-4 py-0.5 font-mono whitespace-pre flex-1 group-hover:bg-bolt-elements-background-depth-2 text-bolt-elements-textPrimary";

const renderContentWarning = (type: 'binary' | 'error') => (
  <div className="h-full flex items-center justify-center p-4">
    <div className="text-center text-bolt-elements-textTertiary">
      <div className={`i-ph:${type === 'binary' ? 'file-x' : 'warning-circle'} text-4xl text-red-400 mb-2 mx-auto`} />
      <p className="font-medium text-bolt-elements-textPrimary">
        {type === 'binary' ? 'Binary file detected' : 'Error processing file'}
      </p>
      <p className="text-sm mt-1">
        {type === 'binary' 
          ? 'Diff view is not available for binary files'
          : 'Could not generate diff preview'}
      </p>
    </div>
  </div>
);

const NoChangesView = memo(({ beforeCode, language, highlighter }: { 
  beforeCode: string;
  language: string;
  highlighter: any;
}) => (
  <div className="h-full flex flex-col items-center justify-center p-4">
    <div className="text-center text-bolt-elements-textTertiary">
      <div className="i-ph:files text-4xl text-green-400 mb-2 mx-auto" />
      <p className="font-medium text-bolt-elements-textPrimary">Files are identical</p>
      <p className="text-sm mt-1">Both versions match exactly</p>
    </div>
    <div className="mt-4 w-full max-w-2xl bg-bolt-elements-background-depth-1 rounded-lg border border-bolt-elements-borderColor overflow-hidden">
      <div className="p-2 text-xs font-bold text-bolt-elements-textTertiary border-b border-bolt-elements-borderColor">
        Current Content
      </div>
      <div className="overflow-auto max-h-96">
        {beforeCode.split('\n').map((line, index) => (
          <div key={index} className="flex group min-w-fit">
            <div className={lineNumberStyles}>{index + 1}</div>
            <div className={lineContentStyles}>
              <span className="mr-2"> </span>
              <span dangerouslySetInnerHTML={{ 
                __html: highlighter ? 
                  highlighter.codeToHtml(line, { lang: language, theme: 'github-dark' })
                    .replace(/<\/?pre[^>]*>/g, '')
                    .replace(/<\/?code[^>]*>/g, '') 
                  : line 
              }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
));

const InlineDiffComparison = memo(({ beforeCode, afterCode, filename, language, lightTheme, darkTheme }: CodeComparisonProps) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [highlighter, setHighlighter] = useState<any>(null);
  
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev);
  }, []);

  const { unifiedBlocks, hasChanges, isBinary, error } = useMemo(() => processChanges(beforeCode, afterCode), [beforeCode, afterCode]);

  useEffect(() => {
    getHighlighter({
      themes: ['github-dark'],
      langs: ['typescript', 'javascript', 'json', 'html', 'css', 'jsx', 'tsx']
    }).then(setHighlighter);
  }, []);

  if (isBinary || error) return renderContentWarning(isBinary ? 'binary' : 'error');

  const renderDiffBlock = (block: DiffBlock, index?: number) => {
    const key = index !== undefined ? `${block.lineNumber}-${index}` : block.lineNumber;
    const bgColor = {
      added: 'bg-green-500/20 border-l-4 border-green-500',
      removed: 'bg-red-500/20 border-l-4 border-red-500',
      unchanged: ''
    }[block.type];

    const highlightedCode = highlighter ? 
      highlighter.codeToHtml(block.content, { lang: language, theme: 'github-dark' }) : 
      block.content;

    return (
      <div key={key} className="flex group min-w-fit">
        <div className={lineNumberStyles}>
          {block.lineNumber + 1}
        </div>
        <div className={`${lineContentStyles} ${bgColor}`}>
          <span className="mr-2 text-bolt-elements-textTertiary">
            {block.type === 'added' && '+'}
            {block.type === 'removed' && '-'}
            {block.type === 'unchanged' && ' '}
          </span>
          <span 
            dangerouslySetInnerHTML={{ 
              __html: highlightedCode.replace(/<\/?pre[^>]*>/g, '').replace(/<\/?code[^>]*>/g, '') 
            }} 
          />
        </div>
      </div>
    );
  };

  return (
    <FullscreenOverlay isFullscreen={isFullscreen}>
      <div className="w-full h-full flex flex-col">
        <div className="flex items-center bg-bolt-elements-background-depth-1 p-2 text-sm text-bolt-elements-textPrimary shrink-0">
          <div className="i-ph:file mr-2 h-4 w-4 shrink-0" />
          <span className="truncate">{filename}</span>
          <span className="ml-auto shrink-0 flex items-center">
            {hasChanges ? (
              <span className="text-yellow-400">Modified</span>
            ) : (
              <span className="text-green-400">No Changes</span>
            )}
            <FullscreenButton onClick={toggleFullscreen} isFullscreen={isFullscreen} />
          </span>
        </div>
        <div className="flex-1 overflow-auto diff-panel-content">
          {hasChanges ? (
            <div className="overflow-x-auto">
              {unifiedBlocks.map((block, index) => renderDiffBlock(block, index))}
            </div>
          ) : (
            <NoChangesView 
              beforeCode={beforeCode}
              language={language}
              highlighter={highlighter}
            />
          )}
        </div>
      </div>
    </FullscreenOverlay>
  );
});

const SideBySideComparison = memo(({
  beforeCode,
  afterCode,
  language,
  filename,
  lightTheme,
  darkTheme,
}: CodeComparisonProps) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [highlighter, setHighlighter] = useState<any>(null);
  
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev);
  }, []);

  const { beforeLines, afterLines, hasChanges, lineChanges, isBinary, error } = useMemo(() => processChanges(beforeCode, afterCode), [beforeCode, afterCode]);

  useEffect(() => {
    getHighlighter({
      themes: ['github-dark'],
      langs: ['typescript', 'javascript', 'json', 'html', 'css', 'jsx', 'tsx']
    }).then(setHighlighter);
  }, []);

  if (isBinary || error) return renderContentWarning(isBinary ? 'binary' : 'error');

  const renderCode = (code: string) => {
    if (!highlighter) return code;
    const highlightedCode = highlighter.codeToHtml(code, { 
      lang: language, 
      theme: 'github-dark' 
    });
    return highlightedCode.replace(/<\/?pre[^>]*>/g, '').replace(/<\/?code[^>]*>/g, '');
  };

  return (
    <FullscreenOverlay isFullscreen={isFullscreen}>
      <div className="w-full h-full flex flex-col">
        <div className="flex items-center bg-bolt-elements-background-depth-1 p-2 text-sm text-bolt-elements-textPrimary shrink-0">
          <div className="i-ph:file mr-2 h-4 w-4 shrink-0" />
          <span className="truncate">{filename}</span>
          <span className="ml-auto shrink-0 flex items-center">
            {hasChanges ? (
              <span className="text-yellow-400">Modified</span>
            ) : (
              <span className="text-green-400">No Changes</span>
            )}
            <FullscreenButton onClick={toggleFullscreen} isFullscreen={isFullscreen} />
          </span>
        </div>
        <div className="flex-1 overflow-auto diff-panel-content">
          {hasChanges ? (
            <div className="grid md:grid-cols-2 divide-x divide-bolt-elements-borderColor relative h-full">
              <div className="overflow-auto">
                <div className="overflow-auto">
                  {beforeLines.map((line, index) => (
                    <div key={`before-${index}`} className="flex group min-w-fit">
                      <div className={lineNumberStyles}>{index + 1}</div>
                      <div className={`${lineContentStyles} ${lineChanges.before.has(index) ? 'bg-red-500/20 border-l-4 border-red-500' : ''}`}>
                        <span className="mr-2 text-bolt-elements-textTertiary">
                          {lineChanges.before.has(index) ? '-' : ' '}
                        </span>
                        <span dangerouslySetInnerHTML={{ __html: renderCode(line) }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="overflow-auto">
                {afterLines.map((line, index) => (
                  <div key={`after-${index}`} className="flex group min-w-fit">
                    <div className={lineNumberStyles}>{index + 1}</div>
                    <div className={`${lineContentStyles} ${lineChanges.after.has(index) ? 'bg-green-500/20 border-l-4 border-green-500' : ''}`}>
                      <span className="mr-2 text-bolt-elements-textTertiary">
                        {lineChanges.after.has(index) ? '+' : ' '}
                      </span>
                      <span dangerouslySetInnerHTML={{ __html: renderCode(line) }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <NoChangesView 
              beforeCode={beforeCode}
              language={language}
              highlighter={highlighter}
            />
          )}
        </div>
      </div>
    </FullscreenOverlay>
  );
});

interface DiffViewProps {
  fileHistory: Record<string, FileHistory>;
  setFileHistory: React.Dispatch<React.SetStateAction<Record<string, FileHistory>>>;
  diffViewMode: 'inline' | 'side';
  actionRunner: ActionRunner;
}

export const DiffView = memo(({ fileHistory, setFileHistory, diffViewMode, actionRunner }: DiffViewProps) => {
  const files = useStore(workbenchStore.files) as FileMap;
  const selectedFile = useStore(workbenchStore.selectedFile);
  const currentDocument = useStore(workbenchStore.currentDocument) as EditorDocument;
  const unsavedFiles = useStore(workbenchStore.unsavedFiles);

  useEffect(() => {
    if (selectedFile && currentDocument) {
      const file = files[selectedFile];
      if (!file || !('content' in file)) return;

      const existingHistory = fileHistory[selectedFile];
      const currentContent = currentDocument.value;
      
      const relativePath = extractRelativePath(selectedFile);
      const unifiedDiff = diffFiles(
        relativePath,
        existingHistory?.originalContent || file.content,
        currentContent
      );

      if (unifiedDiff) {
        const newChanges = diffLines(
          existingHistory?.originalContent || file.content,
          currentContent
        );

        const newHistory: FileHistory = {
          originalContent: existingHistory?.originalContent || file.content,
          lastModified: Date.now(),
          changes: [
            ...(existingHistory?.changes || []),
            ...newChanges
          ].slice(-100), // Limitar histórico de mudanças
          versions: [
            ...(existingHistory?.versions || []),
            {
              timestamp: Date.now(),
              content: currentContent
            }
          ].slice(-10), // Manter apenas as 10 últimas versões
          changeSource: 'auto-save'
        };
        
        setFileHistory(prev => ({ ...prev, [selectedFile]: newHistory }));
      }
    }
  }, [selectedFile, currentDocument?.value, files, setFileHistory, unsavedFiles]);

  if (!selectedFile || !currentDocument) {
    return (
      <div className="flex w-full h-full justify-center items-center bg-bolt-elements-background-depth-1 text-bolt-elements-textPrimary">
        Select a file to view differences
      </div>
    );
  }

  const file = files[selectedFile];
  const originalContent = file && 'content' in file ? file.content : '';
  const currentContent = currentDocument.value;

  const history = fileHistory[selectedFile];
  const effectiveOriginalContent = history?.originalContent || originalContent;
  const language = getLanguageFromExtension(selectedFile.split('.').pop() || '');

  try {
    return (
      <div className="h-full overflow-hidden">
        {diffViewMode === 'inline' ? (
          <InlineDiffComparison
            beforeCode={effectiveOriginalContent}
            afterCode={currentContent}
            language={language}
            filename={selectedFile}
            lightTheme="github-light"
            darkTheme="github-dark"
          />
        ) : (
          <SideBySideComparison
            beforeCode={effectiveOriginalContent}
            afterCode={currentContent}
            language={language}
            filename={selectedFile}
            lightTheme="github-light"
            darkTheme="github-dark"
          />
        )}
      </div>
    );
  } catch (error) {
    console.error('DiffView render error:', error);
    return (
      <div className="flex w-full h-full justify-center items-center bg-bolt-elements-background-depth-1 text-red-400">
        <div className="text-center">
          <div className="i-ph:warning-circle text-4xl mb-2" />
          <p>Failed to render diff view</p>
        </div>
      </div>
    );
  }
});
