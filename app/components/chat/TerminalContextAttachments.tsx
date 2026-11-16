import { useStore } from '@nanostores/react';
import { removeTerminalContext, terminalContextAttachments } from '~/lib/stores/terminalContext';

const KIND_LABELS = {
  selection: 'selection',
  'last-lines': 'recent output',
  session: 'session output',
  command: 'command output',
  error: 'failed command',
} as const;

export function TerminalContextAttachments() {
  const attachments = useStore(terminalContextAttachments);

  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1 mx-1.5 mb-2">
      {attachments.map((attachment) => (
        <details
          key={attachment.id}
          className="group rounded-md border border-bolt-elements-borderColor bg-bolt-elements-background-depth-3 text-xs text-bolt-elements-textSecondary"
        >
          <summary className="flex cursor-pointer list-none items-center gap-2 px-2.5 py-2">
            <div className="i-ph:terminal-window text-base text-bolt-elements-textTertiary" />
            <span className="min-w-0 flex-1 truncate">
              {attachment.terminalName} · {KIND_LABELS[attachment.kind]} · {attachment.lineCount} lines · ~
              {attachment.tokenEstimate.toLocaleString()} tokens
            </span>
            <span className="i-ph:caret-down text-xs group-open:rotate-180" />
            <button
              type="button"
              title="Remove terminal context"
              aria-label={`Remove ${attachment.terminalName} terminal context`}
              className="rounded p-1 text-bolt-elements-textTertiary hover:bg-bolt-elements-item-backgroundActive hover:text-bolt-elements-textPrimary"
              onClick={(event) => {
                event.preventDefault();
                removeTerminalContext(attachment.id);
              }}
            >
              <span className="i-ph:x" />
            </button>
          </summary>
          {attachment.command && (
            <div className="border-t border-bolt-elements-borderColor px-2.5 py-2 font-mono text-bolt-elements-textPrimary">
              $ {attachment.command}
              {attachment.exitCode !== undefined && ` (exit ${attachment.exitCode})`}
            </div>
          )}
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words border-t border-bolt-elements-borderColor px-2.5 py-2 font-mono text-[11px]">
            {attachment.text}
          </pre>
        </details>
      ))}
    </div>
  );
}
