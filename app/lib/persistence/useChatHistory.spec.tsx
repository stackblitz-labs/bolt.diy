import { act, renderHook, waitFor } from '@testing-library/react';
import type { UIMessage } from 'ai';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { resetWorkbench } = vi.hoisted(() => ({ resetWorkbench: vi.fn(async () => undefined) }));

/*
 * `~/lib/stores/workbench` and `~/lib/webcontainer` both read
 * `import.meta.hot.data`, which vitest does not provide. Mocking them keeps the
 * module graph loadable; the workbench is the subject under test here, so its
 * reset is asserted through the spy rather than through its internals.
 */
vi.mock('~/lib/stores/workbench', () => ({
  workbenchStore: {
    resetWorkbench,
    files: { get: () => ({}) },
    firstArtifact: undefined,
  },
}));

/*
 * The chat workbench never boots a container under test, so the promise stays
 * pending on purpose.
 */
vi.mock('~/lib/webcontainer', () => ({
  webcontainer: new Promise(() => undefined),
  webcontainerContext: { loaded: false },
}));

vi.mock('./db', () => ({
  openDatabase: vi.fn(async () => ({})),
  createChatWithNextId: vi.fn(async () => ({ id: '3' })),
  setMessages: vi.fn(async () => undefined),
  setSnapshot: vi.fn(async () => undefined),
  duplicateChat: vi.fn(async () => 'dupe'),
  createChatFromMessages: vi.fn(async () => 'imported'),
  getMessagesByIdRaw: vi.fn(async () => undefined),
  getMessagesByUrlIdRaw: vi.fn(async () => undefined),
}));

/*
 * Persisted chats, keyed by the route that shows them. The record's own id is
 * what identifies a chat, which is deliberately not the same as the route: a
 * chat that was just created gets a numeric id and is then routed to
 * /chat/<urlId>.
 */
const records: Record<string, { id: string; urlId: string }> = {
  'chat-a': { id: '1', urlId: 'chat-a' },
  'chat-b': { id: '2', urlId: 'chat-b' },
  3: { id: '3', urlId: '3' },
};

vi.mock('./chatCache', () => ({
  getCachedMessages: vi.fn(async (_db: unknown, routeId: string) => {
    const record = records[routeId];

    return {
      id: record?.id ?? routeId,
      urlId: record?.urlId ?? routeId,
      description: routeId,
      messages: [
        { id: `${routeId}-user`, role: 'user', parts: [{ type: 'text', text: 'hi' }] },
        { id: `${routeId}-assistant`, role: 'assistant', parts: [{ type: 'text', text: 'hello' }] },
      ] as UIMessage[],
    };
  }),
  getCachedSnapshot: vi.fn(async () => undefined),
  invalidateChatCache: vi.fn(),
}));

/*
 * The route the hook believes it is on. `searchParams` is memoised per search
 * string so the effect's dependency behaves the way it does under the router.
 */
let routeId: string | undefined = 'chat-a';
let routeSearch = '';

const searchParamsCache = new Map<string, URLSearchParams>();

/*
 * `navigate` is an effect dependency, so it has to keep its identity across
 * renders the way the router's does.
 */
const navigate = vi.fn((to: string, options?: { replace?: boolean }) => {
  if (options?.replace) {
    window.history.replaceState(window.history.state, '', to);
  }
});

const setSearchParams = vi.fn();

vi.mock('react-router', () => ({
  useNavigate: () => navigate,
  useLoaderData: () => undefined,
  useParams: () => ({ id: routeId }),
  useSearchParams: () => {
    let params = searchParamsCache.get(routeSearch);

    if (!params) {
      params = new URLSearchParams(routeSearch);
      searchParamsCache.set(routeSearch, params);
    }

    return [params, setSearchParams];
  },
}));

async function importHook() {
  return (await import('./useChatHistory')).useChatHistory;
}

describe('useChatHistory chat switching', () => {
  beforeEach(() => {
    resetWorkbench.mockClear();
    navigate.mockClear();
    routeId = 'chat-a';
    routeSearch = '';
    searchParamsCache.clear();
    window.history.replaceState(window.history.state, '', '/');

    /*
     * `openDatabase` bails out when there is no indexedDB, which would send the
     * hook down its "persistence unavailable" path instead of loading a chat.
     */
    vi.stubGlobal('indexedDB', {
      open: () => {
        const request: Record<string, unknown> = {};

        queueMicrotask(() => {
          request.result = {};
          (request.onsuccess as (event: unknown) => void)?.({ target: request });
        });

        return request;
      },
    });
  });

  it('should reset the workbench and the container when another chat is opened', async () => {
    const useChatHistory = await importHook();
    const { rerender, result } = renderHook(() => useChatHistory());

    await waitFor(() => expect(resetWorkbench).toHaveBeenCalledTimes(1));

    routeId = 'chat-b';
    rerender();

    await waitFor(() => expect(resetWorkbench).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.chatChanged).toBe(true));
  });

  it('should not reset the workbench when only the query string changes', async () => {
    const useChatHistory = await importHook();
    const { rerender } = renderHook(() => useChatHistory());

    await waitFor(() => expect(resetWorkbench).toHaveBeenCalledTimes(1));

    /*
     * A `?prompt=` navigation re-runs the effect for the same chat. Wiping the
     * workbench there would delete the project the chat is still on.
     */
    routeSearch = 'prompt=make%20a%20todo%20app';
    rerender();

    await waitFor(() => expect(resetWorkbench).toHaveBeenCalledTimes(1));
  });

  it('should reset the workbench and the container when leaving a chat for a fresh one', async () => {
    const useChatHistory = await importHook();
    const { rerender, result } = renderHook(() => useChatHistory());

    await waitFor(() => expect(resetWorkbench).toHaveBeenCalledTimes(1));

    routeId = undefined;
    rerender();

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(resetWorkbench).toHaveBeenCalledTimes(2);

    /*
     * The outgoing chat's parsed output has to go with it, otherwise the next
     * chat's messages are appended to it by index.
     */
    await waitFor(() => expect(result.current.chatChanged).toBe(true));
  });

  it('should not reset again while already on a fresh chat', async () => {
    const useChatHistory = await importHook();

    routeId = undefined;

    const { rerender, result } = renderHook(() => useChatHistory());

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(resetWorkbench).not.toHaveBeenCalled();

    routeSearch = 'prompt=make%20a%20todo%20app';
    rerender();

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(resetWorkbench).not.toHaveBeenCalled();
    expect(result.current.chatChanged).toBe(false);
  });

  /*
   * Persisting the first exchange of a new chat moves it to /chat/<id>, which the
   * router picks up. The live chat already owns the in-flight response, so its
   * route handoff must not reload or replace its messages.
   */
  it('should not reset when the route catches up with the chat just persisted', async () => {
    const useChatHistory = await importHook();

    routeId = undefined;

    const { rerender, result } = renderHook(() => useChatHistory());

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(resetWorkbench).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.storeMessageHistory([
        { id: 'new-1', role: 'assistant', content: 'built', parts: [{ type: 'text', text: 'built' }] } as any,
      ]);
    });

    expect(window.location.pathname).toBe('/chat/3');
    expect(navigate).toHaveBeenCalledWith('/chat/3', { replace: true });

    // The router re-renders now that it can see the new path.
    routeId = '3';
    rerender();

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(resetWorkbench).not.toHaveBeenCalled();
    expect(result.current.chatChanged).toBe(false);
    expect(result.current.initialMessages).toEqual([]);
  });
});
