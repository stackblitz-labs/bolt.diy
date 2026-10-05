import { describe, expect, it } from 'vitest';
import {
  getMessageText,
  isLegacyV4Message,
  migrateLegacyMessage,
  migrateLegacyMessages,
  type LegacyV4Message,
} from './messageMigration';

const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUg==';

function v4(overrides: Partial<LegacyV4Message> = {}): LegacyV4Message {
  return { id: 'm1', role: 'assistant', content: '', ...overrides };
}

describe('isLegacyV4Message', () => {
  it('flags a message with no parts', () => {
    expect(isLegacyV4Message({ id: 'm1', role: 'user', content: 'hi' })).toBe(true);
  });

  it('flags nested tool invocations, v4 reasoning, source and file parts', () => {
    expect(isLegacyV4Message({ parts: [{ type: 'tool-invocation', toolInvocation: {} }] })).toBe(true);
    expect(isLegacyV4Message({ parts: [{ type: 'reasoning', reasoning: 'x' }] })).toBe(true);
    expect(isLegacyV4Message({ parts: [{ type: 'source', source: { url: 'u' } }] })).toBe(true);
    expect(isLegacyV4Message({ parts: [{ type: 'file', mimeType: 'image/png', data: 'x' }] })).toBe(true);
  });

  it('passes through an already-v7 message', () => {
    expect(isLegacyV4Message({ id: 'm1', role: 'assistant', parts: [{ type: 'text', text: 'hi' }] })).toBe(false);
  });

  it('passes through v7 tool parts that are already flat', () => {
    expect(
      isLegacyV4Message({ parts: [{ type: 'tool-bash', toolCallId: 'tc1', input: {}, state: 'output-available' }] }),
    ).toBe(false);
  });

  it('rejects non-objects and parts that are not arrays', () => {
    expect(isLegacyV4Message(null)).toBe(false);
    expect(isLegacyV4Message('hi')).toBe(false);
    expect(isLegacyV4Message({ parts: 'nope' })).toBe(false);
  });
});

describe('migrateLegacyMessage: content', () => {
  it('converts string content into a text part', () => {
    const result = migrateLegacyMessage(v4({ role: 'user', content: 'hello' }));

    expect(result.parts).toEqual([{ type: 'text', text: 'hello' }]);
    expect(result.role).toBe('user');
  });

  it('drops content when parts already carry the text', () => {
    const result = migrateLegacyMessage(v4({ content: 'stale', parts: [{ type: 'text', text: 'fresh' }] }));

    expect(result.parts).toEqual([{ type: 'text', text: 'fresh' }]);
  });

  it('omits an empty text part rather than emitting a blank one', () => {
    expect(migrateLegacyMessage(v4({ content: '' })).parts).toEqual([]);
  });
});

describe('migrateLegacyMessage: tool invocations', () => {
  it('flattens the nesting and puts the tool name in the discriminant', () => {
    const result = migrateLegacyMessage(
      v4({
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: { toolCallId: 'tc1', toolName: 'bash', args: { cmd: 'ls' }, state: 'result', result: 'ok' },
          },
        ],
      }),
    );

    expect(result.parts).toEqual([
      { type: 'tool-bash', toolCallId: 'tc1', input: { cmd: 'ls' }, output: 'ok', state: 'output-available' },
    ]);
  });

  it.each([
    ['partial-call', 'input-streaming'],
    ['call', 'input-available'],
    ['result', 'output-available'],
  ] as const)('maps tool state %s to %s', (from, to) => {
    const result = migrateLegacyMessage(
      v4({
        parts: [
          { type: 'tool-invocation', toolInvocation: { toolCallId: 'tc1', toolName: 'bash', args: {}, state: from } },
        ],
      }),
    );

    expect((result.parts[0] as { state?: string }).state).toBe(to);
  });

  it('omits output for unfinished invocations', () => {
    const result = migrateLegacyMessage(
      v4({
        parts: [
          { type: 'tool-invocation', toolInvocation: { toolCallId: 'tc1', toolName: 'bash', args: {}, state: 'call' } },
        ],
      }),
    );

    expect(result.parts[0]).not.toHaveProperty('output');
  });

  it('synthesizes tool parts from deprecated top-level toolInvocations', () => {
    const result = migrateLegacyMessage(
      v4({
        content: 'text',
        toolInvocations: [{ toolCallId: 'tc1', toolName: 'bash', args: {}, state: 'result', result: 1 }],
      }),
    );

    expect(result.parts).toEqual([
      { type: 'tool-bash', toolCallId: 'tc1', input: {}, output: 1, state: 'output-available' },
      { type: 'text', text: 'text' },
    ]);
  });
});

describe('migrateLegacyMessage: file parts', () => {
  it('rebuilds a full data URL from bare base64', () => {
    const result = migrateLegacyMessage(v4({ parts: [{ type: 'file', mimeType: 'image/png', data: PNG_BASE64 }] }));

    expect(result.parts[0]).toEqual({
      type: 'file',
      mediaType: 'image/png',
      filename: undefined,
      url: `data:image/png;base64,${PNG_BASE64}`,
    });
  });

  it('leaves an already-prefixed data URL untouched', () => {
    const url = `data:image/png;base64,${PNG_BASE64}`;
    const result = migrateLegacyMessage(v4({ parts: [{ type: 'file', mimeType: 'image/png', url }] }));

    expect((result.parts[0] as { url: string }).url).toBe(url);
  });

  it('produces a url that new URL() can parse, which bare base64 cannot', () => {
    const result = migrateLegacyMessage(v4({ parts: [{ type: 'file', mimeType: 'image/png', data: PNG_BASE64 }] }));

    expect(() => new URL((result.parts[0] as { url: string }).url)).not.toThrow();
    expect(() => new URL(PNG_BASE64)).toThrow();
  });

  it('converts experimental_attachments, whose url is already a data URL', () => {
    const url = `data:image/png;base64,${PNG_BASE64}`;

    const result = migrateLegacyMessage(
      v4({ content: 'look', experimental_attachments: [{ name: 'a.png', contentType: 'image/png', url }] }),
    );

    expect(result.parts).toEqual([
      { type: 'text', text: 'look' },
      { type: 'file', mediaType: 'image/png', filename: 'a.png', url },
    ]);
  });
});

