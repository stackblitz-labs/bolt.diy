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
    const fakeChat = { id: 'c1', urlId: 'public-c1', messages: [], timestamp: 'now' } as any;
    const fakeSnapshot = { chatIndex: 'm1', files: {} } as any;

    vi.mocked(dbModule.getMessages).mockResolvedValue(fakeChat);
    vi.mocked(dbModule.getSnapshot).mockResolvedValue(fakeSnapshot);

    prefetchChat(fakeDb, 'public-c1');

    expect(dbModule.getMessages).toHaveBeenCalledTimes(1);

    // Subsequent getCached calls should use the cached promise without extra DB queries
    const messages = await getCachedMessages(fakeDb, 'public-c1');
    const snapshot = await getCachedSnapshot(fakeDb, 'c1');

    expect(messages).toEqual(fakeChat);
    expect(snapshot).toEqual(fakeSnapshot);
    expect(dbModule.getMessages).toHaveBeenCalledTimes(1);
    expect(dbModule.getSnapshot).toHaveBeenCalledTimes(1);
    expect(dbModule.getSnapshot).toHaveBeenCalledWith(fakeDb, 'c1');
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

  it('retries a message read after a transient failure', async () => {
    const chat = { id: 'c1', messages: [] } as any;
    vi.mocked(dbModule.getMessages).mockRejectedValueOnce(new Error('transient')).mockResolvedValueOnce(chat);

    await expect(getCachedMessages(fakeDb, 'c1')).rejects.toThrow('transient');
    await expect(getCachedMessages(fakeDb, 'c1')).resolves.toEqual(chat);
    expect(dbModule.getMessages).toHaveBeenCalledTimes(2);
  });

  it('retries a failed prefetched snapshot', async () => {
    const snapshot = { chatIndex: 'm1', files: {} } as any;
    vi.mocked(dbModule.getMessages).mockResolvedValue({ id: 'c1', messages: [] } as any);
    vi.mocked(dbModule.getSnapshot).mockRejectedValueOnce(new Error('transient')).mockResolvedValueOnce(snapshot);

    prefetchChat(fakeDb, 'c1');
    await getCachedMessages(fakeDb, 'c1');

    // Allow the prefetch rejection observer to evict the failed snapshot.
    await Promise.resolve();

    await expect(getCachedSnapshot(fakeDb, 'c1')).resolves.toEqual(snapshot);
    expect(dbModule.getSnapshot).toHaveBeenCalledTimes(2);
  });

  it('retries a directly requested snapshot after a failure', async () => {
    vi.mocked(dbModule.getSnapshot).mockRejectedValueOnce(new Error('transient')).mockResolvedValueOnce(undefined);

    await expect(getCachedSnapshot(fakeDb, 'c1')).rejects.toThrow('transient');
    await expect(getCachedSnapshot(fakeDb, 'c1')).resolves.toBeUndefined();
    expect(dbModule.getSnapshot).toHaveBeenCalledTimes(2);
  });

  it('does not evict a replacement read when an invalidated read rejects late', async () => {
    let rejectOld!: (error: Error) => void;

    const oldRead = new Promise<any>((_, reject) => {
      rejectOld = reject;
    });

    const chat = { id: 'c1', messages: [] } as any;
    vi.mocked(dbModule.getMessages).mockReturnValueOnce(oldRead).mockResolvedValueOnce(chat);

    const oldResult = getCachedMessages(fakeDb, 'c1');
    const failure = expect(oldResult).rejects.toThrow('old failure');
    invalidateChatCache('c1');
    await expect(getCachedMessages(fakeDb, 'c1')).resolves.toEqual(chat);
    rejectOld(new Error('old failure'));
    await failure;

    await expect(getCachedMessages(fakeDb, 'c1')).resolves.toEqual(chat);
    expect(dbModule.getMessages).toHaveBeenCalledTimes(2);
  });

  it('does nothing when prefetching with undefined database or id', () => {
    prefetchChat(undefined, 'c1');
    prefetchChat(fakeDb, '');

    expect(dbModule.getMessages).not.toHaveBeenCalled();
    expect(dbModule.getSnapshot).not.toHaveBeenCalled();
  });
});
