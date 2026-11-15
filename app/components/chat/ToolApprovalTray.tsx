import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { isServerAgentTool } from '~/lib/common/agentLoop';
import {
  getMessageParts,
  getToolCallId,
  getToolInput,
  getToolName,
  getToolState,
  isToolCallPart,
  type AnyMessage,
} from '~/lib/persistence/messageMigration';
import { useToolAccessStore } from '~/lib/stores/toolAccess';
import { TOOL_EXECUTION_APPROVAL } from '~/utils/constants';

type ApprovalMessage = AnyMessage & { id?: string };
type ToolOutputHandler = (options: { tool: string; toolCallId: string; output: unknown }) => void;

export function ToolApprovalTray({
  messages = [],
  addToolOutput,
}: {
  messages?: ApprovalMessage[];
  addToolOutput: ToolOutputHandler;
}) {
  const fullAccess = useToolAccessStore((state) => state.mode === 'full-access');
  const [respondingIds, setRespondingIds] = useState<Set<string>>(new Set());

  const pending = useMemo(
    () =>
      messages.flatMap((message) =>
        (getMessageParts(message) ?? [])
          .filter(
            (part) =>
              isToolCallPart(part) && getToolState(part) === 'input-available' && !isServerAgentTool(getToolName(part)),
          )
          .map((part) => ({ id: getToolCallId(part), name: getToolName(part), input: getToolInput(part) }))
          .filter((tool): tool is { id: string; name: string; input: unknown } => Boolean(tool.id && tool.name)),
      ),
    [messages],
  );

  const respond = (tool: { id: string; name: string; input: unknown }, approved: boolean) => {
    if (respondingIds.has(tool.id)) {
      return;
    }

    setRespondingIds((ids) => new Set(ids).add(tool.id));
    addToolOutput({
      tool: tool.name,
      toolCallId: tool.id,
      output: approved ? TOOL_EXECUTION_APPROVAL.APPROVE : TOOL_EXECUTION_APPROVAL.REJECT,
    });
  };

  return (
    <AnimatePresence initial={false}>
      {!fullAccess && pending.length > 0 && (
        <motion.section
          key="tool-approval-tray"
          initial={{ opacity: 0, y: 24, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: 24, height: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 shadow-lg"
          aria-label="Tool approval requests"
        >
          <div className="px-3 py-2 text-sm text-bolt-elements-textSecondary">Accept these tool requests?</div>
          <ul className="divide-y divide-bolt-elements-borderColor">
            {pending.map((tool) => {
              const responding = respondingIds.has(tool.id);
              return (
                <li key={tool.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm text-bolt-elements-textPrimary">{tool.name}</span>
                    {approvalDetail(tool.name, tool.input) && (
                      <span className="truncate text-xs text-bolt-elements-textSecondary">
                        {approvalDetail(tool.name, tool.input)}
                      </span>
                    )}
                  </span>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      disabled={responding}
                      onClick={() => respond(tool, false)}
                      className="rounded-md border border-bolt-elements-borderColor px-3 py-1.5 text-xs text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary disabled:opacity-50"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      disabled={responding}
                      onClick={() => respond(tool, true)}
                      className="rounded-md bg-accent-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-600 disabled:opacity-50"
                    >
                      {responding ? 'Sending…' : 'Accept'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </motion.section>
      )}
    </AnimatePresence>
  );
}

function approvalDetail(name: string, rawInput: unknown): string | undefined {
  if (!rawInput || typeof rawInput !== 'object') {
    return undefined;
  }

  const input = rawInput as Record<string, unknown>;
  const path = typeof input.path === 'string' ? input.path.replace(/^\/home\/project\/?/, '') : undefined;
  const query = typeof input.query === 'string' ? input.query : undefined;
  const command = typeof input.command === 'string' ? input.command : undefined;
  const url = typeof input.url === 'string' ? input.url : undefined;
  const detail = path || query || command || url;

  return detail ? `${name === 'project_run_command' ? '$ ' : ''}${detail}` : undefined;
}
