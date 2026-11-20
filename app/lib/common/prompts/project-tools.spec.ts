import { describe, expect, it } from 'vitest';
import { PromptLibrary } from '~/lib/common/prompt-library';

describe('native tool prompt', () => {
  const options = { cwd: '/home/project', allowedHtmlElements: [], modificationTagName: 'modifications' };

  it.each(PromptLibrary.getList().map(({ id }) => id))('uses native tool instructions for %s builds', (id) => {
    const prompt = PromptLibrary.getPromptFromLibrary(id, {
      ...options,
      projectTools: true,
      supabase: { isConnected: true, hasSelectedProject: true },
    });
    expect(prompt).toContain('Use the supplied native tools interface');
    expect(prompt).toContain('Start each targeted edit with project_read_file and numbered: true');
    expect(prompt).toContain('Use project_replace_lines with path, numeric startLine and endLine');
    expect(prompt).toContain('Use project_patch_file with oldText only as a fallback');
    expect(prompt).toContain('A simple or minimal page should stay simple');
    expect(prompt).not.toContain('<boltArtifact');
    expect(prompt).not.toContain('<boltAction');
    expect(prompt).not.toContain('bespoke masterpieces');
    expect(prompt).toContain('row-level security');
  });

  it('retains the legacy prompt for builds without project tools', () => {
    expect(PromptLibrary.getPromptFromLibrary('default', options)).toContain('<boltArtifact');
  });
});
