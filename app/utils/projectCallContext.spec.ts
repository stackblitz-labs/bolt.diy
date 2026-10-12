import { describe, expect, it } from 'vitest';
import { resolveProjectCallContext } from './projectCallContext';

describe('resolveProjectCallContext', () => {
  it('keeps a first-response tool call valid when the new chat receives its ID', () => {
    expect(resolveProjectCallContext({ generation: 4 }, { generation: 5, chatId: 'chat-1' }, false)).toEqual({
      generation: 5,
      chatId: 'chat-1',
    });
  });

  it('keeps a tool call tied to its unchanged project', () => {
    expect(
      resolveProjectCallContext({ generation: 5, chatId: 'chat-1' }, { generation: 5, chatId: 'chat-1' }, false),
    ).toEqual({ generation: 5, chatId: 'chat-1' });
  });

  it.each([
    [{ generation: 4 }, { generation: 5, chatId: 'chat-1' }, true],
    [{ generation: 4 }, { generation: 6, chatId: 'chat-1' }, false],
    [{ generation: 4, chatId: 'chat-1' }, { generation: 5, chatId: 'chat-2' }, false],
  ] as const)('rejects unrelated project changes', (origin, active, chatChanged) => {
    expect(resolveProjectCallContext(origin, active, chatChanged)).toBeUndefined();
  });
});
