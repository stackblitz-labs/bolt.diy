/**
 * Syntax Highlighter Client Unit Tests
 * 
 * Tests the worker client interface and caching behavior
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SyntaxHighlighterClient } from '~/utils/syntax-highlighter-client';

describe('SyntaxHighlighterClient', () => {
  let client: SyntaxHighlighterClient;

  beforeEach(() => {
    client = new SyntaxHighlighterClient();
  });

  afterEach(() => {
    client.dispose();
  });

  describe('constructor', () => {
    it('should create client instance', () => {
      expect(client).toBeInstanceOf(SyntaxHighlighterClient);
    });
  });

  describe('highlight', () => {
    it('should return highlighted HTML', async () => {
      const code = 'console.log("hello");';
      const result = await client.highlight(code, 'javascript');

      expect(result).toContain('<');
      expect(typeof result).toBe('string');
    });

    it('should handle different languages', async () => {
      const code = 'const x: number = 5;';
      const result = await client.highlight(code, 'typescript');

      expect(result).toContain('<');
      expect(typeof result).toBe('string');
    });

    it('should handle different themes', async () => {
      const code = 'print("hello")';
      const result = await client.highlight(code, 'python', 'light-plus');

      expect(result).toContain('<');
      expect(typeof result).toBe('string');
    });
  });

  describe('caching', () => {
    it('should cache highlighted results', async () => {
      const code = 'const x = 1;';
      
      // First call
      const result1 = await client.highlight(code, 'javascript');
      
      // Second call should use cache
      const result2 = await client.highlight(code, 'javascript');

      expect(result1).toBe(result2);
    });

    it('should use different cache keys for different languages', async () => {
      const code = 'const x = 1;';
      
      const jsResult = await client.highlight(code, 'javascript');
      const tsResult = await client.highlight(code, 'typescript');

      // Results should be different (different highlighting)
      expect(jsResult).not.toBe(tsResult);
    });

    it('should respect cache size limit', async () => {
      const stats = client.getCacheStats();
      expect(stats.maxSize).toBe(500);
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', () => {
      const stats = client.getCacheStats();

      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('maxSize');
      expect(typeof stats.size).toBe('number');
      expect(typeof stats.maxSize).toBe('number');
    });

    it('should update size after highlighting', async () => {
      const initialStats = client.getCacheStats();
      
      await client.highlight('const x = 1;', 'javascript');
      
      const afterStats = client.getCacheStats();
      expect(afterStats.size).toBeGreaterThan(initialStats.size);
    });
  });

  describe('clearCache', () => {
    it('should clear the cache', async () => {
      await client.highlight('const x = 1;', 'javascript');
      
      const beforeStats = client.getCacheStats();
      expect(beforeStats.size).toBeGreaterThan(0);
      
      client.clearCache();
      
      const afterStats = client.getCacheStats();
      expect(afterStats.size).toBe(0);
    });
  });

  describe('dispose', () => {
    it('should clean up resources', () => {
      const testClient = new SyntaxHighlighterClient();
      
      expect(() => testClient.dispose()).not.toThrow();
      
      // After dispose, should not have active worker
      const stats = testClient.getCacheStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle empty code', async () => {
      const result = await client.highlight('', 'javascript');
      
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('should handle invalid language gracefully', async () => {
      // @ts-expect-error Testing invalid language
      const result = await client.highlight('code', 'invalid-lang');
      
      // Should return fallback HTML
      expect(result).toContain('<');
    });

    it('should timeout long operations', async () => {
      // This would require mocking the worker to delay response
      // For now, just verify the method doesn't hang
      const code = 'const x = 1;'.repeat(1000);
      
      const startTime = Date.now();
      await client.highlight(code, 'javascript');
      const duration = Date.now() - startTime;
      
      // Should complete in reasonable time (< 5 seconds)
      expect(duration).toBeLessThan(5000);
    }, 10000);
  });

  describe('concurrent requests', () => {
    it('should handle multiple concurrent highlights', async () => {
      const promises = [
        client.highlight('const a = 1;', 'javascript'),
        client.highlight('const b = 2;', 'javascript'),
        client.highlight('const c = 3;', 'javascript'),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result).toContain('<');
      });
    });
  });

  describe('fallback behavior', () => {
    it('should escape HTML in fallback', async () => {
      const code = '<script>alert("xss")</script>';
      const result = await client.highlight(code, 'javascript');

      // Should not contain raw script tag
      expect(result).not.toContain('<script>alert("xss")</script>');
      expect(result).toContain('&lt;script&gt;');
    });
  });
});
