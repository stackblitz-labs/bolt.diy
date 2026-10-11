import { dynamicTool, jsonSchema, type ToolSet } from 'ai';
import { z } from 'zod';
import { fetchPageContent } from './fetch-page';
import { MAX_RESULTS_LIMIT, searchWeb, type WebSearchEnv } from './search';
import { WebSearchError } from './types';
import { formatPageContent, formatSearchResults } from '~/utils/webSearchFormat';

/**
 * Context the chat route passes to tool executions (see
 * `MCPService.processToolInvocations`). Search keys live in the server env,
 * which isn't reachable from a singleton, so they travel with each call.
 */
export interface WebToolContext {
  webSearchEnv?: WebSearchEnv;
}

/** Same shape an external MCP server returns from `tools/call`. */
interface CallToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

const webSearchInput = z.object({
  query: z.string().trim().min(1),
  max_results: z.number().int().min(1).max(MAX_RESULTS_LIMIT).optional(),
});

const fetchUrlInput = z.object({
  url: z.string().trim().min(1),
});

function textResult(text: string): CallToolResult {
  return { content: [{ type: 'text', text }] };
}

/*
 * Errors go back to the model as an `isError` result rather than a throw, so
 * it can see why (blocked URL, missing key, rate limit) and adjust instead of
 * getting bolt's generic "tool execution failed".
 */
function errorResult(error: unknown): CallToolResult {
  let message = 'Request failed';

  if (error instanceof WebSearchError) {
    message = error.message;
  } else if (error instanceof z.ZodError) {
    message = `Invalid arguments: ${error.issues.map((issue) => `${issue.path.join('.')} ${issue.message}`).join('; ')}`;
  } else if (error instanceof DOMException && error.name === 'TimeoutError') {
    message = 'Request timed out after 10 seconds';
  }

  return { content: [{ type: 'text', text: message }], isError: true };
}

function getEnv(options: unknown): WebSearchEnv {
  return (options as { context?: WebToolContext } | undefined)?.context?.webSearchEnv ?? {};
}

/**
 * Tools exposed by the built-in `bolt-web` MCP server. They run in-process,
 * so they work on every deployment target (including Cloudflare, where stdio
 * MCP servers can't run) and reuse the SSRF-hardened fetcher.
 */
export function createWebMcpTools(): ToolSet {
  return {
    web_search: dynamicTool({
      description:
        'Search the web for up-to-date information such as library documentation, API references, error ' +
        'messages or release notes. Returns titles, URLs and snippets; call fetch_url to read a result in full.',
      inputSchema: jsonSchema({
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query' },
          max_results: {
            type: 'integer',
            description: `Number of results to return (1-${MAX_RESULTS_LIMIT}, default 5)`,
            minimum: 1,
            maximum: MAX_RESULTS_LIMIT,
          },
        },
        required: ['query'],
        additionalProperties: false,
      }),
      execute: async (input, options) => {
        try {
          const { query, max_results: maxResults } = webSearchInput.parse(input);
          const data = await searchWeb(query, getEnv(options), { maxResults });

          if (data.results.length === 0) {
            return textResult(`No results found for "${data.query}".`);
          }

          return textResult(formatSearchResults(data.query, data.results));
        } catch (error) {
          return errorResult(error);
        }
      },
    }),
    fetch_url: dynamicTool({
      description:
        'Fetch a public web page and return its readable text (scripts, navigation and styling removed). ' +
        'Use it to read documentation, guides or articles. Only public http(s) URLs are allowed.',
      inputSchema: jsonSchema({
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The full http(s) URL to fetch' },
        },
        required: ['url'],
        additionalProperties: false,
      }),
      execute: async (input) => {
        try {
          const { url } = fetchUrlInput.parse(input);

          return textResult(formatPageContent(await fetchPageContent(url)));
        } catch (error) {
          return errorResult(error);
        }
      },
    }),
  };
}
