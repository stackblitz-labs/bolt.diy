import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMessageParser } from './useMessageParser';

const { addArtifact } = vi.hoisted(() => ({ addArtifact: vi.fn() }));

/*
 * `~/lib/stores/workbench` reads `import.meta.hot.data`, which vitest does not
 * provide, so it is replaced with just the callbacks the parser drives.
 */
vi.mock('~/lib/stores/workbench', () => ({
  workbenchStore: {
    showWorkbench: { set: vi.fn() },
    addArtifact,
    updateArtifact: vi.fn(),
    addAction: vi.fn(),
    runAction: vi.fn(),
  },
}));

const artifactText = (id: string, filePath: string) =>
  `<boltArtifact id="${id}" title="${id}" type="bundled">
  <boltAction type="file" filePath="${filePath}">
const value = 1;
  </boltAction>
</boltArtifact>`;

describe('useMessageParser.resetParsedMessages', () => {
  beforeEach(() => {
    addArtifact.mockClear();
  });

  it('should clear the rendered output of the chat being left', () => {
    const { result } = renderHook(() => useMessageParser());

    act(() => {
      result.current.parseMessages([{ id: 'a-1', role: 'assistant', content: 'project a' } as any], false);
    });

    expect(result.current.parsedMessages[0]).toBe('project a');

    act(() => {
      result.current.resetParsedMessages();
    });

    expect(result.current.parsedMessages).toEqual({});
  });

  /*
   * The parser only emits each artifact and action once per message id, so
   * without a reset the incoming chat would be parsed into an empty workbench.
   */
  it('should replay the callbacks so a reset workbench is repopulated', () => {
    const { result } = renderHook(() => useMessageParser());

    const message = { id: 'b-1', role: 'assistant', content: artifactText('artifact-b', '/b.ts') } as any;

    act(() => {
      result.current.resetParsedMessages();
      result.current.parseMessages([message], false);
    });

    expect(addArtifact).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.resetParsedMessages();
      result.current.parseMessages([message], false);
    });

    expect(addArtifact).toHaveBeenCalledTimes(2);
  });
});
