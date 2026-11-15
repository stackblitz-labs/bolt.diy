import { describe, expect, it } from 'vitest';
import { PromptLibrary } from '~/lib/common/prompt-library';

describe('default native tool prompt', () => {
  const options = { cwd: '/home/project', allowedHtmlElements: [], modificationTagName: 'modifications' };

  it('uses one execution protocol and respects simple requests', () => {
    const prompt = PromptLibrary.getPropmtFromLibrary('default', {
      ...options,
      projectTools: true,
      supabase: { isConnected: true, hasSelectedProject: true },
    });
    expect(prompt).toContain('Use the supplied native tools interface');
    expect(prompt).toContain('A simple or minimal page should stay simple');
    expect(prompt).not.toContain('<boltArtifact');
    expect(prompt).not.toContain('<boltAction');
    expect(prompt).not.toContain('bespoke masterpieces');
    expect(prompt).toContain('row-level security');
  });

  it('retains the legacy prompt for builds without the agent tools', () => {
    expect(PromptLibrary.getPropmtFromLibrary('default', options)).toContain('<boltArtifact');
  });
});