describe('migrateLegacyMessage: reasoning and source', () => {
  it('renames reasoning.reasoning to reasoning.text', () => {
    expect(migrateLegacyMessage(v4({ parts: [{ type: 'reasoning', reasoning: 'because' }] })).parts).toEqual([
      { type: 'reasoning', text: 'because' },
    ]);
  });

  it('drops empty reasoning parts', () => {
    expect(migrateLegacyMessage(v4({ parts: [{ type: 'reasoning', reasoning: '' }] })).parts).toEqual([]);
  });

  it('synthesizes reasoning from the deprecated top-level field', () => {
    expect(migrateLegacyMessage(v4({ reasoning: 'thought', content: 'x' })).parts).toEqual([
      { type: 'reasoning', text: 'thought' },
      { type: 'text', text: 'x' },
    ]);
  });

  it('splits source into source-url', () => {
    expect(
      migrateLegacyMessage(v4({ parts: [{ type: 'source', source: { id: 's1', url: 'https://x.dev', title: 'X' } }] }))
        .parts,
    ).toEqual([{ type: 'source-url', sourceId: 's1', url: 'https://x.dev', title: 'X' }]);
  });
});

describe('migrateLegacyMessage: annotations', () => {
  it('converts object annotations into data parts without the type key', () => {
    const result = migrateLegacyMessage(
      v4({ content: 'x', annotations: [{ type: 'chatSummary', summary: 's', chatId: 'c1' }] }),
    );

    expect(result.parts).toContainEqual({
      type: 'data-chatSummary',
      data: { summary: 's', chatId: 'c1' },
    });
  });

  it('moves string sentinels to metadata.flags instead of a data part', () => {
    const result = migrateLegacyMessage(v4({ content: 'x', annotations: ['no-store', 'hidden'] }));

    expect(result.metadata?.flags).toEqual(['no-store', 'hidden']);
    expect(result.parts.some((part) => part.type.startsWith('data-'))).toBe(false);
  });

  it('handles a mixed annotation array', () => {
    const result = migrateLegacyMessage(
      v4({ content: 'x', annotations: ['no-store', { type: 'usage', value: { totalTokens: 5 } }] }),
    );

    expect(result.metadata?.flags).toEqual(['no-store']);
    expect(result.parts).toContainEqual({ type: 'data-usage', data: { value: { totalTokens: 5 } } });
  });

  it('omits metadata entirely when there are no flags', () => {
    expect(migrateLegacyMessage(v4({ content: 'x' })).metadata).toBeUndefined();
  });
});

describe('migrateLegacyMessage: misc', () => {
  it('preserves Bolt-owned fields', () => {
    const result = migrateLegacyMessage(v4({ content: 'x', name: 'bolt', function_call: { a: 1 }, timestamp: 42 }));

    expect(result).toMatchObject({ name: 'bolt', function_call: { a: 1 }, timestamp: 42 });
  });

  it('maps the deprecated data role to assistant and keeps its payload', () => {
    const result = migrateLegacyMessage({ id: 'm', role: 'data', content: 'x', data: { k: 'v' } });

    expect(result.role).toBe('assistant');
    expect(result.parts).toContainEqual({ type: 'data-message', data: { k: 'v' } });
  });

  it('keeps step-start parts', () => {
    expect(migrateLegacyMessage(v4({ parts: [{ type: 'step-start' }] })).parts).toEqual([{ type: 'step-start' }]);
  });

  it('is idempotent: migrating a migrated message changes nothing', () => {
    const once = migrateLegacyMessage(
      v4({
        content: 'hi',
        annotations: ['hidden', { type: 'progress', label: 'l' }],
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: { toolCallId: 'tc1', toolName: 'bash', args: {}, state: 'result', result: 1 },
          },
          { type: 'file', mimeType: 'image/png', data: PNG_BASE64 },
        ],
      }),
    );

    const twice = migrateLegacyMessages([once]);

    expect(twice[0].parts).toEqual(once.parts);
  });
});

describe('migrateLegacyMessages', () => {
  it('migrates only the legacy entries and leaves v7 ones untouched', () => {
    const v7 = { id: 'new', role: 'assistant' as const, parts: [{ type: 'text', text: 'keep' }] };

    expect(migrateLegacyMessages([{ id: 'old', role: 'user', content: 'convert' }, v7])).toEqual([
      { id: 'old', role: 'user', parts: [{ type: 'text', text: 'convert' }] },
      v7,
    ]);
  });

  it('returns an empty array for non-array input', () => {
    expect(migrateLegacyMessages(null)).toEqual([]);
    expect(migrateLegacyMessages('nope')).toEqual([]);
  });
});

describe('getMessageText', () => {
  it('joins text parts and ignores everything else', () => {
    const message = migrateLegacyMessage(
      v4({
        parts: [
          { type: 'reasoning', reasoning: 'skip' },
          { type: 'text', text: 'a' },
          { type: 'tool-bash', toolCallId: 'tc1' },
          { type: 'text', text: 'b' },
        ],
      }),
    );

    expect(getMessageText(message)).toBe('ab');
  });

  it('returns an empty string when there is no text', () => {
    expect(getMessageText({ parts: [{ type: 'step-start' }] })).toBe('');
  });
});
