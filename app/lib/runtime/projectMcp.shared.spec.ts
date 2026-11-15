import { describe, expect, it } from 'vitest';
import { getProjectToolNames } from './projectMcp.shared';

describe('getProjectToolNames', () => {
  it('includes both built-in web tools when web search is enabled', () => {
    const tools = getProjectToolNames(true);

    expect(tools).toContain('web_search');
    expect(tools).toContain('web_fetch');
  });

  it('omits both built-in web tools when web search is disabled', () => {
    const tools = getProjectToolNames(false);

    expect(tools).not.toContain('web_search');
    expect(tools).not.toContain('web_fetch');
    expect(tools).toContain('project_read_file');
  });
});
