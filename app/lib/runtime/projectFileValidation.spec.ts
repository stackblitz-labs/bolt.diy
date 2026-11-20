import { describe, expect, it } from 'vitest';
import { getFileRevision, validateProjectSource } from './projectFileValidation';

const misplacedMap = `export const App = () => (
  <ul>
    {[[1, 'Work']] as const}.map(
      ([id, label]) => <li key={id}>{label}</li>
    )}
  </ul>
);
`;

const fixedMap = misplacedMap.replace("{[[1, 'Work']] as const}", "{([[1, 'Work']] as const)");

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
    await expect(validateProjectSource(filePath, content)).resolves.toEqual({ content });
  });

  it('rejects the flattened import and function shown in the failed preview', async () => {
    await expect(
      validateProjectSource('src/App.tsx', "import { ArrowRight } from 'lucide-react' function App() {}"),
    ).rejects.toThrow(/File was not saved.*one line.*smaller complete modules/);
  });

  it('rejects incomplete JSX while allowing non-JS files to use their own syntax', async () => {
    await expect(validateProjectSource('App.tsx', 'export const App = () => <main>')).rejects.toThrow(
      'Syntax check failed',
    );
    await expect(validateProjectSource('page.md', '<main>')).resolves.toEqual({ content: '<main>' });
  });

  it.each(['\n', '\r\n'])('fixes the misplaced JSX map brace while preserving %j line endings', async (newline) => {
    const source = misplacedMap.replace(/\n/g, newline);
    await expect(validateProjectSource('PomodoroTimer.tsx', source, { repairJsxMap: true })).resolves.toEqual({
      content: fixedMap.replace(/\n/g, newline),
      sourceRepair: expect.stringContaining('.map()'),
    });
  });

  it('provides a focused correction when validation does not allow automatic edits', async () => {
    await expect(validateProjectSource('PomodoroTimer.tsx', misplacedMap)).rejects.toThrow('Keep the whole .map()');
  });

  it('rejects a correction when a separate syntax error remains', async () => {
    await expect(
      validateProjectSource('PomodoroTimer.tsx', `${misplacedMap}\nexport const broken =`, { repairJsxMap: true }),
    ).rejects.toThrow('File was not saved');
  });
});
