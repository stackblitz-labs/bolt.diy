import type { Tool } from 'ai';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import McpServerListItem from './McpServerListItem';

describe('McpServerListItem', () => {
  it('renders an MCP schema after it has crossed the JSON response boundary', () => {
    const tool = JSON.parse(
      JSON.stringify({
        description: 'Run a browser task',
        inputSchema: {
          jsonSchema: {
            type: 'object',
            properties: { task: { type: 'string', description: 'The browser task' } },
            required: ['task'],
          },
          validate: () => true,
        },
      }),
    ) as Tool;

    const markup = renderToStaticMarkup(
      createElement(McpServerListItem, { toolName: 'browser_task', toolSchema: tool }),
    );

    expect(markup).toContain('browser_task');
    expect(markup).toContain('The browser task');
    expect(markup).toContain('string');
    expect(markup).toContain('>*</span>');
  });
});
