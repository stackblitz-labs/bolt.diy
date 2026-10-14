import type { WebContainer } from '@webcontainer/api';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PreviewsStore } from './previews';

type PortListener = (port: number, type: 'open' | 'close', url: string) => void;

describe('PreviewsStore refresh lifecycle', () => {
  let store: PreviewsStore;
  let portEvent: PortListener;
  let frame: FrameRequestCallback;

  const previewUrl = 'https://test.local-credentialless.webcontainer-api.io';

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.stubGlobal('BroadcastChannel', undefined);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frame = callback;

      return 1;
    });

    const webcontainer = {
      on: vi.fn((event: string, callback: PortListener) => {
        if (event === 'port') {
          portEvent = callback;
        }
      }),
    } as unknown as WebContainer;

    store = new PreviewsStore(Promise.resolve(webcontainer));
    await Promise.resolve();
    portEvent(3000, 'open', previewUrl);
  });

  afterEach(() => {
    store.reset();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function startRefresh() {
    store.refreshPreview('test');
    vi.advanceTimersByTime(300);
    expect(store.previews.get()[0].ready).toBe(false);
  }

  it('marks an existing preview ready after refresh', () => {
    startRefresh();
    frame(0);

    expect(store.previews.get()).toEqual([{ port: 3000, ready: true, baseUrl: previewUrl }]);
  });

  it('does not resurrect a port closed before the refresh frame', () => {
    startRefresh();
    portEvent(3000, 'close', previewUrl);
    frame(0);

    expect(store.previews.get()).toEqual([]);
  });

  it('preserves a port opened during the pending refresh', () => {
    startRefresh();
    portEvent(4000, 'open', 'https://new.local-credentialless.webcontainer-api.io');
    frame(0);

    expect(store.previews.get().map((preview) => preview.port)).toEqual([3000, 4000]);
    expect(store.previews.get().every((preview) => preview.ready)).toBe(true);
  });

  it('does not restore previews after a project reset', () => {
    startRefresh();
    store.reset();
    frame(0);

    expect(store.previews.get()).toEqual([]);
  });

  it('does not overwrite a reopened port with an older preview object', () => {
    startRefresh();
    portEvent(3000, 'close', previewUrl);

    const newUrl = 'https://replacement.local-credentialless.webcontainer-api.io';
    portEvent(3000, 'open', newUrl);
    frame(0);

    expect(store.previews.get()).toEqual([{ port: 3000, ready: true, baseUrl: newUrl }]);
  });
});
