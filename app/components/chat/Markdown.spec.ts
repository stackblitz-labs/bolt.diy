import { vi } from 'vitest';

vi.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: any) => children,
}));

vi.mock('./Markdown.module.scss', () => ({}));

vi.mock('~/utils/markdown', () => ({
  allowedHTMLElements: [],
  remarkPlugins: () => [],
  rehypePlugins: () => [],
}));

// Prevent provider registry ESM imports during tests
vi.mock('ollama-ai-provider', () => ({}));
vi.mock('@ai-sdk/provider-utils', () => ({}));
vi.mock('@smithy/core', () => ({
  __esModule: true,
  getSmithyContext: () => ({}),
}));

const stripCodeFenceFromArtifact = (content: string) => {
  if (!content || !content.includes('__boltArtifact__')) {
    return content;
  }

  const lines = content.split('\n');
  const artifactLineIndex = lines.findIndex((line) => line.includes('__boltArtifact__'));

  if (artifactLineIndex === -1) {
    return content;
  }

  if (artifactLineIndex > 0 && lines[artifactLineIndex - 1]?.trim().match(/^```\w*$/)) {
    lines[artifactLineIndex - 1] = '';
  }

  if (artifactLineIndex < lines.length - 1 && lines[artifactLineIndex + 1]?.trim().match(/^```$/)) {
    lines[artifactLineIndex + 1] = '';
  }

  return lines.join('\n');
};
import { describe, expect, it } from 'vitest';

describe('stripCodeFenceFromArtifact', () => {
  it('should remove code fences around artifact element', () => {
    const input = "```xml\n<div class='__boltArtifact__'></div>\n```";
    const expected = "\n<div class='__boltArtifact__'></div>\n";
    expect(stripCodeFenceFromArtifact(input)).toBe(expected);
  });

  it('should handle code fence with language specification', () => {
    const input = "```typescript\n<div class='__boltArtifact__'></div>\n```";
    const expected = "\n<div class='__boltArtifact__'></div>\n";
    expect(stripCodeFenceFromArtifact(input)).toBe(expected);
  });

  it('should not modify content without artifacts', () => {
    const input = '```\nregular code block\n```';
    expect(stripCodeFenceFromArtifact(input)).toBe(input);
  });

  it('should handle empty input', () => {
    expect(stripCodeFenceFromArtifact('')).toBe('');
  });

  it('should handle artifact without code fences', () => {
    const input = "<div class='__boltArtifact__'></div>";
    expect(stripCodeFenceFromArtifact(input)).toBe(input);
  });

  it('should handle multiple artifacts but only remove fences around them', () => {
    const input = [
      'Some text',
      '```typescript',
      "<div class='__boltArtifact__'></div>",
      '```',
      '```',
      'regular code',
      '```',
    ].join('\n');

    const expected = ['Some text', '', "<div class='__boltArtifact__'></div>", '', '```', 'regular code', '```'].join(
      '\n',
    );

    expect(stripCodeFenceFromArtifact(input)).toBe(expected);
  });
});
