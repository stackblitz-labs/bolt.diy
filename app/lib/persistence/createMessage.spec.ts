import { describe, expect, it } from 'vitest';
import {
  createMessage,
  getMessageAnnotations,
  getMessageFlags,
  getMessageText,
  isLegacyV4Message,
  migrateLegacyMessages,
} from './messageMigration';

describe('createMessage', () => {
  it('writes both content and parts so either shape can be read', () => {
    const message = createMessage({ id: 'm1', role: 'user', text: 'hello' });

    expect(message.content).toBe('hello');
    expect(message.parts).toEqual([{ type: 'text', text: 'hello' }]);
    expect(getMessageText(message)).toBe('hello');
  });

  it('is not detected as legacy, so it is not migrated twice', () => {
    expect(isLegacyV4Message(createMessage({ role: 'user', text: 'hi' }))).toBe(false);
  });

  it('generates an id when none is given', () => {
    const a = createMessage({ role: 'user', text: 'x' });
    const b = createMessage({ role: 'user', text: 'x' });

    expect(typeof a.id).toBe('string');
    expect(a.id).not.toBe(b.id);
  });

  it('mirrors flags into metadata and annotations', () => {
    const message = createMessage({ role: 'assistant', text: 'x', flags: ['hidden', 'no-store'] });

    expect(getMessageFlags(message)).toEqual(['hidden', 'no-store']);
    expect(message.annotations).toEqual(['hidden', 'no-store']);
  });

  it('omits metadata entirely when there are no flags', () => {
    expect(createMessage({ role: 'user', text: 'x' }).metadata).toBeUndefined();
  });

  it('gives an empty parts array for empty text rather than a blank part', () => {
    const message = createMessage({ role: 'user', text: '' });

    expect(message.parts).toEqual([]);
    expect(getMessageText(message)).toBe('');
  });

  it('round-trips through migrateLegacyMessages unchanged', () => {
    const original = createMessage({ id: 'm1', role: 'assistant', text: 'answer', flags: ['no-store'] });

    expect(migrateLegacyMessages([original])).toEqual([original]);
  });

  it('produces no annotations when none are passed', () => {
    expect(getMessageAnnotations(createMessage({ role: 'assistant', text: 'x' }))).toEqual([]);
  });
});
