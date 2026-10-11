// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import McpServerList from './McpServerList';
import McpToolErrorBoundary from './McpToolErrorBoundary';
import type { MCPServer } from '~/lib/services/mcpService';

// Remix's development transform expects the browser preamble, which Vitest does not load.
vi.hoisted(() => {
  Object.assign(window, { __vite_plugin_react_preamble_installed__: true });
});

/*
 * Tools reach the settings tab as JSON over /api/mcp-update-config, so the AI SDK Schema
 * wrapper is already reduced to a bare { jsonSchema } object by the time it is rendered.
 */
const serializedParallelTools = {
  web_search: {
    description: 'Search the web.',
    type: 'dynamic',
    inputSchema: {
      jsonSchema: {
        type: 'object',
        title: 'v1_search_toolArguments',
        required: ['objective', 'search_queries'],
        properties: {
          objective: { type: 'string', title: 'Objective', description: 'What the search is trying to find.' },
          search_queries: {
            type: 'array',
            items: { type: 'string' },
            title: 'Search Queries',
            description: 'Concise keyword search queries.',
          },
          session_id: { type: 'string', description: 'Stable conversation identifier.', maxLength: 100 },
        },
      },
    },
  },
  web_fetch: {
    description: 'Fetch page content.',
    type: 'dynamic',
    inputSchema: {
      jsonSchema: {
        type: 'object',
        required: ['urls'],
        properties: {
          urls: { type: 'array', items: { type: 'string' }, description: 'List of URLs to extract content from.' },
          objective: { anyOf: [{ type: 'string' }, { type: 'null' }], default: null, title: 'Objective' },
          full_content: { type: 'boolean', default: false, description: 'Return the entire page as markdown.' },
        },
      },
    },
  },
};

const hostileTools = {
  'union-type': {
    description: 'Accepts several types.',
    inputSchema: { jsonSchema: { type: 'object', properties: { value: { type: ['string', 'null'] } } } },
  },
  'nested-object': {
    inputSchema: {
      jsonSchema: {
        type: 'object',
        required: 'not-an-array',
        properties: {
          filters: {
            type: 'object',
            description: { text: 'descriptions are meant to be strings' },
            properties: { since: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } } },
          },
        },
      },
    },
  },
  'lazy-schema': { inputSchema: { jsonSchema: () => ({ type: 'object', properties: { q: { type: 'string' } } }) } },
  'throwing-schema': {
    inputSchema: {
      get jsonSchema() {
        throw new Error('schema resolution failed');
      },
    },
  },
  'async-schema': { inputSchema: { jsonSchema: Promise.resolve({ properties: { q: { type: 'string' } } }) } },
  'raw-schema': { inputSchema: { type: 'object', properties: { q: { type: 'string' } } } },
  'function-description': { description: () => 'callable descriptions cannot be rendered', inputSchema: undefined },
  'string-schema': { inputSchema: 'not a schema at all' },
  'no-schema': {},
  'null-tool': null,
};

function availableServer(tools: unknown): MCPServer {
  return {
    status: 'available',
    tools,
    client: null,
    config: { type: 'streamable-http', url: 'https://search.parallel.ai/mcp' },
  } as unknown as MCPServer;
}

function renderExpanded(serverName: string, tools: unknown) {
  return render(
    <McpServerList
      serverEntries={[[serverName, availableServer(tools)]]}
      expandedServer={serverName}
      checkingServers={false}
      toggleServerExpanded={vi.fn()}
    />,
  );
}

afterEach(cleanup);

describe('McpServerList expanded tools', () => {
  it('renders Parallel Search tools as they arrive from the server', () => {
    renderExpanded('parallel-search', serializedParallelTools);

    expect(screen.getByText('web_search')).toBeTruthy();
    expect(screen.getByText('Search the web.')).toBeTruthy();
    expect(screen.getByText('What the search is trying to find.')).toBeTruthy();
    expect(screen.getAllByText('array').length).toBe(2);

    // anyOf-only properties still need a readable type.
    expect(screen.getByText('string | null')).toBeTruthy();
  });

  it('marks required parameters and leaves optional ones unmarked', () => {
    renderExpanded('parallel-search', serializedParallelTools);

    // `objective` is required on web_search and optional on web_fetch.
    expect(screen.getAllByText('objective').map((element) => element.textContent)).toEqual(['objective*', 'objective']);
    expect(screen.getByText('session_id').textContent).toBe('session_id');
  });

  it('does not throw on malformed, lazy, async or missing tool schemas', () => {
    expect(() => renderExpanded('hostile', hostileTools)).not.toThrow();

    expect(screen.getByText('no-schema')).toBeTruthy();
    expect(screen.getByText('throwing-schema')).toBeTruthy();
    expect(screen.getAllByText('No description available').length).toBeGreaterThan(0);
  });

  it('renders union types and nested object parameters as display strings', () => {
    renderExpanded('hostile', hostileTools);

    expect(screen.getByText('string | null')).toBeTruthy();
    expect(screen.getByText('filters')).toBeTruthy();

    // A non-string description must be serialized rather than handed to React as an object.
    expect(screen.getByText('{"text":"descriptions are meant to be strings"}')).toBeTruthy();
  });

  it('keeps the list rendered when a server reports no tools object', () => {
    expect(() => renderExpanded('broken', undefined)).not.toThrow();
    expect(screen.getByText('No tools available')).toBeTruthy();
  });
});

describe('McpToolErrorBoundary', () => {
  it('contains a tool that fails to render', () => {
    // React reports every error an error boundary catches; the test expects this one.
    vi.spyOn(console, 'error').mockImplementation(vi.fn());

    function Exploding(): never {
      throw new Error('boom');
    }

    render(
      <>
        <McpToolErrorBoundary toolName="web_search">
          <Exploding />
        </McpToolErrorBoundary>
        <McpToolErrorBoundary toolName="web_fetch">
          <span>web_fetch renders fine</span>
        </McpToolErrorBoundary>
      </>,
    );

    expect(screen.getByText("This tool's schema could not be displayed.")).toBeTruthy();
    expect(screen.getByText('web_fetch renders fine')).toBeTruthy();

    vi.mocked(console.error).mockRestore();
  });
});
