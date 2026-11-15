import { useState } from 'react';
import type { QueuedPrompt } from '~/lib/chat/promptQueue';

export interface PromptQueueControls {
  items: QueuedPrompt[];
  paused: boolean;
  add: () => void;
  update: (id: number, text: string) => void;
  remove: (id: number) => void;
  move: (id: number, direction: -1 | 1) => void;
  resume: () => void;
  canAdd: boolean;
}

export function PromptQueue({ queue }: { queue: PromptQueueControls }) {
  const [expanded, setExpanded] = useState(true);

  if (queue.items.length === 0) {
    return null;
  }

  return (
    <div className="mb-2 rounded-lg border border-bolt-elements-borderColor p-2 text-sm text-bolt-elements-textPrimary">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
          Prompt queue ({queue.items.length}) {expanded ? '▴' : '▾'}
        </button>
        {queue.paused && <span className="text-bolt-elements-textSecondary">Paused</span>}
        {queue.paused && (
          <button type="button" onClick={queue.resume} className="ml-auto underline">
            Resume
          </button>
        )}
      </div>
      {expanded && (
        <ol className="mt-2 space-y-2">
          {queue.items.map((item, index) => (
            <li key={item.id} className="flex items-start gap-1">
              <textarea
                aria-label={`Queued prompt ${index + 1}`}
                className="min-w-0 flex-1 rounded border border-bolt-elements-borderColor bg-transparent p-1"
                value={item.text}
                onChange={(event) => queue.update(item.id, event.target.value)}
              />
              <button
                type="button"
                aria-label={`Move prompt ${index + 1} up`}
                disabled={index === 0}
                onClick={() => queue.move(item.id, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={`Move prompt ${index + 1} down`}
                disabled={index === queue.items.length - 1}
                onClick={() => queue.move(item.id, 1)}
              >
                ↓
              </button>
              <button type="button" aria-label={`Remove prompt ${index + 1}`} onClick={() => queue.remove(item.id)}>
                ×
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
