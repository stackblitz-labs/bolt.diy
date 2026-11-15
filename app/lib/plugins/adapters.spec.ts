import { describe, expect, it } from 'vitest';
import { executeTextUtility, getPluginToolName, getPluginTools } from './adapters';

const plugin = {
  id: 'boltdiy.text-utilities',
  adapter: 'text-utils' as const,
  tools: ['count', 'transform'] as Array<'count' | 'transform'>,
};

describe('reviewed text utility plugin adapter', () => {
  it('does not expose tools unless the plugin is enabled', () => {
    expect(Object.keys(getPluginTools([]))).toEqual([]);
  });

  it('namespaces tools for each installed plugin', () => {
    const names = Object.keys(getPluginTools([plugin]));

    expect(names).toEqual([getPluginToolName(plugin.id, 'count'), getPluginToolName(plugin.id, 'transform')]);
    expect(names.every((name) => name.length <= 64)).toBe(true);
  });

  it('applies the existing per-tool disabled list', () => {
    expect(Object.keys(getPluginTools([plugin], [getPluginToolName(plugin.id, 'count')]))).toEqual([
      getPluginToolName(plugin.id, 'transform'),
    ]);
  });

  it('exposes tool schemas without server-side execution handlers', () => {
    const tools = getPluginTools([plugin]);

    expect(tools[getPluginToolName(plugin.id, 'count')].execute).toBeUndefined();
    expect(tools[getPluginToolName(plugin.id, 'transform')].execute).toBeUndefined();
  });

  it('executes only validated deterministic inputs in the local adapter', () => {
    expect(executeTextUtility('count', { text: 'one two', includeSpaces: false })).toEqual({
      characters: 6,
      words: 2,
      lines: 1,
    });
    expect(executeTextUtility('transform', { text: 'b\na\na', operation: 'unique-lines' })).toEqual({
      text: 'b\na',
    });
    expect(() => executeTextUtility('count', { text: 'x', unexpected: true })).toThrow();
  });
});
