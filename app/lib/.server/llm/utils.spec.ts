import { describe, expect, it } from 'vitest';
import { createFilesContext, extractCurrentContext, extractPropertiesFromMessage, simplifyBoltActions } from './utils';

const WORK_DIR = '/home/project';
const MODEL_REGEX = /^\[Model: (.*?)\]\n\n/;

function userMessage(content: unknown): { role: string; content: unknown } {
  return { role: 'user', content };
}

describe('extractPropertiesFromMessage', () => {
  it('extracts model and provider markers from string content', () => {
    const result = extractPropertiesFromMessage(
      userMessage('[Model: gpt-4o]\n\n[Provider: OpenRouter]\n\nbuild me a thing'),
    );

    expect(result).toEqual({ model: 'gpt-4o', provider: 'OpenRouter', content: 'build me a thing' });
  });

  it('falls back to defaults when no markers are present', () => {
    const result = extractPropertiesFromMessage(userMessage('just do the thing'));

    expect(result.model).toBe('claude-3-5-sonnet-latest');
    expect(result.provider).toBe('OpenRouter');
    expect(result.content).toBe('just do the thing');
  });

  it('strips markers out of every text part when content is a part array', () => {
    const result = extractPropertiesFromMessage(
      userMessage([
        { type: 'text', text: '[Model: gpt-4o]\n\n[Provider: OpenRouter]\n\nfirst' },
        { type: 'text', text: '[Model: gpt-4o]\n\nsecond' },
      ]),
    );

    expect(result.model).toBe('gpt-4o');
    expect(result.provider).toBe('OpenRouter');

    const parts = result.parts as Array<{ type: string; text: string }>;

    expect(parts).toHaveLength(2);
    expect(parts[0].text).toBe('first');
    expect(parts[1].text).toBe('second');
  });

  it('returns content as a string even when the message has parts', () => {
    /*
     * content previously came back as the part array while the signature claimed
     * string, so stream-text.ts:94 called .replace() on an array. Callers rely
     * on content being a string, so that is now pinned.
     */
    const result = extractPropertiesFromMessage(userMessage([{ type: 'text', text: '[Model: gpt-4o]\n\nhello' }]));

    expect(typeof result.content).toBe('string');
    expect(result.content).toBe('hello');
    expect(() => result.content.replace(MODEL_REGEX, '')).not.toThrow();
  });

  it('reads markers from v5 parts as well as v4 content', () => {
    const result = extractPropertiesFromMessage({
      role: 'user',
      parts: [{ type: 'text', text: '[Model: gpt-4o]\n\n[Provider: OpenRouter]\n\nfrom parts' }],
    });

    expect(result.model).toBe('gpt-4o');
    expect(result.provider).toBe('OpenRouter');
    expect(result.content).toBe('from parts');
  });

  it('preserves non-text parts such as images', () => {
    const result = extractPropertiesFromMessage(
      userMessage([
        { type: 'text', text: '[Model: gpt-4o]\n\nlook at this' },
        { type: 'image_url', image_url: { url: 'data:image/png;base64,AAA' } },
      ]),
    );

    const parts = result.parts as Array<{ type: string }>;

    expect(parts.map((part) => part.type)).toEqual(['text', 'image_url']);
  });

  it('only anchors the model marker at the start of the message', () => {
    /*
     * MODEL_REGEX is anchored with ^ but PROVIDER_REGEX is not, so a provider
     * marker anywhere in the body is treated as metadata and removed. Pinned
     * because the AI SDK migration changes how these markers are passed around
     * and an unintended strip silently corrupts user prompts.
     */
    const result = extractPropertiesFromMessage(
      userMessage('please explain this [Provider: Anthropic]\n\nsnippet in detail'),
    );

    expect(result.provider).toBe('Anthropic');
    expect(result.content).toBe('please explain this snippet in detail');
  });

  it('does not treat a mid-message model mention as metadata', () => {
    const result = extractPropertiesFromMessage(userMessage('compare this to [Model: gpt-4o] behaviour'));

    expect(result.model).toBe('claude-3-5-sonnet-latest');
    expect(result.content).toBe('compare this to [Model: gpt-4o] behaviour');
  });

  it('handles empty and undefined content without throwing', () => {
    expect(extractPropertiesFromMessage(userMessage('')).content).toBe('');
    expect(extractPropertiesFromMessage(userMessage(undefined)).content).toBe('');
  });
});

