import { describe, expect, it } from 'vitest';
import { PromptLibrary } from './prompt-library';

const options = {
  cwd: '/home/project',
  allowedHtmlElements: [],
  modificationTagName: 'modifications',
};

describe('PromptLibrary.getPromptFromLibrary', () => {
  it('resolves a registered template', () => {
    expect(PromptLibrary.getPromptFromLibrary('default', options)).toContain('<boltArtifact');
  });

  /*
   * Prompt ids live in localStorage across releases, so a renamed or removed id
   * is a stale preference. It must not abort the request.
   */
  it('falls back to the default template for a stale prompt id', () => {
    expect(PromptLibrary.getPromptFromLibrary('og-prompt', options)).toBe(
      PromptLibrary.getPromptFromLibrary('default', options),
    );
  });
});
