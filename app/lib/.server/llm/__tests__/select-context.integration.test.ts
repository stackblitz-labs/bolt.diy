/**
 * Integration Tests for selectContext
 *
 * Tests the full selectContext() flow with mock FileMap to verify:
 * - Context selection works without LLM call
 * - Performance meets <100ms target
 * - Backward compatibility is maintained
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { selectContext, getFilePaths } from '~/lib/.server/llm/select-context';
import type { FileMap } from '~/lib/.server/llm/constants';
import type { Message } from 'ai';

// Mock the logger to avoid console output during tests
vi.mock('~/utils/logger', () => ({
  createScopedLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('selectContext integration', () => {
  // Mock FileMap simulating a restaurant website
  const mockFileMap: FileMap = {
    '/home/project/src/pages/Home.tsx': {
      type: 'file',
      content: 'export const Home = () => <div>Home Page</div>;',
      isBinary: false,
    },
    '/home/project/src/pages/About.tsx': {
      type: 'file',
      content: 'export const About = () => <div>About Page</div>;',
      isBinary: false,
    },
    '/home/project/src/components/Hero.tsx': {
      type: 'file',
      content: `export const Hero = () => (
        <section className="hero">
          <h1>Welcome to Our Restaurant</h1>
          <p>The best food in town</p>
        </section>
      );`,
      isBinary: false,
    },
    '/home/project/src/components/Menu.tsx': {
      type: 'file',
      content: `export const Menu = ({ items }) => (
        <div className="menu">
          {items.map(item => <div>{item.name}: $14.99</div>)}
        </div>
      );`,
      isBinary: false,
    },
    '/home/project/src/components/Layout.tsx': {
      type: 'file',
      content: 'export const Layout = ({ children }) => <main>{children}</main>;',
      isBinary: false,
    },
    '/home/project/src/components/Footer.tsx': {
      type: 'file',
      content: 'export const Footer = () => <footer>Open 9am-10pm Daily</footer>;',
      isBinary: false,
    },
    '/home/project/src/App.tsx': {
      type: 'file',
      content: 'export const App = () => <div>App</div>;',
      isBinary: false,
    },
    '/home/project/src/main.tsx': {
      type: 'file',
      content: 'import React from "react"; ReactDOM.render(<App />, root);',
      isBinary: false,
    },
    '/home/project/src/index.css': {
      type: 'file',
      content: `.hero { background: #21C6FF; }
.primary { color: #FF5733; }`,
      isBinary: false,
    },
    '/home/project/src/styles/theme.css': {
      type: 'file',
      content: ':root { --primary: #333; }',
      isBinary: false,
    },
    '/home/project/src/data/menu.json': {
      type: 'file',
      content: JSON.stringify({
        items: [
          { name: 'Burger', price: '$14.99' },
          { name: 'Pizza', price: '$16.50' },
        ],
      }),
      isBinary: false,
    },
    '/home/project/src/data/info.json': {
      type: 'file',
      content: JSON.stringify({ name: 'Restaurant', hours: '9am-10pm' }),
      isBinary: false,
    },

    // Ignored files that should not be selected
    '/home/project/node_modules/react/index.js': {
      type: 'file',
      content: 'module.exports = React;',
      isBinary: false,
    },
    '/home/project/.git/config': {
      type: 'file',
      content: '[core]',
      isBinary: false,
    },
  };

  // Helper to create mock messages
  const createMessages = (content: string, history: string[] = []): Message[] => {
    const messages: Message[] = history.map((text) => ({
      id: `msg-${Math.random()}`,
      role: 'user' as const,
      content: text,
    }));
    messages.push({
      id: `msg-${Math.random()}`,
      role: 'user' as const,
      content,
    });

    return messages;
  };

  let onFinishCalled: boolean;
  let onFinishResult: unknown;

  beforeEach(() => {
    onFinishCalled = false;
    onFinishResult = null;
  });

  describe('selectContext returns FileMap without making LLM call', () => {
    it('returns selected files for basic query', async () => {
      const messages = createMessages('change the header color');

      const result = await selectContext({
        messages,
        files: mockFileMap,
        summary: 'Restaurant website',
      });

      // Should return a FileMap (object) not an empty result
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
      expect(Object.keys(result).length).toBeGreaterThan(0);
    });

    it('includes expected files for header/color query', async () => {
      const messages = createMessages('change the header color to blue');

      const result = await selectContext({
        messages,
        files: mockFileMap,
        summary: 'Restaurant website',
      });

      // Should include Hero.tsx and index.css for header/color query
      const resultPaths = Object.keys(result);
      expect(resultPaths.some((p) => p.includes('Hero') || p.includes('index.css'))).toBe(true);
    });

    it('includes grep matches for specific text', async () => {
      const messages = createMessages('change "$14.99" to "$18.99"');

      const result = await selectContext({
        messages,
        files: mockFileMap,
        summary: 'Restaurant website',
      });

      // Should include files containing $14.99
      const resultPaths = Object.keys(result);
      expect(resultPaths.some((p) => p.includes('Menu') || p.includes('menu.json'))).toBe(true);
    });

    it('excludes ignored patterns (node_modules, .git)', async () => {
      const messages = createMessages('update something');

      const result = await selectContext({
        messages,
        files: mockFileMap,
        summary: 'Restaurant website',
      });

      const resultPaths = Object.keys(result);
      expect(resultPaths.some((p) => p.includes('node_modules'))).toBe(false);
      expect(resultPaths.some((p) => p.includes('.git'))).toBe(false);
    });

    it('calls onFinish callback with mock response', async () => {
      const messages = createMessages('update header');

      await selectContext({
        messages,
        files: mockFileMap,
        summary: 'Restaurant website',
        onFinish: (resp) => {
          onFinishCalled = true;
          onFinishResult = resp;
        },
      });

      expect(onFinishCalled).toBe(true);
      expect(onFinishResult).toBeDefined();

      // Check mock response structure
      const resp = onFinishResult as { text: string; usage: { totalTokens: number } };
      expect(resp.text).toContain('local context selection');
      expect(resp.usage.totalTokens).toBe(0); // No LLM tokens used
    });

    it('respects recentlyEdited boost', async () => {
      const messages = createMessages('make it better');

      const result = await selectContext({
        messages,
        files: mockFileMap,
        summary: 'Restaurant website',
        recentlyEdited: ['/home/project/src/components/Menu.tsx'],
      });

      // Menu.tsx should be included due to recently edited boost
      const resultPaths = Object.keys(result);
      expect(resultPaths.some((p) => p.includes('Menu'))).toBe(true);
    });

    it('respects chat history mentions', async () => {
      const messages = createMessages('make it taller', ['I want to change the Hero section']);

      const result = await selectContext({
        messages,
        files: mockFileMap,
        summary: 'Restaurant website',
      });

      // Hero.tsx should be included due to chat history mention
      const resultPaths = Object.keys(result);
      expect(resultPaths.some((p) => p.includes('Hero'))).toBe(true);
    });
  });

  describe('selectContext completes in under 100ms', () => {
    it('completes quickly for small file set', async () => {
      const messages = createMessages('change the header color');

      const start = performance.now();
      await selectContext({
        messages,
        files: mockFileMap,
        summary: 'Restaurant website',
      });

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);
    });

    it('completes quickly even with all features enabled', async () => {
      const messages = createMessages('update the menu prices to $16.50', [
        'working on the Hero section',
        'the Menu looks good',
      ]);

      const start = performance.now();
      await selectContext({
        messages,
        files: mockFileMap,
        summary: 'Restaurant website',
        recentlyEdited: ['/home/project/src/components/Footer.tsx'],
      });

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);
    });

    it('completes quickly with larger file set (50 files)', async () => {
      // Create a larger mock FileMap
      const largeFileMap: FileMap = { ...mockFileMap };

      for (let i = 0; i < 50; i++) {
        largeFileMap[`/home/project/src/components/Component${i}.tsx`] = {
          type: 'file',
          content: `export const Component${i} = () => <div>Component ${i}</div>;`,
          isBinary: false,
        };
      }

      const messages = createMessages('update header and footer');

      const start = performance.now();
      await selectContext({
        messages,
        files: largeFileMap,
        summary: 'Restaurant website',
      });

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);
    });
  });

  describe('getFilePaths utility', () => {
    it('extracts file paths from FileMap', () => {
      const paths = getFilePaths(mockFileMap);

      expect(paths.length).toBeGreaterThan(0);
      expect(paths).toContain('/home/project/src/pages/Home.tsx');
      expect(paths).toContain('/home/project/src/components/Hero.tsx');
    });

    it('filters out ignored patterns', () => {
      const paths = getFilePaths(mockFileMap);

      expect(paths).not.toContain('/home/project/node_modules/react/index.js');
      expect(paths).not.toContain('/home/project/.git/config');
    });

    it('handles empty FileMap', () => {
      const paths = getFilePaths({});
      expect(paths).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('throws error when no user message found', async () => {
      const messages: Message[] = [{ id: '1', role: 'assistant', content: 'Hello' }];

      await expect(
        selectContext({
          messages,
          files: mockFileMap,
          summary: 'Test',
        }),
      ).rejects.toThrow('No user message found');
    });

    it('throws error when no files selected', async () => {
      const emptyFileMap: FileMap = {};
      const messages = createMessages('update something');

      await expect(
        selectContext({
          messages,
          files: emptyFileMap,
          summary: 'Test',
        }),
      ).rejects.toThrow('Context selection failed to find relevant files');
    });
  });
});
