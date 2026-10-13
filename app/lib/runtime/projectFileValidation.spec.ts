import { describe, expect, it } from 'vitest';
import { assertValidProjectSource, getFileRevision } from './projectFileValidation';

describe('project source validation', () => {
  it('returns stable revisions that change with even a line-ending edit', async () => {
    const revision = await getFileRevision('hello\n');
    expect(await getFileRevision('hello\n')).toBe(revision);
    expect(await getFileRevision('hello\r\n')).not.toBe(revision);
  });

  it.each([
    ['App.tsx', "import React from 'react'\nexport default function App() { return <main>Hello</main> }\n"],
    ['main.mts', 'export const count: number = 1;'],
    ['main.jsx', 'export const App = () => <main>Hello</main>;'],
    ['main.cjs', 'module.exports = { value: 1 };'],
  ])('accepts valid %s without changing supplied content', async (filePath, content) => {
    await expect(assertValidProjectSource(filePath, content)).resolves.toBeUndefined();
  });

  it('rejects the flattened import and function shown in the failed preview', async () => {
    await expect(
      assertValidProjectSource('src/App.tsx', "import { ArrowRight } from 'lucide-react' function App() {}"),
    ).rejects.toThrow('File was not saved');
  });

  it('rejects incomplete JSX while allowing non-JS files to use their own syntax', async () => {
    await expect(assertValidProjectSource('App.tsx', 'export const App = () => <main>')).rejects.toThrow(
      'Syntax check failed',
    );
    await expect(assertValidProjectSource('page.md', '<main>')).resolves.toBeUndefined();
  });
});
