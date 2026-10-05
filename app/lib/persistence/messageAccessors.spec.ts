import { describe, expect, it } from 'vitest';
import {
  getFileMediaType,
  getFileUrl,
  getMessageAnnotations,
  getMessageFlags,
  getMessageText,
  getToolCallId,
  getToolInput,
  getToolName,
  getToolOutput,
  getToolState,
  hasMessageFlag,
  isFilePart,
  isToolCallPart,
  isToolPart,
  isToolResultPart,
} from './messageMigration';

/*
 * Every accessor must behave identically for a v4 message and its v5
 * equivalent. That equivalence is what lets call sites migrate one file at a
 * time while the app is still on ai@4.
 */

const PNG = 'iVBORw0KGgoAAAANSUhEUg==';

describe('getMessageText: v4 and v5 agree', () => {
  it('reads v5 parts', () => {
    expect(
      getMessageText({
        parts: [
          { type: 'text', text: 'a' },
          { type: 'text', text: 'b' },
        ],
      }),
    ).toBe('ab');
  });

  it('reads v4 string content', () => {
    expect(getMessageText({ content: 'ab' })).toBe('ab');
  });

  it('reads v4 content-as-part-array', () => {
    expect(
      getMessageText({
        content: [
          { type: 'text', text: 'a' },
          { type: 'text', text: 'b' },
        ],
      }),
    ).toBe('ab');
  });

  it('prefers parts when both are present', () => {
    expect(getMessageText({ content: 'stale', parts: [{ type: 'text', text: 'fresh' }] })).toBe('fresh');
  });

  it('skips non-text parts', () => {
    expect(
      getMessageText({
        parts: [
          { type: 'reasoning', text: 'no' },
          { type: 'text', text: 'yes' },
          { type: 'file', mediaType: 'x' },
        ],
      }),
    ).toBe('yes');
  });

  it('returns empty string rather than throwing on missing content', () => {
    expect(getMessageText({})).toBe('');
    expect(getMessageText({ content: undefined })).toBe('');
    expect(getMessageText({ content: null })).toBe('');
    expect(getMessageText({ parts: [] })).toBe('');
  });
});

describe('tool accessors: v4 nested and v5 flat agree', () => {
  const v4 = {
    type: 'tool-invocation',
    toolInvocation: { toolCallId: 'tc1', toolName: 'bash', args: { cmd: 'ls' }, state: 'result', result: 'ok' },
  };

  const v5 = { type: 'tool-bash', toolCallId: 'tc1', input: { cmd: 'ls' }, output: 'ok', state: 'output-available' };

  it('isToolPart accepts both', () => {
    expect(isToolPart(v4)).toBe(true);
    expect(isToolPart(v5)).toBe(true);
    expect(isToolPart({ type: 'text' })).toBe(false);
    expect(isToolPart(undefined)).toBe(false);
  });

  it('getToolName accepts both', () => {
    expect(getToolName(v4)).toBe('bash');
    expect(getToolName(v5)).toBe('bash');
    expect(getToolName({ type: 'text' })).toBeUndefined();
  });

  it('getToolCallId accepts both', () => {
    expect(getToolCallId(v4)).toBe('tc1');
    expect(getToolCallId(v5)).toBe('tc1');
  });

  it('getToolInput/getToolOutput accept both', () => {
    expect(getToolInput(v4)).toEqual({ cmd: 'ls' });
    expect(getToolInput(v5)).toEqual({ cmd: 'ls' });
    expect(getToolOutput(v4)).toBe('ok');
    expect(getToolOutput(v5)).toBe('ok');
  });

  it('getToolState normalises v4 states onto v5 values', () => {
    expect(getToolState({ toolInvocation: { state: 'call' } })).toBe('input-available');
    expect(getToolState({ toolInvocation: { state: 'partial-call' } })).toBe('input-streaming');
    expect(getToolState({ toolInvocation: { state: 'result' } })).toBe('output-available');
  });

  it('getToolState passes v5 states through unchanged', () => {
    for (const state of [
      'input-available',
      'input-streaming',
      'output-available',
      'output-error',
      'output-denied',
      'approval-requested',
    ]) {
      expect(getToolState({ type: 'tool-x', state })).toBe(state);
    }
  });

  it('isToolCallPart agrees across shapes for the same logical state', () => {
    expect(isToolCallPart({ toolInvocation: { state: 'call' } })).toBe(true);
    expect(isToolCallPart({ type: 'tool-x', state: 'input-available' })).toBe(true);
    expect(isToolCallPart({ toolInvocation: { state: 'partial-call' } })).toBe(true);
    expect(isToolCallPart({ type: 'tool-x', state: 'input-streaming' })).toBe(true);
    expect(isToolCallPart({ toolInvocation: { state: 'result' } })).toBe(false);
  });

  it('isToolResultPart agrees across shapes', () => {
    expect(isToolResultPart({ toolInvocation: { state: 'result' } })).toBe(true);
    expect(isToolResultPart({ type: 'tool-x', state: 'output-available' })).toBe(true);
    expect(isToolResultPart({ type: 'tool-x', state: 'output-error' })).toBe(true);
    expect(isToolResultPart({ type: 'tool-x', state: 'output-denied' })).toBe(true);
    expect(isToolResultPart({ toolInvocation: { state: 'call' } })).toBe(false);
  });

  it('tolerates a dynamic-tool part', () => {
    const dynamic = { type: 'dynamic-tool', toolName: 'bash', toolCallId: 'tc9', state: 'output-available' };

    expect(isToolPart(dynamic)).toBe(false);
    expect(getToolName(dynamic)).toBe('bash');
  });
});

