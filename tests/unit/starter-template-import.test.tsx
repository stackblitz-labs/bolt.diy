import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StarterTemplateImport } from '~/components/chat/StarterTemplateImport.client';
import StarterTemplates from '~/components/chat/StarterTemplates';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  searchParams: new URLSearchParams('template=Vite React'),
  getTemplates: vi.fn(),
  createChatFromMessages: vi.fn(),
  db: {},
}));

vi.mock('react-router', () => ({
  useNavigate: () => mocks.navigate,
  useSearchParams: () => [mocks.searchParams],
}));
vi.mock('~/lib/persistence', () => ({ db: mocks.db }));
vi.mock('~/lib/persistence/db', () => ({ createChatFromMessages: mocks.createChatFromMessages }));
vi.mock('~/utils/selectStarterTemplate', () => ({ getTemplates: mocks.getTemplates }));
vi.mock('~/utils/constants', () => ({
  STARTER_TEMPLATES: [{ name: 'Vite React', label: 'React', githubRepo: 'example/react-starter' }],
}));

describe('homepage starter project import', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.searchParams = new URLSearchParams('template=Vite React');
    mocks.createChatFromMessages.mockResolvedValue('react-starter');
    mocks.getTemplates.mockResolvedValue({
      assistantMessage:
        '<boltArtifact id="imported-files"><boltAction type="file" filePath="package.json">{}</boltAction><boltAction type="start">npm run dev</boltAction></boltArtifact>',
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('routes the homepage icon to template creation instead of Git cloning', () => {
    render(<StarterTemplates />);
    expect(screen.getByRole('link', { name: 'Start a blank React app' }).getAttribute('href')).toBe(
      '/starter?template=Vite%20React',
    );
  });

  it('persists template files and setup actions before navigating to a new project', async () => {
    render(<StarterTemplateImport />);
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/chat/react-starter', { replace: true }));
    expect(mocks.getTemplates).toHaveBeenCalledWith('Vite React', 'React starter', expect.any(AbortSignal));
    const [database, title, messages] = mocks.createChatFromMessages.mock.calls[0];
    expect(database).toBe(mocks.db);
    expect(title).toBe('React starter');
    expect(messages[0].role).toBe('user');
    expect(messages[1].parts[0].text).toContain('filePath="package.json"');
    expect(messages[1].parts[0].text).toContain('type="start"');
  });

  it('shows a failed fetch and allows retrying without creating an empty project', async () => {
    mocks.getTemplates.mockRejectedValueOnce(new Error('Template fetch failed'));
    render(<StarterTemplateImport />);
    await screen.findByRole('alert');
    expect(screen.getByRole('alert').textContent).toBe('Template fetch failed');
    expect(mocks.createChatFromMessages).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalled());
    expect(mocks.createChatFromMessages).toHaveBeenCalledTimes(1);
  });

  it('shows storage failures instead of leaving the loading overlay indefinitely', async () => {
    mocks.createChatFromMessages.mockRejectedValueOnce(new Error('Project storage failed'));
    render(<StarterTemplateImport />);
    expect((await screen.findByRole('alert')).textContent).toBe('Project storage failed');
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('ends a stalled request with a timeout and a retry button', async () => {
    vi.useFakeTimers();
    mocks.getTemplates.mockImplementation(
      (_name, _title, signal: AbortSignal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('Aborted')));
        }),
    );
    render(<StarterTemplateImport />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(screen.getByRole('alert').textContent).toContain('timed out');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    expect(mocks.createChatFromMessages).not.toHaveBeenCalled();
  });

  it('does not persist or navigate when the user leaves during loading', async () => {
    let resolveTemplate!: (value: { assistantMessage: string }) => void;
    mocks.getTemplates.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveTemplate = resolve;
        }),
    );
    const { unmount } = render(<StarterTemplateImport />);
    unmount();
    await act(async () => {
      resolveTemplate({ assistantMessage: 'Template files' });
    });
    expect(mocks.createChatFromMessages).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('rejects an unknown starter without fetching or creating a project', async () => {
    mocks.searchParams = new URLSearchParams('template=unknown');
    render(<StarterTemplateImport />);
    expect((await screen.findByRole('alert')).textContent).toContain('Choose a starter template');
    expect(mocks.getTemplates).not.toHaveBeenCalled();
    expect(mocks.createChatFromMessages).not.toHaveBeenCalled();
  });
});
