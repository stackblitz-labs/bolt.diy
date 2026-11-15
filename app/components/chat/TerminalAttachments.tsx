import { useStore } from '@nanostores/react';
import { removeTerminalAttachments, terminalAttachments } from '~/lib/stores/terminalContext';

export function TerminalAttachments() {
  const items = useStore(terminalAttachments);

  if (!items.length) {
    return null;
  }

  return (
    <div className="space-y-1 text-xs text-bolt-elements-textPrimary">
      {items.map((item) => (
        <details
          key={item.id}
          className="rounded border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 p-2"
        >
          <summary className="cursor-pointer">
            {item.label} · {item.lines} lines · ~{item.estimatedTokens} tokens{item.truncated ? ' · truncated' : ''}
          </summary>
          <p className="mt-2 text-bolt-elements-textSecondary">
            Common secrets are redacted. Review for other sensitive data before sending.
          </p>
          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all">{item.text}</pre>
          <button type="button" className="mt-2 underline" onClick={() => removeTerminalAttachments([item.id])}>
            Remove
          </button>
        </details>
      ))}
    </div>
  );
}
