import { describe, expect, it } from 'vitest';
import { applyEdit, groupEditsByFile, parseEditBlocks, sortEditsForApplication } from './edit-parser';

describe('parseEditBlocks', () => {
  describe('valid blocks', () => {
    it('parses a single valid block', () => {
      const raw = `src/App.tsx
<<<<<<< SEARCH
const a = 1;
=======
const a = 2;
>>>>>>> REPLACE`;

      const { blocks, errors } = parseEditBlocks(raw);

      expect(errors).toEqual([]);
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toMatchObject({
        filePath: '/src/App.tsx',
        searchContent: 'const a = 1;',
        replaceContent: 'const a = 2;',
      });
    });

    it('parses multiple blocks for different files', () => {
      const raw = `src/App.tsx
<<<<<<< SEARCH
import React from 'react';
=======
import React, { useState } from 'react';
>>>>>>> REPLACE

src/components/Button.tsx
<<<<<<< SEARCH
export function Button() {
=======
export function Button({ variant }) {
>>>>>>> REPLACE`;

      const { blocks, errors } = parseEditBlocks(raw);

      expect(errors).toEqual([]);
      expect(blocks).toHaveLength(2);
      expect(blocks[0].filePath).toBe('/src/App.tsx');
      expect(blocks[1].filePath).toBe('/src/components/Button.tsx');
    });

    it('parses multiple blocks for same file', () => {
      const raw = `src/App.tsx
<<<<<<< SEARCH
const a = 1;
=======
const a = 2;
>>>>>>> REPLACE

src/App.tsx
<<<<<<< SEARCH
const b = 3;
=======
const b = 4;
>>>>>>> REPLACE`;

      const { blocks } = parseEditBlocks(raw);

      expect(blocks).toHaveLength(2);
      expect(blocks[0].filePath).toBe('/src/App.tsx');
      expect(blocks[1].filePath).toBe('/src/App.tsx');
    });

    it('handles empty SEARCH block (for new content)', () => {
      const raw = `src/new-file.ts
<<<<<<< SEARCH
=======
// This is new content
export const newFunction = () => {};
>>>>>>> REPLACE`;

      const { blocks, errors } = parseEditBlocks(raw);

      expect(errors).toEqual([]);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].searchContent).toBe('');
      expect(blocks[0].replaceContent).toContain('newFunction');
    });

    it('preserves multi-line content with correct whitespace', () => {
      const raw = `src/Component.tsx
<<<<<<< SEARCH
function Component() {
  return (
    <div>
      <h1>Hello</h1>
    </div>
  );
}
=======
function Component({ title }) {
  return (
    <div>
      <h1>{title}</h1>
    </div>
  );
}
>>>>>>> REPLACE`;

      const { blocks, errors } = parseEditBlocks(raw);

      expect(errors).toEqual([]);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].searchContent).toContain('  return (');
      expect(blocks[0].replaceContent).toContain('{ title }');
    });
  });

  describe('malformed blocks', () => {
    it('skips blocks with missing divider', () => {
      const raw = `src/App.tsx
<<<<<<< SEARCH
const a = 1;
>>>>>>> REPLACE`;

      const { blocks, errors } = parseEditBlocks(raw);

      expect(blocks).toHaveLength(0);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('skips blocks with missing REPLACE marker', () => {
      const raw = `src/App.tsx
<<<<<<< SEARCH
const a = 1;
=======
const a = 2;`;

      const { blocks, errors } = parseEditBlocks(raw);

      expect(blocks).toHaveLength(0);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('parses valid blocks while skipping malformed ones', () => {
      const raw = `src/valid.tsx
<<<<<<< SEARCH
valid content
=======
new valid content
>>>>>>> REPLACE

src/invalid.tsx
<<<<<<< SEARCH
missing replace marker
=======

src/also-valid.tsx
<<<<<<< SEARCH
also valid
=======
also new
>>>>>>> REPLACE`;

      const { blocks, errors } = parseEditBlocks(raw);

      expect(blocks).toHaveLength(2);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});

describe('applyEdit', () => {
  describe('exact matching', () => {
    it('applies exact match successfully', () => {
      const fileContent = `const a = 1;
const b = 2;
const c = 3;`;

      const result = applyEdit(fileContent, {
        filePath: '/test.ts',
        searchContent: 'const b = 2;',
        replaceContent: 'const b = 42;',
      });

      expect(result.success).toBe(true);
      expect(result.strategy).toBe('exact');
      expect(result.newContent).toContain('const b = 42;');
      expect(result.newContent).toContain('const a = 1;');
      expect(result.newContent).toContain('const c = 3;');
    });

    it('applies exact match with multi-line content', () => {
      const fileContent = `function hello() {
  console.log("Hello");
  return true;
}`;

      const result = applyEdit(fileContent, {
        filePath: '/test.ts',
        searchContent: `function hello() {
  console.log("Hello");`,
        replaceContent: `function hello(name) {
  console.log("Hello", name);`,
      });

      expect(result.success).toBe(true);
      expect(result.strategy).toBe('exact');
      expect(result.newContent).toContain('function hello(name)');
    });
  });

  describe('normalized matching', () => {
    it('applies normalized match when trailing whitespace differs', () => {
      const fileContent = `const a = 1;   
const b = 2;`;

      const result = applyEdit(fileContent, {
        filePath: '/test.ts',
        searchContent: 'const a = 1;',
        replaceContent: 'const a = 42;',
      });

      expect(result.success).toBe(true);
      expect(['normalized', 'exact']).toContain(result.strategy);
      expect(result.newContent).toContain('const a = 42;');
    });
  });

  describe('fuzzy matching', () => {
    it('applies fuzzy match for minor differences', () => {
      const fileContent = `// Some comment
const  a = 1;
const b = 2;`;

      const result = applyEdit(fileContent, {
        filePath: '/test.ts',
        searchContent: 'const a = 1;',
        replaceContent: 'const a = 42;',
      });

      expect(result.success).toBe(true);
      expect(['normalized', 'fuzzy', 'exact']).toContain(result.strategy);
    });
  });

  describe('failed matching', () => {
    it('returns failed when content not found', () => {
      const fileContent = `const a = 1;
const b = 2;`;

      const result = applyEdit(fileContent, {
        filePath: '/test.ts',
        searchContent: 'const c = 3;',
        replaceContent: 'const c = 33;',
      });

      expect(result.success).toBe(false);
      expect(result.strategy).toBe('failed');
      expect(result.newContent).toBe(fileContent);
    });

    it('returns failed when content is completely different', () => {
      const fileContent = `function hello() { return "hello"; }`;

      const result = applyEdit(fileContent, {
        filePath: '/test.ts',
        searchContent: 'function goodbye() { return "bye"; }',
        replaceContent: 'function goodbye() { return "farewell"; }',
      });

      expect(result.success).toBe(false);
      expect(result.strategy).toBe('failed');
    });
  });

  describe('empty SEARCH (new content)', () => {
    it('replaces entire content when SEARCH is empty', () => {
      const result = applyEdit('existing content', {
        filePath: '/test.ts',
        searchContent: '',
        replaceContent: 'new content',
      });

      expect(result.success).toBe(true);
      expect(result.newContent).toBe('new content');
    });
  });
});

describe('sortEditsForApplication', () => {
  it('sorts edits from bottom to top', () => {
    const fileContent = `line 1
line 2
line 3
line 4
line 5`;

    const edits = [
      { filePath: '/test.ts', searchContent: 'line 2', replaceContent: 'LINE 2' },
      { filePath: '/test.ts', searchContent: 'line 4', replaceContent: 'LINE 4' },
      { filePath: '/test.ts', searchContent: 'line 1', replaceContent: 'LINE 1' },
    ];

    const sorted = sortEditsForApplication(edits, fileContent);

    expect(sorted[0].searchContent).toBe('line 4');
    expect(sorted[1].searchContent).toBe('line 2');
    expect(sorted[2].searchContent).toBe('line 1');
  });
});

describe('groupEditsByFile', () => {
  it('groups edits by file path', () => {
    const edits = [
      { filePath: '/a.ts', searchContent: 'a1', replaceContent: 'A1' },
      { filePath: '/b.ts', searchContent: 'b1', replaceContent: 'B1' },
      { filePath: '/a.ts', searchContent: 'a2', replaceContent: 'A2' },
    ];

    const grouped = groupEditsByFile(edits);

    expect(grouped.size).toBe(2);
    expect(grouped.get('/a.ts')).toHaveLength(2);
    expect(grouped.get('/b.ts')).toHaveLength(1);
  });
});
