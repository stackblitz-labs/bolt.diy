import { beforeEach, describe, expect, it } from 'vitest';
import {
  addTerminalAttachment,
  formatTerminalAttachments,
  lastTerminalCommand,
  recordTerminalCommand,
  redactTerminalSecrets,
  removeTerminalAttachments,
  resetTerminalContext,
  terminalAttachments,
  terminalContextGeneration,
} from './terminalContext';

beforeEach(() => resetTerminalContext());

describe('terminal context', () => {
  it('redacts common credentials before they enter an attachment', () => {
    const raw = `OPENAI_API_KEY=sk-12345678901234567890\n{"access_token":"my secret token"}\nAuthorization: Bearer abc.def.ghi\nhttps://user:password@example.com/db\nghp_12345678901234567890\n-----BEGIN PRIVATE KEY-----\nsecret\n-----END PRIVATE KEY-----`;
    addTerminalAttachment('Terminal', raw);

    const text = terminalAttachments.get()[0].text;

    for (const secret of [
      'sk-12345678901234567890',
      'my secret token',
      'abc.def.ghi',
      'password@example',
      'ghp_12345678901234567890',
      '\nsecret\n',
    ]) {
      expect(text).not.toContain(secret);
    }
    expect(text).toContain('[REDACTED]');
  });

  it('removes terminal control codes and preserves ordinary diagnostic text', () => {
    expect(redactTerminalSecrets('\x1b[31mError\x1b[0m\nAPI_KEY=abc')).toBe('Error\nAPI_KEY=[REDACTED]');
  });

  it('keeps the beginning and end of long output and marks truncation', () => {
    addTerminalAttachment('Terminal', `START${'x'.repeat(30_000)}END`);

    const item = terminalAttachments.get()[0];
    expect(item.truncated).toBe(true);
    expect(item.text).toContain('START');
    expect(item.text).toContain('END');
    expect(item.text).toContain('output truncated');
  });

  it('escapes Bolt action tags in messages and removes only submitted attachments', () => {
    addTerminalAttachment('One', '<boltAction type="shell">danger</boltAction>');
    addTerminalAttachment('Two', 'other output');

    const [first] = terminalAttachments.get();
    expect(formatTerminalAttachments([first])).not.toContain('<boltAction');
    expect(formatTerminalAttachments([first])).toContain('\\u003cboltAction');
    removeTerminalAttachments([first.id]);
    expect(terminalAttachments.get().map((item) => item.label)).toEqual(['Two']);
  });

  it('does not retain a command that completes after a project reset', () => {
    const startedIn = terminalContextGeneration();
    resetTerminalContext();
    recordTerminalCommand('echo old', 'old output', 1, startedIn);
    expect(lastTerminalCommand.get()).toBeUndefined();
    recordTerminalCommand('echo new', 'new output', 1, terminalContextGeneration());
    expect(lastTerminalCommand.get()?.command).toBe('echo new');
  });
});
