export interface QueuedPrompt {
  id: number;
  text: string;
}

/** Tool calls in an earlier completed step must not block the final text response. */
export function isQueueableResponse(parts: unknown[]): boolean {
  const lastStep = parts.reduce<number>((index, part, partIndex) => {
    return part && typeof part === 'object' && 'type' in part && part.type === 'step-start' ? partIndex : index;
  }, -1);

  return !parts.slice(lastStep + 1).some((part) => getToolState(part) !== undefined);
}

export function moveQueuedPrompt(items: QueuedPrompt[], id: number, direction: -1 | 1): QueuedPrompt[] {
  const index = items.findIndex((item) => item.id === id);
  const target = index + direction;

  if (index < 0 || target < 0 || target >= items.length) {
    return items;
  }

  const moved = [...items];
  [moved[index], moved[target]] = [moved[target], moved[index]];

  return moved;
}

export function canDispatchQueuedPrompt(options: {
  cancelled: boolean;
  originalGeneration: number;
  currentGeneration: number;
  originalEpoch: number;
  currentEpoch: number;
  paused: boolean;
  ready: boolean;
  status: string;
  preparing: boolean;
}): boolean {
  return (
    !options.cancelled &&
    options.originalGeneration === options.currentGeneration &&
    options.originalEpoch === options.currentEpoch &&
    !options.paused &&
    options.ready &&
    options.status === 'ready' &&
    !options.preparing
  );
}
import { getToolState } from '~/lib/persistence/messageMigration';
