import type { PathWatcherEvent, WebContainer } from '@webcontainer/api';
import { afterEach, expect, it, vi } from 'vitest';
import { FilesStore } from './files';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('publishes a watcher burst once and ignores unchanged file events', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('self', globalThis);

  let emit!: (events: PathWatcherEvent[]) => void;

  const watchPaths = vi.fn((_options, listener: typeof emit) => {
    emit = listener;
  });

  const container = { internal: { watchPaths } } as unknown as WebContainer;
  const store = new FilesStore(Promise.resolve(container));
  await Promise.resolve();

  const onChange = vi.fn();
  const unsubscribe = store.files.listen(onChange);
  const folder = '/home/project/src';
  const nestedFile = folder + '/index.ts';
  const sibling = '/home/project/src-utils.ts';
  const buffer = new TextEncoder().encode('export {};');

  const event = (type: PathWatcherEvent['type'], path: string, content?: Uint8Array): PathWatcherEvent => ({
    type,
    path,
    buffer: content,
    mtime: 0,
    ino: 0,
  });

  emit([event('add_dir', folder + '/'), event('add_file', nestedFile, buffer)]);
  emit([event('add_file', sibling, buffer)]);
  await vi.advanceTimersByTimeAsync(100);

  expect(onChange).toHaveBeenCalledTimes(1);
  expect(store.filesCount).toBe(2);

  const originalSibling = store.getFile(sibling);

  emit([event('change', nestedFile, buffer), event('add_dir', folder)]);
  await vi.advanceTimersByTimeAsync(100);
  expect(onChange).toHaveBeenCalledTimes(1);

  emit([event('remove_dir', folder), event('remove_file', nestedFile)]);
  await vi.advanceTimersByTimeAsync(100);
  expect(onChange).toHaveBeenCalledTimes(2);
  expect(store.getFileOrFolder(folder)).toBeUndefined();
  expect(store.getFile(nestedFile)).toBeUndefined();
  expect(store.getFile(sibling)).toBe(originalSibling);
  expect(store.filesCount).toBe(1);

  unsubscribe();
});
