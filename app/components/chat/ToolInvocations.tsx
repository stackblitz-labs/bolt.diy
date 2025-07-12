import type { ToolInvocationUIPart } from '@ai-sdk/ui-utils';
import { AnimatePresence, motion } from 'framer-motion';
import { memo, useMemo, useState, useEffect } from 'react';
import { createHighlighter, type BundledLanguage, type BundledTheme, type HighlighterGeneric } from 'shiki';
import { classNames } from '~/utils/classNames';
import {
  TOOL_EXECUTION_APPROVAL,
  TOOL_EXECUTION_DENIED,
  TOOL_EXECUTION_ERROR,
  TOOL_NO_EXECUTE_FUNCTION,
} from '~/utils/constants';
import { cubicEasingFn } from '~/utils/easings';
import { logger } from '~/utils/logger';
import { themeStore, type Theme } from '~/lib/stores/theme';
import { useStore } from '@nanostores/react';
import type { ToolCallAnnotation } from '~/types/context';

const highlighterOptions = {
  langs: ['json'],
  themes: ['light-plus', 'dark-plus'],
};

const jsonHighlighter: HighlighterGeneric<BundledLanguage, BundledTheme> =
  import.meta.hot?.data.jsonHighlighter ?? (await createHighlighter(highlighterOptions));

if (import.meta.hot) {
  import.meta.hot.data.jsonHighlighter = jsonHighlighter;
}

interface JsonCodeBlockProps {
  className?: string;
  code: string;
  theme: Theme;
}

function JsonCodeBlock({ className, code, theme }: JsonCodeBlockProps) {
  let formattedCode = code;

  try {
    if (typeof formattedCode === 'object') {
      formattedCode = JSON.stringify(formattedCode, null, 2);
    } else if (typeof formattedCode === 'string') {
      // Attempt to parse and re-stringify for formatting
      try {
        const parsed = JSON.parse(formattedCode);
        formattedCode = JSON.stringify(parsed, null, 2);
      } catch {
        // Leave as is if not JSON
      }
    }
  } catch (e) {
    // If parsing fails, keep original code
    logger.error('Failed to parse JSON', { error: e });
  }

  return (
    <div
      className={classNames('text-xs rounded-md overflow-hidden mcp-tool-invocation-code', className)}
      dangerouslySetInnerHTML={{
        __html: jsonHighlighter.codeToHtml(formattedCode, {
          lang: 'json',
          theme: theme === 'dark' ? 'dark-plus' : 'light-plus',
        }),
      }}
      style={{
        padding: '0',
        margin: '0',
      }}
    ></div>
  );
}

interface ToolInvocationsProps {
  toolInvocations: ToolInvocationUIPart[];
  toolCallAnnotations: ToolCallAnnotation[];
  addToolResult: ({ toolCallId, result }: { toolCallId: string; result: any }) => void;
}