describe('simplifyBoltActions', () => {
  it('elides the body of file actions', () => {
    const input = '<boltAction type="file" filePath="a.ts">const a = 1;</boltAction>';

    expect(simplifyBoltActions(input)).toContain('...');
    expect(simplifyBoltActions(input)).not.toContain('const a = 1;');
  });

  it('leaves non-file actions untouched', () => {
    const input = '<boltAction type="start">npm run dev</boltAction>';

    expect(simplifyBoltActions(input)).toBe(input);
  });
});

describe('createFilesContext', () => {
  it('wraps file contents in a bolt artifact', () => {
    const context = createFilesContext({
      [`${WORK_DIR}/index.html`]: { type: 'file', content: '<h1>hi</h1>', isBinary: false },
    });

    expect(context).toContain('<boltArtifact id="code-content" title="Code Content"');
    expect(context).toContain('filePath="/home/project/index.html"');
    expect(context).toContain('<h1>hi</h1>');
  });

  it('strips the project prefix when relative paths are requested', () => {
    const context = createFilesContext(
      { [`${WORK_DIR}/index.html`]: { type: 'file', content: 'x', isBinary: false } },
      true,
    );

    expect(context).toContain('filePath="index.html"');
  });

  it('omits folders and ignored paths', () => {
    const context = createFilesContext({
      [`${WORK_DIR}/src`]: { type: 'folder' },
      [`${WORK_DIR}/node_modules/pkg/index.js`]: { type: 'file', content: 'vendor', isBinary: false },
    });

    expect(context).not.toContain('vendor');
  });
});

describe('extractCurrentContext', () => {
  const assistant = (annotations: unknown[]): { role: string; content: string; annotations: unknown[] } => ({
    role: 'assistant',
    content: 'done',
    annotations,
  });

  const assistantParts = (parts: unknown[]): { role: string; parts: unknown[] } => ({
    role: 'assistant',
    parts,
  });

  it('returns nothing when there is no assistant message', () => {
    expect(extractCurrentContext([{ role: 'user', content: 'hi' }])).toEqual({
      summary: undefined,
      codeContext: undefined,
    });
  });

  it('returns nothing when the assistant message has no annotations', () => {
    expect(extractCurrentContext([assistant([])])).toEqual({ summary: undefined, codeContext: undefined });
  });

  it('reads v5 data parts as well as v4 annotations', () => {
    expect(
      extractCurrentContext([assistantParts([{ type: 'data-chatSummary', data: { summary: 'we built a site' } }])])
        .summary,
    ).toEqual({ type: 'chatSummary', summary: 'we built a site' });

    expect(
      extractCurrentContext([assistantParts([{ type: 'data-codeContext', data: { files: ['a.ts'] } }])]).codeContext,
    ).toEqual({ type: 'codeContext', files: ['a.ts'] });
  });

  it('extracts a chat summary', () => {
    const annotations = [{ type: 'chatSummary', summary: 'we built a site' }];

    expect(extractCurrentContext([assistant(annotations)]).summary).toEqual(annotations[0]);
  });

  it('extracts a code context', () => {
    const annotations = [{ type: 'codeContext', files: ['a.ts'] }];

    expect(extractCurrentContext([assistant(annotations)]).codeContext).toEqual(annotations[0]);
  });

  it('skips null and malformed annotations', () => {
    const annotations = [null, 'nope', { noType: true }, { type: 'chatSummary', summary: 'found' }];

    expect(extractCurrentContext([assistant(annotations)]).summary).toEqual({ type: 'chatSummary', summary: 'found' });
  });

  it('only reads annotations from the most recent assistant message', () => {
    const older = assistant([{ type: 'chatSummary', summary: 'old' }]);
    const newer = assistant([{ type: 'chatSummary', summary: 'new' }]);

    expect(extractCurrentContext([older, newer]).summary).toEqual({ type: 'chatSummary', summary: 'new' });
  });

  it('stops at the first recognised annotation even if the other is missing', () => {
    /*
     * Known limitation: the scan breaks on the first match, so when a
     * codeContext annotation precedes the chatSummary the summary is never
     * found and chat summarization silently turns off. Pinned as current
     * behaviour so a future fix is a deliberate, visible change.
     */
    const annotations = [
      { type: 'codeContext', files: ['a.ts'] },
      { type: 'chatSummary', summary: 'never reached' },
    ];

    const result = extractCurrentContext([assistant(annotations)]);

    expect(result.codeContext).toEqual(annotations[0]);
    expect(result.summary).toBeUndefined();
  });
});
