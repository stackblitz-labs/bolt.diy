import { describe, expect, it } from 'vitest';
import { withDevelopmentCommentaryWorkstyle } from './prompt-workstyle';

describe('withDevelopmentCommentaryWorkstyle', () => {
  it('should append <workstyle> block when not already present', () => {
    const basePrompt = 'You are an AI assistant.';
    const enhanced = withDevelopmentCommentaryWorkstyle(basePrompt);

    expect(enhanced).toContain(basePrompt);
    expect(enhanced).toContain('<workstyle>');
    expect(enhanced).toContain('</workstyle>');
    expect(enhanced).toContain('provide frequent short progress updates in plain English Markdown');
    expect(enhanced).toContain('Keep runtime load lightweight in WebContainer');
  });

  it('should be idempotent and not append <workstyle> if already present', () => {
    const basePrompt = 'You are an AI assistant.\n\n<workstyle>\nExisting instructions\n</workstyle>';
    const enhanced = withDevelopmentCommentaryWorkstyle(basePrompt);

    expect(enhanced).toBe(basePrompt);
  });
});
