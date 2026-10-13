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

  it('should preserve existing workstyle and append MCP guidance only once', () => {
    const basePrompt = 'You are an AI assistant.\n\n<workstyle>\nExisting instructions\n</workstyle>';
    const enhanced = withDevelopmentCommentaryWorkstyle(basePrompt);

    expect(enhanced).toContain('<workstyle>\nExisting instructions\n</workstyle>');
    expect(enhanced.match(/<workstyle>/g)).toHaveLength(1);
    expect(enhanced).toContain('<project_mcp_workflow>');
    expect(withDevelopmentCommentaryWorkstyle(enhanced)).toBe(enhanced);
  });

  it('instructs follow-ups to preserve unrelated files and use exact patches', () => {
    const prompt = withDevelopmentCommentaryWorkstyle('Build the requested app.');
    expect(prompt).toContain('Follow-up requests must preserve the existing project');
    expect(prompt).toContain('Edit only files needed for the request');
    expect(prompt).toContain("supplying exact oldText and the read result's revision as expectedRevision");
    expect(prompt).toContain('replacementReason explaining why a targeted patch is insufficient');
    expect(prompt).toContain('Reuse a live preview server on follow-ups');
  });
});
