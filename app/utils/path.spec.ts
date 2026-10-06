import { describe, it, expect } from 'vitest';
import { path } from './path';

describe('path utilities', () => {
  describe('join', () => {
    it('should join paths correctly', () => {
      expect(path.join('a', 'b', 'c')).toBe('a/b/c');
    });

    it('should normalize slashes', () => {
      expect(path.join('a/', '/b/', '/c')).toBe('a/b/c');
    });

    it('should handle empty strings', () => {
      expect(path.join('a', '', 'b')).toBe('a/b');
    });

    it('should handle single argument', () => {
      expect(path.join('folder')).toBe('folder');
    });

    it('should handle .. and . correctly', () => {
      expect(path.join('a', 'b', '..', 'c')).toBe('a/c');
      expect(path.join('a', '.', 'b')).toBe('a/b');
    });
  });

  describe('dirname', () => {
    it('should return directory name', () => {
      expect(path.dirname('/path/to/file.txt')).toBe('/path/to');
    });

    it('should handle single level path', () => {
      expect(path.dirname('file.txt')).toBe('.');
    });

    it('should handle root path', () => {
      expect(path.dirname('/')).toBe('/');
    });

    it('should handle paths without extension', () => {
      expect(path.dirname('/path/to/folder')).toBe('/path/to');
    });
  });

  describe('basename', () => {
    it('should return file name', () => {
      expect(path.basename('/path/to/file.txt')).toBe('file.txt');
    });

    it('should return file name without extension when provided', () => {
      expect(path.basename('/path/to/file.txt', '.txt')).toBe('file');
    });

    it('should handle path without directory', () => {
      expect(path.basename('file.txt')).toBe('file.txt');
    });

    it('should handle folder names', () => {
      expect(path.basename('/path/to/folder/')).toBe('folder');
    });
  });

  describe('extname', () => {
    it('should return file extension', () => {
      expect(path.extname('file.txt')).toBe('.txt');
    });

    it('should return empty string for no extension', () => {
      expect(path.extname('file')).toBe('');
    });

    it('should handle multiple dots', () => {
      expect(path.extname('file.backup.txt')).toBe('.txt');
    });

    it('should handle hidden files', () => {
      expect(path.extname('.gitignore')).toBe('');
    });

    it('should handle paths with directories', () => {
      expect(path.extname('/path/to/file.js')).toBe('.js');
    });
  });

  describe('relative', () => {
    it('should return relative path', () => {
      expect(path.relative('/data/test', '/data/impl')).toBe('../impl');
    });

    it('should handle same paths', () => {
      expect(path.relative('/data', '/data')).toBe('');
    });

    it('should handle nested paths', () => {
      expect(path.relative('/a/b', '/a/b/c/d')).toBe('c/d');
    });
  });

  describe('isAbsolute', () => {
    it('should return true for absolute paths', () => {
      expect(path.isAbsolute('/path/to/file')).toBe(true);
    });

    it('should return false for relative paths', () => {
      expect(path.isAbsolute('path/to/file')).toBe(false);
      expect(path.isAbsolute('./file')).toBe(false);
      expect(path.isAbsolute('../file')).toBe(false);
    });

    it('should handle empty path', () => {
      expect(path.isAbsolute('')).toBe(false);
    });
  });

  describe('normalize', () => {
    it('should normalize path separators', () => {
      expect(path.normalize('a//b///c')).toBe('a/b/c');
    });

    it('should resolve .. and .', () => {
      expect(path.normalize('/a/b/../c/./d')).toBe('/a/c/d');
    });

    it('should handle trailing slashes', () => {
      // path-browserify keeps trailing slashes
      expect(path.normalize('/a/b/c/')).toBe('/a/b/c/');
    });

    it('should handle empty path', () => {
      expect(path.normalize('')).toBe('.');
    });
  });

  describe('parse', () => {
    it('should parse path into components', () => {
      const parsed = path.parse('/path/to/file.txt');
      expect(parsed.dir).toBe('/path/to');
      expect(parsed.base).toBe('file.txt');
      expect(parsed.ext).toBe('.txt');
      expect(parsed.name).toBe('file');
    });

    it('should handle paths without extension', () => {
      const parsed = path.parse('/path/to/folder');
      expect(parsed.ext).toBe('');
      expect(parsed.name).toBe('folder');
    });

    it('should handle root path', () => {
      const parsed = path.parse('/');
      expect(parsed.root).toBe('/');
      expect(parsed.dir).toBe('/');
    });
  });

  describe('format', () => {
    it('should format path from components', () => {
      const formatted = path.format({
        dir: '/path/to',
        base: 'file.txt',
        ext: '.txt',
        name: 'file',
        root: '/',
      });
      expect(formatted).toBe('/path/to/file.txt');
    });

    it('should handle minimal components', () => {
      const formatted = path.format({
        dir: '',
        base: 'file.txt',
        ext: '.txt',
        name: 'file',
        root: '',
      });
      expect(formatted).toBe('file.txt');
    });
  });

  describe('real-world scenarios', () => {
    it('should handle typical file operations', () => {
      const filePath = '/home/user/project/src/components/Button.tsx';

      expect(path.dirname(filePath)).toBe('/home/user/project/src/components');
      expect(path.basename(filePath)).toBe('Button.tsx');
      expect(path.extname(filePath)).toBe('.tsx');
      expect(path.basename(filePath, '.tsx')).toBe('Button');
    });

    it('should handle path construction', () => {
      const base = '/home/user/project';
      const file = 'src/components/Button.tsx';

      expect(path.join(base, file)).toBe('/home/user/project/src/components/Button.tsx');
    });

    it('should handle relative path calculations', () => {
      const from = '/home/user/project/src/components';
      const to = '/home/user/project/src/utils/helper.ts';

      expect(path.relative(from, to)).toBe('../utils/helper.ts');
    });
  });
});
