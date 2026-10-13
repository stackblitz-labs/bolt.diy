import type { UIMessage } from 'ai';
import { describe, expect, it } from 'vitest';
import { prepareModelMessages } from './model-messages';

describe('prepareModelMessages', () => {
  it('preserves consecutive completed tool calls when the recent context has no text messages', async () => {
    const messages: UIMessage[] = Array.from({ length: 3 }, (_, index) => ({
      id: `assistant-${index}`,
      role: 'assistant',

      // Tool-only assistant replies have empty legacy content in persisted chats.
      content: '',
      parts: [
        {
          type: 'tool-project_list_paths',
          toolCallId: `call-${index}`,
          state: 'output-available',
          input: {},
          output: { entries: [{ path: 'package.json', type: 'file' }] },
        },
      ],
    }));

    const result = await prepareModelMessages(messages);

    expect(result.map((message) => message.role)).toEqual([
      'assistant',
      'tool',
      'assistant',
      'tool',
      'assistant',
      'tool',
    ]);
    expect(result[0].content).toEqual([
      expect.objectContaining({ type: 'tool-call', toolCallId: 'call-0', toolName: 'project_list_paths' }),
    ]);
    expect(result[5].content).toEqual([expect.objectContaining({ type: 'tool-result', toolCallId: 'call-2' })]);
  });

  it('preserves a user request while dropping empty assistant messages', async () => {
    const result = await prepareModelMessages([
      { id: 'user', role: 'user', parts: [{ type: 'text', text: 'Start the preview' }] },
      { id: 'empty', role: 'assistant', parts: [] },
    ]);

    expect(result).toEqual([{ role: 'user', content: [{ type: 'text', text: 'Start the preview' }] }]);
  });

  it('drops interrupted tool calls so a later user request does not require missing tool results', async () => {
    const result = await prepareModelMessages([
      { id: 'user', role: 'user', parts: [{ type: 'text', text: 'Start the preview' }] },
      {
        id: 'interrupted',
        role: 'assistant',
        parts: [
          {
            type: 'tool-project_run_command',
            toolCallId: 'unfinished',
            state: 'input-available',
            input: { command: 'npm run dev', purpose: 'run' },
          },
        ],
      },
      { id: 'retry', role: 'user', parts: [{ type: 'text', text: 'Continue the preview' }] },
    ]);

    expect(result.map((message) => message.role)).toEqual(['user', 'user']);
    expect(JSON.stringify(result)).not.toContain('unfinished');
  });
});