describe('file accessors: v4 bare base64 and v5 data URL agree', () => {
  it('isFilePart accepts both', () => {
    expect(isFilePart({ type: 'file', mimeType: 'image/png', data: PNG })).toBe(true);
    expect(isFilePart({ type: 'file', mediaType: 'image/png', url: `data:image/png;base64,${PNG}` })).toBe(true);
    expect(isFilePart({ type: 'text' })).toBe(false);
  });

  it('getFileMediaType accepts mimeType and mediaType', () => {
    expect(getFileMediaType({ type: 'file', mimeType: 'image/png' })).toBe('image/png');
    expect(getFileMediaType({ type: 'file', mediaType: 'image/png' })).toBe('image/png');
  });

  it('getFileUrl rebuilds a data URL from v4 bare base64', () => {
    expect(getFileUrl({ type: 'file', mimeType: 'image/png', data: PNG })).toBe(`data:image/png;base64,${PNG}`);
  });

  it('getFileUrl passes a v5 data URL through', () => {
    const url = `data:image/png;base64,${PNG}`;
    expect(getFileUrl({ type: 'file', mediaType: 'image/png', url })).toBe(url);
  });

  it('getFileUrl output is always parseable by new URL', () => {
    expect(() => new URL(getFileUrl({ type: 'file', mimeType: 'image/png', data: PNG }) as string)).not.toThrow();
    expect(() => new URL(PNG)).toThrow();
  });

  it('getFileUrl returns undefined for non-file parts', () => {
    expect(getFileUrl({ type: 'text', text: 'x' })).toBeUndefined();
  });
});

describe('getMessageFlags: v4 annotations and v5 metadata agree', () => {
  it('reads v5 metadata.flags', () => {
    expect(getMessageFlags({ metadata: { flags: ['no-store', 'hidden'] } })).toEqual(['no-store', 'hidden']);
  });

  it('reads v4 string annotations', () => {
    expect(getMessageFlags({ annotations: ['no-store', 'hidden'] })).toEqual(['no-store', 'hidden']);
  });

  it('ignores non-string annotation entries', () => {
    expect(getMessageFlags({ annotations: ['no-store', { type: 'usage' }] })).toEqual(['no-store']);
  });

  it('prefers metadata.flags when both exist', () => {
    expect(getMessageFlags({ metadata: { flags: ['hidden'] }, annotations: ['no-store'] })).toEqual(['hidden']);
  });

  it('returns empty when neither is present', () => {
    expect(getMessageFlags({})).toEqual([]);
    expect(getMessageFlags({ annotations: [{ type: 'usage' }] })).toEqual([]);
  });

  it('hasMessageFlag works across both shapes', () => {
    expect(hasMessageFlag({ metadata: { flags: ['no-store'] } }, 'no-store')).toBe(true);
    expect(hasMessageFlag({ annotations: ['no-store'] }, 'no-store')).toBe(true);
    expect(hasMessageFlag({ annotations: ['hidden'] }, 'no-store')).toBe(false);
  });
});

describe('getMessageAnnotations: v4 objects and v5 data parts agree', () => {
  it('reads v5 data parts', () => {
    expect(
      getMessageAnnotations({ parts: [{ type: 'data-chatSummary', data: { summary: 's', chatId: 'c1' } }] }),
    ).toEqual([{ type: 'chatSummary', summary: 's', chatId: 'c1' }]);
  });

  it('reads v4 object annotations', () => {
    expect(getMessageAnnotations({ annotations: [{ type: 'chatSummary', summary: 's', chatId: 'c1' }] })).toEqual([
      { type: 'chatSummary', summary: 's', chatId: 'c1' },
    ]);
  });

  it('produces the same result for equivalent v4 and v5 messages', () => {
    const v4 = { annotations: [{ type: 'usage', value: { totalTokens: 5 } }] };
    const v5 = { parts: [{ type: 'data-usage', data: { value: { totalTokens: 5 } } }] };

    expect(getMessageAnnotations(v5)).toEqual(getMessageAnnotations(v4));
  });

  it('prefers data parts when both are present', () => {
    expect(
      getMessageAnnotations({
        parts: [{ type: 'data-chatSummary', data: { summary: 'new' } }],
        annotations: [{ type: 'chatSummary', summary: 'old' }],
      })[0].summary,
    ).toBe('new');
  });

  it('drops string sentinels, which are flags not annotations', () => {
    expect(getMessageAnnotations({ annotations: ['no-store', { type: 'usage' }] })).toEqual([{ type: 'usage' }]);
  });

  it('returns empty for nothing', () => {
    expect(getMessageAnnotations({})).toEqual([]);
  });
});
