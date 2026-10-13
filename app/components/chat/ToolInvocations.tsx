import { useStore } from '@nanostores/react';
import { AnimatePresence, motion } from 'framer-motion';
import { memo, useMemo, useState, useEffect, useRef } from 'react';
import { createHighlighter, type Highlighter } from 'shiki';
import { Markdown } from './Markdown';
import { getToolDisplayError, getToolDisplayState } from './toolActivity';
import { isAgentPlan, isServerAgentTool } from '~/lib/common/agentLoop';
import {
  getToolCallId,
  getToolInput,
  getToolName,
  getToolOutput,
  getToolState,
  isToolCallPart,
  isToolResultPart,
  type AnyPart,
} from '~/lib/persistence/messageMigration';
import { themeStore, type Theme } from '~/lib/stores/theme';
import { useToolAccessStore } from '~/lib/stores/toolAccess';
import type { ToolCallAnnotation } from '~/types/context';
import { getThemeMode } from '~/types/theme';
import { classNames } from '~/utils/classNames';
import { TOOL_EXECUTION_APPROVAL } from '~/utils/constants';
import { cubicEasingFn } from '~/utils/easings';
import { logger } from '~/utils/logger';

const highlighterOptions = {
  langs: ['json'],
  themes: ['light-plus', 'dark-plus'],
};

const jsonHighlighter: Highlighter =
  import.meta.hot?.data.jsonHighlighter ?? (await createHighlighter(highlighterOptions));

if (import.meta.hot) {
  import.meta.hot.data.jsonHighlighter = jsonHighlighter;
}

interface JsonCodeBlockProps {
  className?: string;

  /*
   * `undefined` is a real value here: the call sites do
   * `JSON.stringify(getToolOutput(part))`, and `JSON.stringify(undefined)` returns
   * `undefined` rather than a string. TypeScript's lib types claim `string`, which
   * is why the unsoundness went unnoticed.
   */
  code: string | undefined;
  theme: Theme;
}

function JsonCodeBlock({ className, code, theme }: JsonCodeBlockProps) {
  /*
   * Normalise before doing anything else. Passing `undefined` straight through to
   * shiki makes its `splitLines()` read `.length` off it, which threw
   * "Cannot read properties of undefined (reading 'length')" and took down the whole
   * React tree via the error boundary.
   */
  let formattedCode = typeof code === 'string' ? code : (JSON.stringify(code ?? null, null, 2) ?? '');

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
          theme: getThemeMode(theme) === 'dark' ? 'dark-plus' : 'light-plus',
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
  toolInvocations: AnyPart[];
  toolCallAnnotations: ToolCallAnnotation[];
  addToolResult: (options: { tool: string; toolCallId: string; output: unknown }) => void;
  orderedParts?: AnyPart[];
}

