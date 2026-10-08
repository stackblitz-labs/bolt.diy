import { act, render } from '@testing-library/react';
import { map } from 'nanostores';
import { describe, expect, it, vi } from 'vitest';
import { Artifact } from './Artifact';
import type { ArtifactState } from '~/lib/stores/workbench';

/*
 * Hoisted above the imports, and nanostores is imported inside it because the
 * factory runs before the file's own imports are initialised.
 */
const { artifacts } = await vi.hoisted(async () => {
  const { map } = await import('nanostores');

  return { artifacts: map<Record<string, unknown>>({}) };
});

/*
 * `~/lib/stores/workbench` reads `import.meta.hot.data`, which vitest does not
 * provide, so only the members this component touches are stubbed.
 */
vi.mock('~/lib/stores/workbench', () => ({
  workbenchStore: {
    artifacts,
    showWorkbench: { get: () => false, set: vi.fn() },
    currentView: { get: () => 'code', set: vi.fn() },
    setSelectedFile: vi.fn(),
  },
}));

function artifactState(id: string, title: string) {
  return {
    id,
    title,
    closed: true,

    // Not bundled, so the title is rendered as-is instead of the setup status.
    type: 'text',
    runner: { actions: map({}) },
  } as unknown as ArtifactState;
}

describe('Artifact', () => {
  /*
   * The artifact id is parsed out of the rendered message text, while the
   * artifacts map is filled by a parse pass that runs after render. They are out
   * of step for a render or two whenever the workbench is emptied, e.g. when
   * another chat is opened, and that must not take the tree down.
   */
  it('should render nothing when the workbench has no entry for the id yet', () => {
    artifacts.set({});

    const { container } = render(<Artifact messageId="message-1" artifactId="artifact-1" />);

    expect(container).toBeEmptyDOMElement();
  });

  it('should render the artifact once its entry arrives', () => {
    artifacts.set({ 'artifact-1': artifactState('artifact-1', 'Project A') });

    const { container } = render(<Artifact messageId="message-1" artifactId="artifact-1" />);

    expect(container).toHaveTextContent('Project A');
  });

  it('should survive its entry being emptied out from under it', () => {
    const { rerender, container } = render(<Artifact messageId="message-1" artifactId="artifact-1" />);

    act(() => {
      artifacts.set({ 'artifact-1': artifactState('artifact-1', 'Project A') });
    });
    rerender(<Artifact messageId="message-1" artifactId="artifact-1" />);

    expect(container).toHaveTextContent('Project A');

    // What a chat switch looks like to this component.
    act(() => {
      artifacts.set({});
    });
    rerender(<Artifact messageId="message-1" artifactId="artifact-1" />);

    expect(container).toBeEmptyDOMElement();
  });
});
