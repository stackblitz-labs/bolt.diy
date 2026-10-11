import { render, screen } from '@testing-library/react';
import { jsonSchema, type Tool } from 'ai';
import { describe, expect, it } from 'vitest';
import McpServerListItem from './McpServerListItem';

const tool = {
  description: 'Fetch a page',
  inputSchema: jsonSchema({
    type: 'object',
    properties: {
      url: { type: 'string', description: 'The URL to fetch' },
      max_length: { type: 'integer' },
    },
    required: ['url'],
  }),
} as unknown as Tool;

describe('McpServerListItem', () => {
  it('renders tools that arrived as JSON from the server', () => {
    // This is what the settings UI actually receives from /api/mcp-update-config
    const fromServer = JSON.parse(JSON.stringify(tool)) as Tool;

    render(<McpServerListItem toolName="fetch_url" toolSchema={fromServer} />);

    expect(screen.getByText('fetch_url')).toBeTruthy();
    expect(screen.getByText('Fetch a page')).toBeTruthy();
    expect(screen.getByText('url')).toBeTruthy();
    expect(screen.getByText('The URL to fetch')).toBeTruthy();
    expect(screen.getByText('max_length')).toBeTruthy();
  });

  it('renders live jsonSchema() instances', () => {
    render(<McpServerListItem toolName="fetch_url" toolSchema={tool} />);

    expect(screen.getByText('The URL to fetch')).toBeTruthy();
  });

  it('handles tools without an input schema', () => {
    render(<McpServerListItem toolName="ping" toolSchema={{ description: 'Ping' } as Tool} />);

    expect(screen.getByText('ping')).toBeTruthy();
    expect(screen.queryByText('Parameters:')).toBeNull();
  });
});