export const ToolInvocations = memo(
  ({ toolInvocations, toolCallAnnotations, addToolResult, orderedParts }: ToolInvocationsProps) => {
    const theme = useStore(themeStore);
    const [showDetails, setShowDetails] = useState(false);

    const toggleDetails = () => {
      setShowDetails((prev) => !prev);
    };

    const toolCalls = useMemo(() => toolInvocations.filter((inv) => isToolCallPart(inv)), [toolInvocations]);

    const toolResults = useMemo(() => toolInvocations.filter((inv) => isToolResultPart(inv)), [toolInvocations]);

    const hasToolCalls = toolCalls.length > 0;
    const hasToolResults = toolResults.length > 0;

    if (!hasToolCalls && !hasToolResults) {
      return null;
    }

    if (orderedParts) {
      return (
        <div className="flex w-full flex-col gap-3 py-1">
          <ToolCallsList
            toolInvocations={toolInvocations}
            orderedParts={orderedParts}
            toolCallAnnotations={toolCallAnnotations}
            addToolResult={addToolResult}
            theme={theme}
          />
        </div>
      );
    }

    return (
      <div className="tool-invocation border border-bolt-elements-borderColor flex flex-col overflow-hidden rounded-lg w-full transition-border duration-150">
        <div className="flex">
          <button
            className="flex items-stretch bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-artifacts-backgroundHover w-full overflow-hidden"
            onClick={toggleDetails}
            aria-label={showDetails ? 'Collapse details' : 'Expand details'}
          >
            <div className="p-2.5">
              <div className="i-ph:wrench text-xl text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors"></div>
            </div>
            <div className="p-2.5 w-full text-left">
              <div className="w-full text-bolt-elements-textPrimary font-medium leading-5 text-sm">
                {activitySummary(toolInvocations)}{' '}
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
          {(hasToolCalls || hasToolResults) && (
            <motion.div
              className="details"
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: '0px' }}
              transition={{ duration: 0.15 }}
            >
              <div className="bg-bolt-elements-artifacts-borderColor h-[1px]" />

              <div className="px-3 py-3 text-left bg-bolt-elements-background-depth-2">
                <ToolCallsList
                  toolInvocations={toolInvocations}
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
                <ToolResultsList
                  toolInvocations={toolResults}
                  toolCallAnnotations={toolCallAnnotations}
                  theme={theme}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  },
);

function activitySummary(parts: AnyPart[]): string {
  const names = parts.filter((part) => isToolCallPart(part) || isToolResultPart(part)).map((part) => getToolName(part));
  const reads = names.filter((name) => name === 'project_read_file').length;
  const lists = names.filter((name) => name === 'project_list_paths').length;

  const exploration = [
    reads ? `${reads} read${reads === 1 ? '' : 's'}` : '',
    lists ? `${lists} list${lists === 1 ? '' : 's'}` : '',
  ]
    .filter(Boolean)
    .join(', ');

  return exploration ? `Explored ${exploration}` : `${names.length} activity ${names.length === 1 ? 'item' : 'items'}`;
}

const toolVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

interface ToolResultsListProps {
  toolInvocations: AnyPart[];
  toolCallAnnotations: ToolCallAnnotation[];
  theme: Theme;
}

const ToolResultsList = memo(({ toolInvocations, toolCallAnnotations, theme }: ToolResultsListProps) => {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
      <ul className="list-none space-y-4">
        {toolInvocations.map((tool, index) => {
          if (!isToolResultPart(tool)) {
            return null;
          }

          const toolCallId = getToolCallId(tool) as string;
          const toolName = getToolName(tool) ?? '';

          const annotation = toolCallAnnotations.find((annotation) => {
            return annotation.toolCallId === toolCallId;
          });

          const displayState = getToolDisplayState(tool);
          const isErrorResult = displayState === 'output-error';

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
                ) : displayState === 'process-running' ? (
                  <div className="text-lg text-blue-500">
                    <div className="i-ph:play"></div>
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
                  <JsonCodeBlock className="mb-0" code={JSON.stringify(getToolInput(tool))} theme={theme} />
                </div>
                <div className="text-bolt-elements-textSecondary text-xs mt-3 mb-1">Result:</div>
                <div className="bg-[#FAFAFA] dark:bg-[#0A0A0A] p-3 rounded-md">
                  <JsonCodeBlock className="mb-0" code={JSON.stringify(getToolOutput(tool))} theme={theme} />
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
  toolInvocations: AnyPart[];
  orderedParts?: AnyPart[];
  toolCallAnnotations: ToolCallAnnotation[];
  addToolResult: (options: { tool: string; toolCallId: string; output: unknown }) => void;
  theme: Theme;
}

const ToolCallsList = memo(
  ({ toolInvocations, orderedParts, toolCallAnnotations, addToolResult }: ToolCallsListProps) => {
    const [runningToolCalls, setRunningToolCalls] = useState<Set<string>>(new Set());
    const fullAccess = useToolAccessStore((state) => state.mode === 'full-access');
    const autoApprovedCalls = useRef(new Set<string>());

    useEffect(() => {
      if (!fullAccess) {
        return;
      }

      for (const invocation of toolInvocations) {
        if (!isToolCallPart(invocation) || getToolState(invocation) !== 'input-available') {
          continue;
        }

        const toolCallId = getToolCallId(invocation);
        const toolName = getToolName(invocation);

        if (!toolCallId || !toolName || isServerAgentTool(toolName) || autoApprovedCalls.current.has(toolCallId)) {
          continue;
        }

        autoApprovedCalls.current.add(toolCallId);
        setRunningToolCalls((current) => new Set(current).add(toolCallId));
        addToolResult({ tool: toolName, toolCallId, output: TOOL_EXECUTION_APPROVAL.APPROVE });
      }
    }, [addToolResult, fullAccess, toolInvocations]);

    useEffect(() => {
      const pendingIds = new Set(
        toolInvocations.filter(isToolCallPart).map((invocation) => getToolCallId(invocation) as string),
      );
      setRunningToolCalls((current) => new Set([...current].filter((id) => pendingIds.has(id))));
    }, [toolInvocations]);

    if (orderedParts) {
      const explorationParts = orderedParts.filter(
        (part) => (isToolCallPart(part) || isToolResultPart(part)) && isExplorationTool(getToolName(part) ?? ''),
      );

      const firstExplorationId = getToolCallId(explorationParts[0]);
      const explorationSummary = summarizeExploration(explorationParts);

      return (
        <motion.div className="flex flex-col gap-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {orderedParts.map((part, index) => {
            if (part?.type === 'text' && typeof part.text === 'string') {
              const text = cleanTimelineText(part.text);
              return text.trim() ? (
                <div key={`text-${index}`} className="text-sm leading-6 text-bolt-elements-textPrimary">
                  <Markdown>{text}</Markdown>
                </div>
              ) : null;
            }

            if (!isToolCallPart(part) && !isToolResultPart(part)) {
              return null;
            }

            const toolName = getToolName(part) ?? '';
            const toolCallId = getToolCallId(part);

            if (isExplorationTool(toolName)) {
              if (toolCallId !== firstExplorationId) {
                return null;
              }

              return (
                <details key={`exploration-${toolCallId}`} className="text-sm" open>
                  <summary className="cursor-pointer list-none font-medium text-bolt-elements-textPrimary">
                    <span className="mr-2 inline-block text-bolt-elements-textSecondary">⌄</span>
                    {explorationSummary}
                  </summary>
                  <div className="ml-5 mt-2 flex flex-col gap-1 border-l border-bolt-elements-borderColor pl-3">
                    {explorationParts.map((item, itemIndex) => (
                      <ToolActivityRow
                        key={getToolCallId(item) ?? itemIndex}
                        tool={item}
                        running={runningToolCalls.has(getToolCallId(item) ?? '')}
                        fullAccess={fullAccess}
                        annotation={toolCallAnnotations.find((entry) => entry.toolCallId === getToolCallId(item))}
                      />
                    ))}
                  </div>
                </details>
              );
            }

            return (
              <ToolActivityRow
                key={toolCallId ?? index}
                tool={part}
                running={runningToolCalls.has(toolCallId ?? '')}
                fullAccess={fullAccess}
                annotation={toolCallAnnotations.find((entry) => entry.toolCallId === toolCallId)}
              />
            );
          })}
        </motion.div>
      );
    }

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
      >
        <ul className="list-none space-y-4">
          {toolInvocations.map((tool, index) => {
            if (!isToolCallPart(tool) && !isToolResultPart(tool)) {
              return null;
            }

            const toolCallId = getToolCallId(tool) as string;
            const toolName = getToolName(tool) ?? '';
            const annotation = toolCallAnnotations.find((annotation) => annotation.toolCallId === toolCallId);
            const isRunning = runningToolCalls.has(toolCallId);
            const state = getToolState(tool);
            const displayState = getToolDisplayState(tool);
            const error = getToolDisplayError(tool);

            return (
              <motion.li
                key={index}
                variants={toolVariants}
                initial="hidden"
                animate="visible"
                transition={{ duration: 0.2, ease: cubicEasingFn }}
              >
                <div className="py-1">
                  <div key={toolCallId} className="flex min-w-0 items-center gap-2 text-sm">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center text-bolt-elements-textSecondary">
                      {displayState === 'output-available' ? (
                        <span className="i-ph:check text-green-500" />
                      ) : displayState === 'output-error' ? (
                        <span className="i-ph:x text-red-500" />
                      ) : displayState === 'process-running' ? (
                        <span className="i-ph:play text-blue-500" />
                      ) : isRunning || state === 'input-streaming' ? (
                        <span className="i-svg-spinners:90-ring-with-bg" />
                      ) : (
                        <span className="i-ph:wrench" />
                      )}
                    </span>
                    <span
                      className="min-w-0 flex-1 truncate text-bolt-elements-textPrimary"
                      title={annotation?.toolDescription}
                    >
                      {activityLabel(toolName, getToolInput(tool), getToolOutput(tool), displayState)}
                    </span>
                    {state === 'input-available' && !fullAccess && !isServerAgentTool(toolName) && (
                      <span className="shrink-0 text-xs text-bolt-elements-textTertiary">Awaiting approval</span>
                    )}
                  </div>
                  {error && <p className="ml-7 mt-1 break-words text-xs text-red-500">{error}</p>}
                  <AgentPlanDetails tool={tool} />
                </div>
              </motion.li>
            );
          })}
        </ul>
      </motion.div>
    );
  },
);

function activityLabel(toolName: string, rawInput: unknown, rawOutput?: unknown, state?: string): string {
  const input = rawInput && typeof rawInput === 'object' ? (rawInput as Record<string, unknown>) : {};
  const output = rawOutput && typeof rawOutput === 'object' ? (rawOutput as Record<string, unknown>) : {};
  const path = typeof input.path === 'string' ? input.path : '';
  const shortPath = path.replace(/^\/home\/project\/?/, '');

  if (state === 'output-error') {
    if (toolName === 'agent_complete') {
      return output.blocked === true ? 'Task blocked' : 'Completion criteria not met';
    }

    return `Failed: ${typeof input.command === 'string' ? input.command : shortPath || toolName}`;
  }

  if (
    state === 'output-available' &&
    output.changed === false &&
    ['project_write_file', 'project_patch_file'].includes(toolName)
  ) {
    return `Unchanged ${shortPath || 'project file'}`;
  }

  switch (toolName) {
    case 'agent_plan':
      return 'Plan and completion criteria recorded';
    case 'agent_complete':
      return output.blocked === true
        ? 'Task blocked'
        : output.completed === true
          ? 'Completion criteria checked'
          : 'Checking completion criteria';
    case 'project_read_file':
      return `Read ${shortPath || 'project file'}`;
    case 'project_list_paths':
      return 'Listed project files';
    case 'project_search_content':
      return 'Searched project files';
    case 'project_find_related_files':
      return `Found related files${shortPath ? ` for ${shortPath}` : ''}`;
    case 'project_write_file':
      return `${output.created === true ? 'Created' : output.created === false ? 'Edited' : state === 'output-available' ? 'Wrote' : 'Writing'} ${shortPath || 'project file'}`;
    case 'project_patch_file':
      return `${state === 'output-available' ? 'Edited' : 'Editing'} ${shortPath || 'project file'}`;
    case 'project_create_directory':
      return `${state === 'output-available' ? 'Created' : 'Creating'} ${shortPath || 'project directory'}`;
    case 'project_delete_path':
      return `${state === 'output-available' ? 'Deleted' : 'Deleting'} ${shortPath || 'project path'}`;
    case 'project_run_command':
      return `${state === 'process-running' ? 'Started' : state === 'output-available' ? 'Finished' : 'Running'} ${typeof input.command === 'string' ? input.command : 'project command'}`;
    case 'project_get_process_output':
      return state === 'process-running'
        ? 'Command is still running'
        : state === 'output-available'
          ? 'Command finished'
          : 'Checking command output';
    case 'project_stop_process':
      return 'Stopping command';
    case 'web_search':
      return 'Searching the web';
    case 'web_fetch':
      return 'Opening a web page';
    default:
      return `Using ${toolName}`;
  }
}

function isExplorationTool(toolName: string): boolean {
  return ['project_read_file', 'project_list_paths', 'project_search_content', 'project_find_related_files'].includes(
    toolName,
  );
}

function AgentPlanDetails({ tool }: { tool: AnyPart }) {
  if (getToolName(tool) !== 'agent_plan') {
    return null;
  }

  const output = getToolOutput(tool) as { plan?: unknown } | undefined;

  if (!isAgentPlan(output?.plan)) {
    return null;
  }

  const plan = output.plan;

  return (
    <details className="ml-7 mt-1 text-xs text-bolt-elements-textSecondary">
      <summary className="cursor-pointer">View plan and completion criteria</summary>
      <p className="mt-2">{plan.goal}</p>
      <ol className="mt-2 list-decimal space-y-1 pl-4">
        {plan.steps.map((step, index) => (
          <li key={index}>{step}</li>
        ))}
      </ol>
      <p className="mt-2 font-medium">Completion criteria</p>
      <ul className="mt-1 list-disc space-y-1 pl-4">
        {plan.criteria.map((criterion) => (
          <li key={criterion.id}>{criterion.description}</li>
        ))}
      </ul>
    </details>
  );
}

function summarizeExploration(parts: AnyPart[]): string {
  const names = parts.map((part) => getToolName(part));
  const reads = names.filter((name) => name === 'project_read_file').length;
  const lists = names.filter((name) => name === 'project_list_paths').length;

  const searches = names.filter(
    (name) => name === 'project_search_content' || name === 'project_find_related_files',
  ).length;

  const counts = [
    reads ? `${reads} read${reads === 1 ? '' : 's'}` : '',
    lists ? `${lists} list${lists === 1 ? '' : 's'}` : '',
    searches ? `${searches} search${searches === 1 ? '' : 'es'}` : '',
  ].filter(Boolean);

  return `Explored ${counts.join(', ')}`;
}

function cleanTimelineText(text: string): string {
  return text
    .replace(/<boltAction\b[^>]*>[\s\S]*?(?:<\/boltAction>|$)/g, '')
    .replace(/<\/?boltArtifact\b[^>]*>/g, '')
    .replace(/<\/?boltAction\b[^>]*>/g, '');
}

function ToolActivityRow({
  tool,
  running,
  fullAccess,
  annotation,
}: {
  tool: AnyPart;
  running: boolean;
  fullAccess: boolean;
  annotation?: ToolCallAnnotation;
}) {
  const name = getToolName(tool) ?? '';
  const state = getToolState(tool);
  const displayState = getToolDisplayState(tool);

  const icon =
    name === 'project_read_file'
      ? 'i-ph:eye'
      : name === 'project_write_file' || name === 'project_create_directory'
        ? 'i-ph:file-plus'
        : name === 'project_patch_file'
          ? 'i-ph:pen'
          : name === 'project_delete_path'
            ? 'i-ph:trash'
            : 'i-ph:file';

  return (
    <div>
      <div className="flex min-w-0 items-center gap-2 py-0.5 text-sm">
        <span className="flex h-4 w-4 shrink-0 items-center justify-center text-bolt-elements-textSecondary">
          {displayState === 'output-available' ? (
            <span className="i-ph:check-circle-fill text-green-500" />
          ) : displayState === 'output-error' ? (
            <span className="i-ph:x-circle-fill text-red-500" />
          ) : displayState === 'process-running' ? (
            <span className="i-ph:play text-blue-500" />
          ) : running || state === 'input-streaming' ? (
            <span className="i-svg-spinners:90-ring-with-bg" />
          ) : (
            <span className={icon} />
          )}
        </span>
        <span className="min-w-0 flex-1 truncate text-bolt-elements-textPrimary" title={annotation?.toolDescription}>
          {activityLabel(name, getToolInput(tool), getToolOutput(tool), displayState)}
        </span>
        {state === 'input-available' && !fullAccess && !isServerAgentTool(name) && (
          <span className="shrink-0 text-xs text-bolt-elements-textTertiary">Approval needed</span>
        )}
      </div>
      {getToolDisplayError(tool) && (
        <p className="ml-7 mt-1 break-words text-xs text-red-500">{getToolDisplayError(tool)}</p>
      )}
      <AgentPlanDetails tool={tool} />
    </div>
  );
}
