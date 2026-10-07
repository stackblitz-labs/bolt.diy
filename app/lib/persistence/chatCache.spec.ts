import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCachedMessages, getCachedSnapshot, invalidateChatCache, prefetchChat } from './chatCache';
import * as dbModule from './db';

vi.mock('./db', () => ({
  getMessages: vi.fn(),
  getSnapshot: vi.fn(),
}));

describe('chatCache', () => {
  const fakeDb = {} as IDBDatabase;

  beforeEach(() => {
    invalidateChatCache();
    vi.clearAllMocks();
  });

  it('prefetches messages and snapshot into cache', async () => {
    const fakeChat = { id: 'c1', messages: [], timestamp: 'now' } as any;
    const fakeSnapshot = { chatIndex: 'm1', files: {} } as any;

    vi.mocked(dbModule.getMessages).mockResolvedValue(fakeChat);
    vi.mocked(dbModule.getSnapshot).mockResolvedValue(fakeSnapshot);

    prefetchChat(fakeDb, 'c1');

    expect(dbModule.getMessages).toHaveBeenCalledTimes(1);
    expect(dbModule.getSnapshot).toHaveBeenCalledTimes(1);

    // Subsequent getCached calls should use the cached promise without extra DB queries
    const messages = await getCachedMessages(fakeDb, 'c1');
    const snapshot = await getCachedSnapshot(fakeDb, 'c1');

    expect(messages).toEqual(fakeChat);
    expect(snapshot).toEqual(fakeSnapshot);
    expect(dbModule.getMessages).toHaveBeenCalledTimes(1);
    expect(dbModule.getSnapshot).toHaveBeenCalledTimes(1);
  });

  it('invalidates cache by id', async () => {
    const fakeChat1 = { id: 'c1', messages: [], timestamp: 'now' } as any;
    const fakeChat2 = { id: 'c2', messages: [], timestamp: 'now' } as any;

    vi.mocked(dbModule.getMessages).mockResolvedValueOnce(fakeChat1).mockResolvedValueOnce(fakeChat2);

    await getCachedMessages(fakeDb, 'c1');
    expect(dbModule.getMessages).toHaveBeenCalledTimes(1);

    invalidateChatCache('c1');

    await getCachedMessages(fakeDb, 'c1');
    expect(dbModule.getMessages).toHaveBeenCalledTimes(2);
  });

  it('does nothing when prefetching with undefined database or id', () => {
    prefetchChat(undefined, 'c1');
    prefetchChat(fakeDb, '');

    expect(dbModule.getMessages).not.toHaveBeenCalled();
    expect(dbModule.getSnapshot).not.toHaveBeenCalled();
  });
});
