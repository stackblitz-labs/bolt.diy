import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('~/lib/services/crawlerAgent.server', () => ({
  executeCrawl: vi.fn(),
  persistCrawlResult: vi.fn(),
}));

vi.mock('~/lib/services/internalPlacesClient.server', () => {
  class InternalPlacesClientError extends Error {
    constructor(
      message: string,
      public statusCode = 500,
      public crawlError: { code: string; message: string } | null = null,
    ) {
      super(message);
      this.name = 'InternalPlacesClientError';
    }

    isQuotaExceeded() {
      return this.statusCode === 429 || this.crawlError?.code === 'QUOTA_EXCEEDED';
    }

    isClientError() {
      return this.statusCode >= 400 && this.statusCode < 500;
    }

    isServerError() {
      return this.statusCode >= 500;
    }
  }

  return {
    InternalPlacesClientError,
  };
});

import {
  collectInputs,
  extractGoogleMapsUrl,
  extractSocialUrls,
  extractWebsiteUrl,
  resetConversationStateStore,
} from '~/routes/api.site.generate';

const TENANT_ID = '550e8400-e29b-41d4-a716-446655440000';
const SESSION_ID = 'session-test-123';

describe('api.site.generate conversation flow', () => {
  beforeEach(() => {
    resetConversationStateStore();
  });

  it('persists conversation state between requests', async () => {
    const initial = await collectInputs(
      'Here is my listing https://www.google.com/maps/place/Example-Restaurant',
      TENANT_ID,
      SESSION_ID,
    );

    expect(initial.googleMapsUrl).toContain('google.com/maps');
    expect(initial.ready).toBe(false);
    expect(initial.step).toBe('collectOptional');

    const followUp = await collectInputs('skip optional for now', TENANT_ID, SESSION_ID);

    expect(followUp.ready).toBe(true);
    expect(followUp.step).toBe('ready');
    expect(followUp.googleMapsUrl).toBe(initial.googleMapsUrl);
  });

  it('marks state ready when URL and optional data are provided together', async () => {
    const message =
      'Use https://maps.app.goo.gl/abc123 for my Maps link, website www.example-bistro.com and instagram.com/examplebistro';
    const state = await collectInputs(message, TENANT_ID, SESSION_ID);

    expect(state.ready).toBe(true);
    expect(state.step).toBe('ready');
    expect(state.legacySite).toBe('https://www.example-bistro.com/');
    expect(state.socialProfiles).toEqual(['https://instagram.com/examplebistro']);
  });
});

describe('api.site.generate URL extraction helpers', () => {
  it('extracts Google Maps URLs without protocol and strips trailing punctuation', () => {
    const url = extractGoogleMapsUrl('Check this spot: www.google.com/maps/place/Bistro).');
    expect(url).toBe('https://www.google.com/maps/place/Bistro');
  });

  it('extracts website URLs while skipping Google Maps and social hosts', () => {
    const message =
      'Maps: https://maps.google.com/foo place. Main site: https://bistro.example/menu and socials instagram.com/bistro';
    const website = extractWebsiteUrl(message);

    expect(website).toBe('https://bistro.example/menu');
  });

  it('captures multiple social URLs', () => {
    const socials = extractSocialUrls('facebook.com/mybiz https://instagram.com/mybiz http://facebook.com/mybiz');

    expect(socials).toEqual(['https://facebook.com/mybiz', 'https://instagram.com/mybiz']);
  });
});

