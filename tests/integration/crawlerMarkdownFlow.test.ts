/**
 * Integration tests for Crawler Markdown Flow
 *
 * Tests the complete flow: extractBusinessData -> parallel markdown generation
 * Covers US1 (rich content) and US2 (graceful degradation) acceptance scenarios.
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
});

// Import after setting up mocks
import {
  extractBusinessData,
  generateGoogleMapsMarkdown,
  crawlWebsiteMarkdown,
} from '~/lib/services/crawlerClient.server';

describe('Crawler Markdown Flow Integration', () => {
  describe('US1: Full flow with website URL', () => {
    it('should populate both markdown fields when website URL is available', async () => {
      const sessionId = 'integration-test-session-001';
      const websiteUrl = 'https://example-restaurant.com';

      // Mock extractBusinessData success with website URL
      const mockBusinessData = {
        name: 'Test Restaurant',
        address: '123 Main St',
        phone: '555-1234',
        website: websiteUrl,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: mockBusinessData,
        }),
      });

      // Verify extractBusinessData returns website URL
      const extractResult = await extractBusinessData({
        session_id: sessionId,
        google_maps_url: 'https://maps.google.com/place/test',
      });

      expect(extractResult.success).toBe(true);
      expect(extractResult.data?.website).toBe(websiteUrl);

      // Mock parallel markdown generation
      const mockGoogleMapsMarkdown = `# Test Restaurant

## Basic Info
- Name: Test Restaurant
- Address: 123 Main St
- Phone: 555-1234

## Hours
Monday-Sunday: 11am-10pm`;

      const mockWebsiteMarkdown = `# Website Analysis

## Visual Style
- Color scheme: Dark with gold accents
- Typography: Modern serif headers

## Content Sections
- Hero with restaurant imagery
- Menu highlights
- Reservation CTA`;

      // Mock Google Maps markdown call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          markdown: mockGoogleMapsMarkdown,
        }),
      });

      // Mock website markdown call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            markdown: mockWebsiteMarkdown,
            session_id: sessionId,
            url: websiteUrl,
          },
        }),
      });

      // Execute parallel markdown generation (simulating api.crawler.extract behavior)
      const [gmapsResult, websiteResult] = await Promise.allSettled([
        generateGoogleMapsMarkdown(sessionId),
        crawlWebsiteMarkdown({
          url: websiteUrl,
          session_id: sessionId,
          enable_visual_analysis: true,
        }),
      ]);

      // Verify both succeed
      expect(gmapsResult.status).toBe('fulfilled');
      expect(websiteResult.status).toBe('fulfilled');

      if (gmapsResult.status === 'fulfilled') {
        expect(gmapsResult.value.success).toBe(true);
        expect(gmapsResult.value.markdown).toBe(mockGoogleMapsMarkdown);
      }

      if (websiteResult.status === 'fulfilled' && websiteResult.value.success && 'data' in websiteResult.value) {
        expect(websiteResult.value.data?.markdown).toBe(mockWebsiteMarkdown);
      }
    });

    it('should include all required business profile fields in markdown', async () => {
      const sessionId = 'integration-test-session-002';

      const mockMarkdown = `# Gourmet Kitchen

## Basic Info
- Name: Gourmet Kitchen
- Address: 456 Food Ave, Culinary City, CA 90210
- Phone: (555) 987-6543
- Website: https://gourmetkitchen.com

## Hours
Monday: 11:00 AM - 9:00 PM
Tuesday: 11:00 AM - 9:00 PM
Wednesday: 11:00 AM - 9:00 PM
Thursday: 11:00 AM - 9:00 PM
Friday: 11:00 AM - 10:00 PM
Saturday: 10:00 AM - 10:00 PM
Sunday: 10:00 AM - 9:00 PM

## Menu Highlights
- Signature Pasta - $24
- Grilled Salmon - $32
- Truffle Risotto - $28

## Reviews Summary
Rating: 4.7/5 (342 reviews)
Recent highlights: "Amazing pasta", "Great atmosphere"`;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          markdown: mockMarkdown,
        }),
      });

      const result = await generateGoogleMapsMarkdown(sessionId);

      expect(result.success).toBe(true);
      expect(result.markdown).toContain('Basic Info');
      expect(result.markdown).toContain('Hours');
      expect(result.markdown).toContain('Menu Highlights');
      expect(result.markdown).toContain('Reviews Summary');
    });
  });

  describe('US2: Graceful degradation without website', () => {
    it('should proceed with google_maps_markdown only when no website URL', async () => {
      const sessionId = 'integration-test-session-003';

      // Mock extractBusinessData without website URL
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            name: 'Food Truck Delights',
            address: 'Various Locations',
            phone: '555-FOOD',
            website: null, // No website
          },
        }),
      });

      const extractResult = await extractBusinessData({
        session_id: sessionId,
        google_maps_url: 'https://maps.google.com/place/foodtruck',
      });

      expect(extractResult.success).toBe(true);
      expect(extractResult.data?.website).toBeFalsy();

      // Mock Google Maps markdown (still works)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          markdown: '# Food Truck Delights\n\nMobile dining experience.',
        }),
      });

      // Simulate the parallel call pattern from api.crawler.extract
      const crawledWebsiteUrl = extractResult.data?.website;

      const [gmapsResult, websiteResult] = await Promise.allSettled([
        generateGoogleMapsMarkdown(sessionId),
        crawledWebsiteUrl
          ? crawlWebsiteMarkdown({
              url: crawledWebsiteUrl,
              session_id: sessionId,
              enable_visual_analysis: true,
            })
          : Promise.resolve({ success: false, error: 'No website URL' } as const),
      ]);

      // Google Maps markdown should succeed
      expect(gmapsResult.status).toBe('fulfilled');
      if (gmapsResult.status === 'fulfilled') {
        expect(gmapsResult.value.success).toBe(true);
        expect(gmapsResult.value.markdown).toContain('Food Truck Delights');
      }

      // Website markdown should be skipped (not an error)
      expect(websiteResult.status).toBe('fulfilled');
      if (websiteResult.status === 'fulfilled') {
        expect(websiteResult.value.success).toBe(false);
        expect(websiteResult.value.error).toBe('No website URL');
      }
    });

    it('should continue when website crawl times out', async () => {
      const sessionId = 'integration-test-session-004';
      const websiteUrl = 'https://slow-website.com';

      // Mock Google Maps markdown success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          markdown: '# Restaurant Name\n\nBusiness details here.',
        }),
      });

      // Mock website markdown timeout
      const timeoutError = new Error('Request timed out after 120000ms');
      timeoutError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(timeoutError);

      const [gmapsResult, websiteResult] = await Promise.allSettled([
        generateGoogleMapsMarkdown(sessionId),
        crawlWebsiteMarkdown({
          url: websiteUrl,
          session_id: sessionId,
          enable_visual_analysis: true,
        }),
      ]);

      // Google Maps should succeed regardless of website timeout
      expect(gmapsResult.status).toBe('fulfilled');
      if (gmapsResult.status === 'fulfilled') {
        expect(gmapsResult.value.success).toBe(true);
      }

      // Website should fail gracefully with timeout
      expect(websiteResult.status).toBe('fulfilled'); // Promise.allSettled catches
      if (websiteResult.status === 'fulfilled') {
        expect(websiteResult.value.success).toBe(false);
        expect(websiteResult.value.statusCode).toBe(408);
      }
    });

    it('should continue when website returns 500 error', async () => {
      const sessionId = 'integration-test-session-005';
      const websiteUrl = 'https://broken-website.com';

      // Mock Google Maps markdown success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          markdown: '# Another Restaurant\n\nGreat food here.',
        }),
      });

      // Mock website markdown 500 error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({
          error: 'Internal server error',
        }),
      });

      const [gmapsResult, websiteResult] = await Promise.allSettled([
        generateGoogleMapsMarkdown(sessionId),
        crawlWebsiteMarkdown({
          url: websiteUrl,
          session_id: sessionId,
          enable_visual_analysis: true,
        }),
      ]);

      // Google Maps should still succeed
      expect(gmapsResult.status).toBe('fulfilled');
      if (gmapsResult.status === 'fulfilled') {
        expect(gmapsResult.value.success).toBe(true);
        expect(gmapsResult.value.markdown).toContain('Another Restaurant');
      }

      // Website should fail but not block
      expect(websiteResult.status).toBe('fulfilled');
      if (websiteResult.status === 'fulfilled') {
        expect(websiteResult.value.success).toBe(false);
        expect(websiteResult.value.statusCode).toBe(500);
      }
    });
  });

  describe('BusinessProfile Structure Verification', () => {
    it('should produce valid BusinessProfile structure with markdown fields', async () => {
      const sessionId = 'integration-test-session-006';
      const websiteUrl = 'https://premium-restaurant.com';

      const gmapsMarkdown = '# Premium Restaurant\n\n## Basic Info\n- Name: Premium Restaurant';
      const websiteMarkdown = '# Website Analysis\n\n## Visual Style\n- Elegant dark theme';

      // Mock both markdown calls
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, markdown: gmapsMarkdown }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: { markdown: websiteMarkdown, session_id: sessionId, url: websiteUrl },
          }),
        });

      const [gmapsResult, websiteResult] = await Promise.allSettled([
        generateGoogleMapsMarkdown(sessionId),
        crawlWebsiteMarkdown({ url: websiteUrl, session_id: sessionId }),
      ]);

      // Extract values (simulating api.crawler.extract logic)
      const googleMapsMarkdownValue =
        gmapsResult.status === 'fulfilled' && gmapsResult.value.success
          ? gmapsResult.value.markdown
          : undefined;

      const websiteMarkdownValue =
        websiteResult.status === 'fulfilled' &&
        websiteResult.value.success &&
        'data' in websiteResult.value
          ? websiteResult.value.data?.markdown
          : undefined;

      // Simulate BusinessProfile structure
      const businessProfile = {
        session_id: sessionId,
        google_maps_markdown: googleMapsMarkdownValue,
        website_markdown: websiteMarkdownValue,
      };

      // Verify structure matches BusinessProfile interface
      expect(businessProfile.session_id).toBe(sessionId);
      expect(businessProfile.google_maps_markdown).toBe(gmapsMarkdown);
      expect(businessProfile.website_markdown).toBe(websiteMarkdown);
      expect(typeof businessProfile.google_maps_markdown).toBe('string');
      expect(typeof businessProfile.website_markdown).toBe('string');
    });

    it('should handle BusinessProfile with only google_maps_markdown', async () => {
      const sessionId = 'integration-test-session-007';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          markdown: '# Simple Restaurant\n\nBasic info only.',
        }),
      });

      const gmapsResult = await generateGoogleMapsMarkdown(sessionId);

      // Simulate BusinessProfile without website markdown
      const businessProfile = {
        session_id: sessionId,
        google_maps_markdown: gmapsResult.success ? gmapsResult.markdown : undefined,
        website_markdown: undefined, // No website
      };

      expect(businessProfile.google_maps_markdown).toBeDefined();
      expect(businessProfile.website_markdown).toBeUndefined();

      // This should be valid for generation (US2 graceful degradation)
      const hasMarkdown = !!businessProfile.google_maps_markdown;
      expect(hasMarkdown).toBe(true);
    });
  });
});
