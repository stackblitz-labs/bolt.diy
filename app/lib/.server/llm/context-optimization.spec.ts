import { describe, expect, it } from 'vitest';
import { getRecentChatStart, shouldOptimizeRequestContext } from './context-optimization';

describe('request context optimization', () => {
  const request = { enabled: true, agentLoopEnabled: false, isInitialTemplateRequest: false, hasFiles: true };

  it('retains native agent tool history without extra summary and selection requests', () => {
    expect(shouldOptimizeRequestContext({ ...request, agentLoopEnabled: true })).toBe(false);
  });

  it('preserves ordinary context optimization when enabled', () => {
    expect(shouldOptimizeRequestContext(request)).toBe(true);
    expect(shouldOptimizeRequestContext({ ...request, enabled: false })).toBe(false);
    expect(shouldOptimizeRequestContext({ ...request, hasFiles: false })).toBe(false);
    expect(shouldOptimizeRequestContext({ ...request, isInitialTemplateRequest: true })).toBe(false);
  });

  it('retains the user request when its first tool result arrives', () => {
    expect(getRecentChatStart([{ role: 'user' }, { role: 'assistant' }])).toBe(0);
  });

  it('summarizes older turns while keeping the active turn with all its tool results', () => {
    const roles = ['user', 'assistant', 'user', 'assistant', 'assistant', 'assistant', 'assistant'];
    expect(getRecentChatStart(roles.map((role) => ({ role })))).toBe(2);
  });
});