export const ToolInvocations = memo(({ toolInvocations, toolCallAnnotations, addToolResult }: ToolInvocationsProps) => {
  const theme = useStore(themeStore);
  const [showDetails, setShowDetails] = useState(false);

  const toggleDetails = () => {
    setShowDetails((prev) => !prev);
  };

  const toolCalls = useMemo(
    () => toolInvocations.filter((inv) => inv.toolInvocation.state === 'call'),
    [toolInvocations],
  );

  const toolResults = useMemo(
    () => toolInvocations.filter((inv) => inv.toolInvocation.state === 'result'),
    [toolInvocations],
  );

  const hasToolCalls = toolCalls.length > 0;
  const hasToolResults = toolResults.length > 0;

  if (!hasToolCalls && !hasToolResults) {
    return null;
  }

  return (
    <div className="tool-invocation border border-bolt-elements-borderColor flex flex-col overflow-hidden rounded-lg w-full transition-border duration-150">
      <div className="flex">
        <button
          className="flex items-stretch bg-bolt-elements-artifacts-background hover:bg-bolt-elements-artifacts-backgroundHover w-full overflow-hidden"
          onClick={toggleDetails}
          aria-label={showDetails ? 'Collapse details' : 'Expand details'}
        >
          <div className="p-2.5">
            <div className="i-ph:wrench text-xl text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors"></div>
          </div>
          <div className="border-l border-bolt-elements-borderColor p-2.5 w-full text-left">
            <div className="w-full text-bolt-elements-textPrimary font-medium leading-5 text-sm">
              MCP Tool Invocations{' '}
              {hasToolResults && (
                <span className="w-full w-full text-bolt-elements-textSecondary text-xs mt-0.5">
                  ({toolResults.length} tool{hasToolResults ? 's' : ''} used)
                </span>
              )}
            </div>
          </div>
        </button>
        <AnimatePresence>
          {hasToolResults && (
            <motion.button
              initial={{ width: 0 }}
              animate={{ width: 'auto' }}
              exit={{ width: 0 }}
              transition={{ duration: 0.15, ease: cubicEasingFn }}
              className="bg-bolt-elements-artifacts-background hover:bg-bolt-elements-artifacts-backgroundHover"
              onClick={toggleDetails}
            >
              <div className="p-2">
                <div
                  className={`${showDetails ? 'i-ph:caret-up-bold' : 'i-ph:caret-down-bold'} text-xl text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors`}
                ></div>
              </div>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {hasToolCalls && (
          <motion.div
            className="details"
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: '0px' }}
            transition={{ duration: 0.15 }}
          >
            <div className="bg-bolt-elements-artifacts-borderColor h-[1px]" />

            <div className="px-3 py-3 text-left bg-bolt-elements-actions-background">
              <ToolCallsList
                toolInvocations={toolCalls}
                toolCallAnnotations={toolCallAnnotations}
                addToolResult={addToolResult}
                theme={theme}
              />
            </div>
          </motion.div>
        )}

        {hasToolResults && showDetails && (
          <motion.div
            className="details"
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: '0px' }}
            transition={{ duration: 0.15 }}
          >
            <div className="bg-bolt-elements-artifacts-borderColor h-[1px]" />

            <div className="p-5 text-left bg-bolt-elements-actions-background">
              <ToolResultsList toolInvocations={toolResults} toolCallAnnotations={toolCallAnnotations} theme={theme} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

const toolVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

interface ToolResultsListProps {
  toolInvocations: ToolInvocationUIPart[];
  toolCallAnnotations: ToolCallAnnotation[];
  theme: Theme;
}

const ToolResultsList = memo(({ toolInvocations, toolCallAnnotations, theme }: ToolResultsListProps) => {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
      <ul className="list-none space-y-4">
        {toolInvocations.map((tool, index) => {
          const toolCallState = tool.toolInvocation.state;

          if (toolCallState !== 'result') {
            return null;
          }

          const { toolName, toolCallId } = tool.toolInvocation;

          const annotation = toolCallAnnotations.find((annotation) => {
            return annotation.toolCallId === toolCallId;
          });

          const isErrorResult = [TOOL_NO_EXECUTE_FUNCTION, TOOL_EXECUTION_DENIED, TOOL_EXECUTION_ERROR].includes(
            tool.toolInvocation.result,
          );

          return (
            <motion.li
              key={index}
              variants={toolVariants}
              initial="hidden"
              animate="visible"
              transition={{
                duration: 0.2,
                ease: cubicEasingFn,
              }}
            >
              <div className="flex items-center gap-1.5 text-xs mb-1">
                {isErrorResult ? (
                  <div className="text-lg text-bolt-elements-icon-error">
                    <div className="i-ph:x"></div>
                  </div>
                ) : (
                  <div className="text-lg text-bolt-elements-icon-success">
                    <div className="i-ph:check"></div>
                  </div>
                )}
                <div className="text-bolt-elements-textSecondary text-xs">Server:</div>
                <div className="text-bolt-elements-textPrimary font-semibold">{annotation?.serverName}</div>
              </div>

              <div className="ml-6 mb-2">
                <div className="text-bolt-elements-textSecondary text-xs mb-1">
                  Tool: <span className="text-bolt-elements-textPrimary font-semibold">{toolName}</span>
                </div>
                <div className="text-bolt-elements-textSecondary text-xs mb-1">
                  Description:{' '}
                  <span className="text-bolt-elements-textPrimary font-semibold">{annotation?.toolDescription}</span>
                </div>
                <div className="text-bolt-elements-textSecondary text-xs mb-1">Parameters:</div>
                <div className="bg-[#FAFAFA] dark:bg-[#0A0A0A] p-3 rounded-md">
                  <JsonCodeBlock className="mb-0" code={JSON.stringify(tool.toolInvocation.args)} theme={theme} />
                </div>
                <div className="text-bolt-elements-textSecondary text-xs mt-3 mb-1">Result:</div>
                <div className="bg-[#FAFAFA] dark:bg-[#0A0A0A] p-3 rounded-md">
                  <JsonCodeBlock className="mb-0" code={JSON.stringify(tool.toolInvocation.result)} theme={theme} />
                </div>
              </div>
            </motion.li>
          );
        })}
      </ul>
    </motion.div>
  );
});

interface ToolCallsListProps {
  toolInvocations: ToolInvocationUIPart[];
  toolCallAnnotations: ToolCallAnnotation[];
  addToolResult: ({ toolCallId, result }: { toolCallId: string; result: any }) => void;
  theme: Theme;
}

const ToolCallsList = memo(({ toolInvocations, toolCallAnnotations, addToolResult, theme }: ToolCallsListProps) => {
  const [expanded, setExpanded] = useState<{ [id: string]: boolean }>({});

  // OS detection for shortcut display
  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

  const toggleExpand = (toolCallId: string) => {
    setExpanded((prev) => ({
      ...prev,
      [toolCallId]: !prev[toolCallId],
    }));
  };

  useEffect(() => {
    const expandedState: { [id: string]: boolean } = {};
    toolInvocations.forEach((inv) => {
      if (inv.toolInvocation.state === 'call') {
        expandedState[inv.toolInvocation.toolCallId] = true;
      }
    });
    setExpanded(expandedState);
  }, [toolInvocations]);

  // Keyboard shortcut logic
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if focus is in an input/textarea/contenteditable
      const active = document.activeElement as HTMLElement | null;

      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) {
        return;
      }

      if (Object.keys(expanded).length === 0) {
        return;
      }

      const openId = Object.keys(expanded).find((id) => expanded[id]);

      if (!openId) {
        return;
      }

      // Cancel: Cmd/Ctrl + Backspace
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key === 'Backspace') {
        e.preventDefault();
        addToolResult({
          toolCallId: openId,
          result: TOOL_EXECUTION_APPROVAL.REJECT,
        });
      }

      // Run tool: Cmd/Ctrl + Enter
      if ((isMac ? e.metaKey : e.ctrlKey) && (e.key === 'Enter' || e.key === 'Return')) {
        e.preventDefault();
        addToolResult({
          toolCallId: openId,
          result: TOOL_EXECUTION_APPROVAL.APPROVE,
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [expanded, addToolResult, isMac]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
      <ul className="list-none space-y-4">
        {toolInvocations.map((tool, index) => {
          const toolCallState = tool.toolInvocation.state;

          if (toolCallState !== 'call') {
            return null;
          }

          const { toolName, toolCallId } = tool.toolInvocation;
          const annotation = toolCallAnnotations.find((annotation) => annotation.toolCallId === toolCallId);

          return (
            <motion.li
              key={index}
              variants={toolVariants}
              initial="hidden"
              animate="visible"
              transition={{ duration: 0.2, ease: cubicEasingFn }}
            >
              <div className="">
                <div key={toolCallId} className="flex flex-col gap-1">
                  <div className="flex items-center text-bolt-elements-textSecondary font-semibold text-sm">
                    <button
                      onClick={() => toggleExpand(toolCallId)}
                      className="mr-1 focus:outline-none bg-transparent"
                      aria-label={expanded[toolCallId] ? 'Collapse' : 'Expand'}
                      tabIndex={0}
                      type="button"
                    >
                      <span
                        className={`i-ph:caret-down-bold inline-block transition-transform duration-150 ${expanded[toolCallId] ? '' : '-rotate-90'}`}
                      />
                    </button>
                    Calling MCP tool{' '}
                    <span className="ml-0.5 font-light font-mono text-bolt-elements-textPrimary bg-bolt-elements-background-depth-3 px-1.5 py-0.5 rounded-md">
                      {toolName}
                    </span>
                  </div>
                  {expanded[toolCallId] && (
                    <div className="flex gap-3">
                      <div className="w-[0.1px] min-h-[40px] bg-bolt-elements-background-depth-3 ml-1.5" />
                      <div className="flex flex-col gap-1 w-full">
                        <div className="text-bolt-elements-textSecondary text-xs mb-1">
                          Description:{' '}
                          <span className="text-bolt-elements-textPrimary font-semibold">
                            {annotation?.toolDescription}
                          </span>
                        </div>
                        <div className="flex w-full items-stretch space-x-2">
                          <div className="w-full rounded-md bg-bolt-elements-background-depth-3 p-3 ml-0 border-l-2 border-bolt-elements-borderColor">
                            <JsonCodeBlock
                              className="mb-0"
                              code={JSON.stringify(tool.toolInvocation.args, null, 2)}
                              theme={theme}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="flex justify-end gap-2 pt-2.5">
                    <button
                      className={classNames(
                        'px-2.5 py-1.5 rounded-lg text-xs',
                        'bg-transparent',
                        'text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary',
                        'transition-all duration-200',
                        'flex items-center gap-2',
                      )}
                      onClick={() =>
                        addToolResult({
                          toolCallId,
                          result: TOOL_EXECUTION_APPROVAL.REJECT,
                        })
                      }
                    >
                      Cancel <span className="opacity-70 text-xs ml-1">{isMac ? '⌘⌫' : 'Ctrl+Backspace'}</span>
                    </button>
                    <button
                      className={classNames(
                        'inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-normal rounded-lg transition-colors',
                        'bg-accent-500 hover:bg-accent-600',
                        'text-black',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                      )}
                      onClick={() =>
                        addToolResult({
                          toolCallId,
                          result: TOOL_EXECUTION_APPROVAL.APPROVE,
                        })
                      }
                    >
                      Run tool <span className="opacity-70 text-xs ml-1">{isMac ? '⌘↵' : 'Ctrl+Enter'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </motion.li>
          );
        })}
      </ul>
    </motion.div>
  );
});
