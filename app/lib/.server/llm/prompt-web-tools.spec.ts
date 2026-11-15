import { describe, expect, it } from 'vitest';
import { getWebResearchInstructions } from './prompt-web-tools';
import { withDevelopmentCommentaryWorkstyle } from './prompt-workstyle';

describe('web research tool instructions', () => {
  it('routes ordinary research to Browser Use when built-in search is disabled', () => {
    const prompt =
      withDevelopmentCommentaryWorkstyle('Build mode') +
      getWebResearchInstructions({
        browserUseToolNames: ['browser_task', 'get_task'],
        webToolNames: [],
      });

    expect(prompt).toContain('browser_task, get_task');
    expect(prompt).toContain('no special wording from the user is needed');
    expect(prompt).toContain('Research can happen at any stage in Build or Discuss mode');
    expect(prompt).not.toContain('web_search');
    expect(prompt).not.toContain('web_fetch');
  });

  it('describes only the built-in tools actually available when Browser Use is disabled', () => {
    const prompt = getWebResearchInstructions({ browserUseToolNames: [], webToolNames: ['web_search', 'web_fetch'] });

    expect(prompt).toContain('web_search, web_fetch');
    expect(prompt).not.toContain('Browser Use Cloud is enabled');
  });

  it('reports unavailable research when both sources are disabled', () => {
    const prompt = getWebResearchInstructions({ browserUseToolNames: [], webToolNames: [] });

    expect(prompt).toContain('No web research tools are available');
    expect(prompt).not.toContain('Browser Use Cloud is enabled');
  });
});
