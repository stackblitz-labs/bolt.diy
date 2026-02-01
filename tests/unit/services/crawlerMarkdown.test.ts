/**
 * Unit tests for Crawler Markdown Methods
 *
 * Tests generateGoogleMapsMarkdown() and crawlWebsiteMarkdown() covering:
 * - Success responses
 * - Error responses (404, 500)
 * - Timeout handling
 *
 * Based on specs/001-enhanced-markdown-crawler/
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Store original fetch
const originalFetch = global.fetch;

// Mock fetch for testing
let mockFetch: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockFetch = vi.fn();
  global.fetch = mockFetch;
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.clearAllMocks();
  vi.useRealTimers();
});

// Import after setting up mocks
import {
  generateGoogleMapsMarkdown,
  crawlWebsiteMarkdown,
} from '~/lib/services/crawlerClient.server';

describe('generateGoogleMapsMarkdown', () => {
  const testSessionId = 'test-session-123';

  it('should return markdown on success response', async () => {
    const mockMarkdown = '# Restaurant Name\n\nGreat place for dining.';

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        markdown: mockMarkdown,
      }),
    });

    const result = await generateGoogleMapsMarkdown(testSessionId);

    expect(result.success).toBe(true);
    expect(result.markdown).toBe(mockMarkdown);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/generate-google-maps-markdown'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: testSessionId }),
      }),
    );
  });

  it('should handle 404 session not found error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({
        error: 'Session not found',
      }),
    });

    const result = await generateGoogleMapsMarkdown(testSessionId);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Session not found');
    expect(result.statusCode).toBe(404);
  });

  it('should handle timeout error', async () => {
    // Create an abort error to simulate timeout
    const abortError = new Error('Request timed out after 120000ms');
    abortError.name = 'AbortError';

    mockFetch.mockRejectedValueOnce(abortError);

    const result = await generateGoogleMapsMarkdown(testSessionId);

    expect(result.success).toBe(false);
    expect(result.error?.toLowerCase()).toContain('timed out');
    expect(result.statusCode).toBe(408);
  });

  it('should handle network errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const result = await generateGoogleMapsMarkdown(testSessionId);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Crawler unavailable');
    expect(result.statusCode).toBe(503);
  });
});

describe('crawlWebsiteMarkdown', () => {
  const testRequest = {
    url: 'https://example-restaurant.com',
    session_id: 'test-session-456',
    enable_visual_analysis: true,
  };

  it('should return markdown data on success response', async () => {
    const mockData = {
      markdown: '# Example Restaurant\n\nWelcome to our website.',
      session_id: testRequest.session_id,
      url: testRequest.url,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: mockData,
      }),
    });

    const result = await crawlWebsiteMarkdown(testRequest);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(mockData);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/crawl-website-markdown'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });

  it('should handle 500 server error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({
        error: 'Internal server error',
      }),
    });

    const result = await crawlWebsiteMarkdown(testRequest);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Internal server error');
    expect(result.statusCode).toBe(500);
  });

  it('should handle timeout error', async () => {
    const abortError = new Error('Request timed out after 120000ms');
    abortError.name = 'AbortError';

    mockFetch.mockRejectedValueOnce(abortError);

    const result = await crawlWebsiteMarkdown(testRequest);

    expect(result.success).toBe(false);
    expect(result.error?.toLowerCase()).toContain('timed out');
    expect(result.statusCode).toBe(408);
  });

  it('should handle network errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ENOTFOUND'));

    const result = await crawlWebsiteMarkdown(testRequest);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Crawler unavailable');
    expect(result.statusCode).toBe(503);
  });

  it('should use default values for optional parameters', async () => {
    const minimalRequest = {
      url: 'https://minimal.com',
      session_id: 'minimal-session',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          markdown: '# Minimal',
          session_id: minimalRequest.session_id,
          url: minimalRequest.url,
        },
      }),
    });

    await crawlWebsiteMarkdown(minimalRequest);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"max_pages":1'),
      }),
    );
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"enable_visual_analysis":true'),
      }),
    );
  });
});
