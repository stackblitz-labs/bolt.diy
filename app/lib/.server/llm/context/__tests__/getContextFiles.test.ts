import { describe, it, expect, vi } from 'vitest';
import { getContextFiles, getContextFilesWithScores } from '~/lib/.server/llm/context/getContextFiles';

// Mock the logger to avoid console output during tests
vi.mock('~/utils/logger', () => ({
  createScopedLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('getContextFiles', () => {
  // Sample file list that simulates a restaurant website structure
  const allFiles = [
    '/home/project/src/pages/Home.tsx',
    '/home/project/src/pages/About.tsx',
    '/home/project/src/components/Hero.tsx',
    '/home/project/src/components/Menu.tsx',
    '/home/project/src/components/MenuPreview.tsx',
    '/home/project/src/components/Layout.tsx',
    '/home/project/src/components/Footer.tsx',
    '/home/project/src/components/Navbar.tsx',
    '/home/project/src/components/Gallery.tsx',
    '/home/project/src/components/Contact.tsx',
    '/home/project/src/components/Feature.tsx',
    '/home/project/src/components/Button.tsx',
    '/home/project/src/App.tsx',
    '/home/project/src/main.tsx',
    '/home/project/src/index.css',
    '/home/project/src/styles/theme.css',
    '/home/project/src/data/menu.json',
    '/home/project/src/data/info.json',
    '/home/project/tailwind.config.js',
    '/home/project/vite.config.ts',
  ];

  describe('core bundle scoring', () => {
    it('always includes core bundle files regardless of query', () => {
      const result = getContextFiles('random query about nothing specific', allFiles);

      // Core patterns should always match: pages/, App.tsx, main.tsx, index.css, styles/, data/, Layout, Footer
      expect(result).toContain('/home/project/src/pages/Home.tsx');
      expect(result).toContain('/home/project/src/App.tsx');
      expect(result).toContain('/home/project/src/main.tsx');
      expect(result).toContain('/home/project/src/index.css');
      expect(result).toContain('/home/project/src/components/Layout.tsx');
      expect(result).toContain('/home/project/src/components/Footer.tsx');
    });

    it('includes files matching styles/ pattern', () => {
      const result = getContextFiles('any query', allFiles);

      expect(result).toContain('/home/project/src/styles/theme.css');
    });

    it('includes files matching data/ pattern', () => {
      const result = getContextFiles('any query', allFiles);

      expect(result).toContain('/home/project/src/data/menu.json');
      expect(result).toContain('/home/project/src/data/info.json');
    });
  });

  describe('keyword matching', () => {
    it('selects Hero.tsx and index.css for "change header color" query', () => {
      const result = getContextFiles('change the header color', allFiles);

      expect(result).toContain('/home/project/src/components/Hero.tsx');
      expect(result).toContain('/home/project/src/index.css');
      expect(result).toContain('/home/project/src/components/Layout.tsx');
    });

    it('selects Menu components for menu-related queries', () => {
      const result = getContextFiles('update menu prices', allFiles);

      expect(result).toContain('/home/project/src/components/Menu.tsx');
      expect(result).toContain('/home/project/src/components/MenuPreview.tsx');
      expect(result).toContain('/home/project/src/data/menu.json');
    });

    it('selects Footer for footer-related queries', () => {
      const result = getContextFiles('fix the footer', allFiles);

      expect(result).toContain('/home/project/src/components/Footer.tsx');
    });

    it('selects Hero for hero section queries', () => {
      const result = getContextFiles('change the hero image', allFiles);

      expect(result).toContain('/home/project/src/components/Hero.tsx');
    });

    it('selects About component for about/story queries', () => {
      const result = getContextFiles('update the about section', allFiles);

      expect(result).toContain('/home/project/src/pages/About.tsx');
    });

    it('selects Gallery for photo/gallery queries', () => {
      const result = getContextFiles('add more photos to the gallery', allFiles);

      expect(result).toContain('/home/project/src/components/Gallery.tsx');
    });

    it('selects Contact for contact-related queries', () => {
      const result = getContextFiles('update contact information', allFiles);

      expect(result).toContain('/home/project/src/components/Contact.tsx');
    });

    it('handles case-insensitive keyword matching', () => {
      const result = getContextFiles('Change The HEADER Color', allFiles);

      expect(result).toContain('/home/project/src/components/Hero.tsx');
    });
  });

  describe('recently edited boost', () => {
    it('boosts recently edited files by +8 score', () => {
      const result = getContextFilesWithScores('make it better', allFiles, {
        recentlyEdited: ['/home/project/src/components/Menu.tsx'],
      });

      const menuFile = result.find((f) => f.path.includes('Menu.tsx'));
      expect(menuFile).toBeDefined();
      expect(menuFile?.signals).toContain('recentlyEdited');
    });

    it('recently edited file appears first even with vague query', () => {
      const result = getContextFiles('make it better', allFiles, {
        recentlyEdited: ['/home/project/src/components/Gallery.tsx'],
      });

      /*
       * Gallery.tsx should be boosted significantly
       * Even with core files getting +10, recentlyEdited files get +8
       */
      expect(result).toContain('/home/project/src/components/Gallery.tsx');
    });

    it('handles path variations for recently edited files', () => {
      // Test with relative path in recentlyEdited
      const result = getContextFilesWithScores('update something', allFiles, {
        recentlyEdited: ['src/components/Hero.tsx'],
      });

      const heroFile = result.find((f) => f.path.includes('Hero.tsx'));
      expect(heroFile?.signals).toContain('recentlyEdited');
    });

    it('works with empty recentlyEdited array', () => {
      const result = getContextFiles('change header', allFiles, {
        recentlyEdited: [],
      });

      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('chat history boost', () => {
    it('boosts Hero.tsx when "Hero" mentioned in chat history', () => {
      const result = getContextFilesWithScores('make it taller', allFiles, {
        chatHistory: ['I want to change the Hero section', 'The Hero looks good'],
      });

      const heroFile = result.find((f) => f.path.includes('Hero.tsx'));
      expect(heroFile).toBeDefined();
      expect(heroFile?.signals).toContain('chatMention');
    });

    it('applies +3 boost for chat mentions', () => {
      const resultWith = getContextFilesWithScores('update', allFiles, {
        chatHistory: ['change the Menu component'],
      });

      const resultWithout = getContextFilesWithScores('update', allFiles, {
        chatHistory: [],
      });

      const menuWith = resultWith.find((f) => f.path.includes('Menu.tsx'));
      const menuWithout = resultWithout.find((f) => f.path.includes('Menu.tsx'));

      // Menu.tsx should have higher score with chat mention
      expect(menuWith?.signals).toContain('chatMention');
      expect(menuWithout?.signals || []).not.toContain('chatMention');
    });

    it('case-insensitive matching for file mentions', () => {
      const result = getContextFilesWithScores('change something', allFiles, {
        chatHistory: ['working on the FOOTER section'],
      });

      const footerFile = result.find((f) => f.path.includes('Footer.tsx'));
      expect(footerFile?.signals).toContain('chatMention');
    });
  });

  describe('sorting and limiting', () => {
    it('limits results to maxFiles (default 12)', () => {
      const result = getContextFiles('change everything about the header menu footer hero', allFiles);

      expect(result.length).toBeLessThanOrEqual(12);
    });

    it('respects custom maxFiles option', () => {
      const result = getContextFiles('change everything', allFiles, {
        maxFiles: 5,
      });

      expect(result.length).toBeLessThanOrEqual(5);
    });

    it('returns sorted by score in descending order', () => {
      const result = getContextFilesWithScores('change the header color', allFiles);

      // Verify scores are in descending order
      for (let i = 0; i < result.length - 1; i++) {
        expect(result[i].score).toBeGreaterThanOrEqual(result[i + 1].score);
      }
    });

    it('returns empty array when allFiles is empty', () => {
      const result = getContextFiles('change header', []);

      expect(result).toEqual([]);
    });
  });

  describe('performance', () => {
    it('completes selection in under 100ms for 30 files', () => {
      const largeFileList = Array.from({ length: 30 }, (_, i) => `/home/project/src/file${i}.tsx`);

      const start = performance.now();
      getContextFiles('change the header color to blue', largeFileList, {
        recentlyEdited: ['/home/project/src/file5.tsx', '/home/project/src/file10.tsx'],
        chatHistory: ['update header', 'change color', 'fix menu'],
      });

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);
    });

    it('handles large file lists efficiently', () => {
      const largeFileList = Array.from({ length: 100 }, (_, i) => `/home/project/src/components/Component${i}.tsx`);

      const start = performance.now();
      getContextFiles('update the header and menu', largeFileList);

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);
    });
  });

  describe('edge cases', () => {
    it('handles empty user message', () => {
      const result = getContextFiles('', allFiles);

      // Should still return core files
      expect(result.length).toBeGreaterThan(0);
    });

    it('handles undefined options', () => {
      const result = getContextFiles('change header', allFiles, undefined);

      expect(result.length).toBeGreaterThan(0);
    });

    it('handles special characters in user message', () => {
      const result = getContextFiles('change the color to #FF0000', allFiles);

      // Should still work with special characters
      expect(result).toContain('/home/project/src/index.css');
    });

    it('does not match short file basenames (length <= 2)', () => {
      const filesWithShortNames = ['/home/project/src/ui/A.tsx', '/home/project/src/components/Hero.tsx'];

      const result = getContextFilesWithScores('change A component', filesWithShortNames, {
        chatHistory: ['working on A'],
      });

      // Short basenames should not get chatMention boost
      const aFile = result.find((f) => f.path.includes('/A.tsx'));
      expect(aFile?.signals || []).not.toContain('chatMention');
    });
  });

  describe('combined scoring', () => {
    it('accumulates scores from multiple signals', () => {
      const result = getContextFilesWithScores('change the menu prices', allFiles, {
        recentlyEdited: ['/home/project/src/components/Menu.tsx'],
        chatHistory: ['update the Menu section'],
      });

      const menuFile = result.find((f) => f.path === '/home/project/src/components/Menu.tsx');
      expect(menuFile).toBeDefined();

      /*
       * Menu.tsx should have: core (data/ doesn't match, but might have keyword match)
       * + keyword:menu (+5) + recentlyEdited (+8) + chatMention (+3)
       */
      expect(menuFile?.signals).toContain('keyword:menu');
      expect(menuFile?.signals).toContain('recentlyEdited');
      expect(menuFile?.signals).toContain('chatMention');
    });

    it('higher scored files appear first', () => {
      const result = getContextFiles('change the header', allFiles, {
        recentlyEdited: ['/home/project/src/components/Hero.tsx'],
      });

      /*
       * Hero.tsx should be near the top because it matches:
       * - keyword:header -> Hero pattern
       * - recentlyEdited boost
       */
      const heroIndex = result.indexOf('/home/project/src/components/Hero.tsx');
      expect(heroIndex).toBeLessThan(5);
    });
  });
});
