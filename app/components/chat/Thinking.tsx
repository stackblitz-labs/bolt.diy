import { getMessageParts, getToolState, isToolPart, type AnyMessage } from '~/lib/persistence/messageMigration';

/** Waiting for the next model step counts as thinking, even without exposed reasoning. */
export function isModelThinking(messages: AnyMessage[], isStreaming: boolean): boolean {
  if (!isStreaming) {
    return false;
  }

  const lastMessage = messages[messages.length - 1];

  if (lastMessage?.role !== 'assistant') {
    return true;
  }

  const parts = getMessageParts(lastMessage) ?? [];
  const currentStep = parts.slice(parts.findLastIndex((part) => part.type === 'step-start') + 1);

  const activity = currentStep.findLast(
    (part) => part.type === 'reasoning' || part.type === 'text' || isToolPart(part),
  );

  if (!activity) {
    return true;
  }

  if (activity.type === 'reasoning') {
    return activity.state !== 'done';
  }

  if (activity.type === 'text') {
    return typeof activity.text !== 'string' || !activity.text.trim();
  }

  return ['output-available', 'output-error', 'output-denied'].includes(getToolState(activity) ?? '');
}

export function ThinkingIndicator() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 py-2 text-sm text-bolt-elements-textSecondary"
    >
      <span className="i-ph:brain h-4 w-4 shrink-0" aria-hidden="true" />
      <span>
        Thinking
        <span className="thinking-ellipsis" aria-hidden="true">
          <span>.</span>
          <span>.</span>
          <span>.</span>
        </span>
      </span>
    </div>
  );
}

export function ThinkingDetails({ text }: { text: string }) {
  if (!text.trim()) {
    return null;
  }

  return (
    <details className="mb-2 text-sm text-bolt-elements-textSecondary">
      <summary className="cursor-pointer hover:text-bolt-elements-textPrimary transition-colors">
        <span className="inline-flex items-center gap-2 align-middle">
          <span className="i-ph:brain h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Thinking</span>
        </span>
      </summary>
      <div className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap break-words pl-6 leading-relaxed">{text}</div>
    </details>
  );
}
