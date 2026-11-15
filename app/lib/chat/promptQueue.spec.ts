import { describe, expect, it } from 'vitest';
import { canDispatchQueuedPrompt, isQueueableResponse, moveQueuedPrompt } from './promptQueue';

describe('prompt queue ordering', () => {
  const prompts = [
    { id: 1, text: 'first' },
    { id: 2, text: 'second' },
    { id: 3, text: 'third' },
  ];

  it('moves an item without mutating the original queue', () => {
    expect(moveQueuedPrompt(prompts, 2, -1).map((item) => item.id)).toEqual([2, 1, 3]);
    expect(moveQueuedPrompt(prompts, 2, 1).map((item) => item.id)).toEqual([1, 3, 2]);
    expect(prompts.map((item) => item.id)).toEqual([1, 2, 3]);
  });

  it('ignores missing items and moves past either end', () => {
    expect(moveQueuedPrompt(prompts, 1, -1)).toBe(prompts);
    expect(moveQueuedPrompt(prompts, 3, 1)).toBe(prompts);
    expect(moveQueuedPrompt(prompts, 4, -1)).toBe(prompts);
  });
});

describe('prompt queue dispatch', () => {
  const ready = {
    cancelled: false,
    originalGeneration: 1,
    currentGeneration: 1,
    originalEpoch: 2,
    currentEpoch: 2,
    paused: false,
    ready: true,
    status: 'ready',
    preparing: false,
  };

  it('sends only after the current response and workbench preparation finish', () => {
    expect(canDispatchQueuedPrompt(ready)).toBe(true);
    expect(canDispatchQueuedPrompt({ ...ready, status: 'streaming' })).toBe(false);
    expect(canDispatchQueuedPrompt({ ...ready, preparing: true })).toBe(false);
    expect(canDispatchQueuedPrompt({ ...ready, ready: false })).toBe(false);
  });

  it('does not send after cancellation, edits, pause, or a chat change', () => {
    expect(canDispatchQueuedPrompt({ ...ready, cancelled: true })).toBe(false);
    expect(canDispatchQueuedPrompt({ ...ready, currentEpoch: 3 })).toBe(false);
    expect(canDispatchQueuedPrompt({ ...ready, currentGeneration: 2 })).toBe(false);
    expect(canDispatchQueuedPrompt({ ...ready, paused: true })).toBe(false);
  });

  it('waits for a tool step but advances after a subsequent text step', () => {
    const tool = { type: 'tool-read', state: 'input-available' };
    expect(isQueueableResponse([{ type: 'step-start' }, tool])).toBe(false);
    expect(
      isQueueableResponse([{ type: 'step-start' }, tool, { type: 'step-start' }, { type: 'text', text: 'Done' }]),
    ).toBe(true);
  });
});
