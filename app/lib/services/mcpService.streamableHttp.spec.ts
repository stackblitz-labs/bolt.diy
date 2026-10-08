import { createServer, type Server } from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { UIMessage, UIMessageStreamWriter } from 'ai';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { z } from 'zod';
import { MCPService } from './mcpService';
import { getToolOutput } from '~/lib/persistence/messageMigration';
import { TOOL_EXECUTION_APPROVAL, TOOL_EXECUTION_DENIED, TOOL_EXECUTION_ERROR } from '~/utils/constants';

const payload = { results: [{ url: 'https://example.com/docs', title: 'Docs', excerpts: ['A useful excerpt.'] }] };

let httpServer: Server;
let service: MCPService;
let failure: 'quota' | 'tool' | 'http' | undefined;
let calls: Mock<(args: unknown) => void>;

beforeEach(async () => {
  failure = undefined;
  calls = vi.fn<(args: unknown) => void>();
  service = new MCPService();
  httpServer = createServer(async (req, res) => {
    const chunks = [];

    for await (const chunk of req) {
      chunks.push(chunk);
    }

    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : undefined;

    if (body?.method === 'tools/call' && (failure === 'quota' || failure === 'http')) {
      res.writeHead(failure === 'http' ? 429 : 200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, error: { code: -32000, message: 'Rate limit reached' } }));

      return;
    }

    // Stateless Streamable HTTP: the SDK requires a fresh server and transport per request.
    const server = new McpServer({ name: 'search-fixture', version: '1.0.0' });
    server.tool('web_search', { objective: z.string(), search_queries: z.array(z.string()) }, async (args) => {
      calls(args);
      return failure === 'tool'
        ? { isError: true, content: [{ type: 'text', text: 'Search failed' }] }
        : { content: [{ type: 'text', text: JSON.stringify(payload) }] };
    });

    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => void server.close());
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  });
  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));

  const address = httpServer.address();

  if (!address || typeof address === 'string') {
    throw new Error('Fixture failed to listen');
  }

  await service.updateConfig({
    mcpServers: { search: { type: 'streamable-http', url: `http://127.0.0.1:${address.port}/mcp` } },
  });
});

afterEach(async () => {
  await service.updateConfig({ mcpServers: {} });
  httpServer.closeAllConnections();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
});

async function invoke(approval: string) {
  const messages = [
    {
      id: 'response',
      role: 'assistant',
      content: '',
      parts: [
        {
          type: 'tool-invocation',
          toolInvocation: {
            state: 'result',
            toolCallId: 'search-call',
            toolName: 'web_search',
            args: { objective: 'Find docs', search_queries: ['example docs'] },
            result: approval,
          },
        },
      ],
    },
  ] as unknown as UIMessage[];

  const write = vi.fn();

  const processed = await service.processToolInvocations(messages, {
    write,
    merge: vi.fn(),
  } as unknown as UIMessageStreamWriter);
  expect(write).toHaveBeenCalledOnce();

  // v5 stores the result in `output`; read through the shared accessor like mcpService.spec.ts.
  return getToolOutput(processed[0].parts[0]) as any;
}

describe('Streamable HTTP tools in chat', () => {
  it('discovers tools, retains result content and URLs, and requires approval to execute', async () => {
    expect(service.toolsWithoutExecute.web_search).toBeDefined();
    expect(service.toolsWithoutExecute.web_search.execute).toBeUndefined();
    expect(await invoke(TOOL_EXECUTION_APPROVAL.REJECT)).toBe(TOOL_EXECUTION_DENIED);
    expect(calls).not.toHaveBeenCalled();

    const result = await invoke(TOOL_EXECUTION_APPROVAL.APPROVE);
    expect(JSON.parse(result.content[0].text)).toEqual(payload);
    expect(calls).toHaveBeenCalledWith({ objective: 'Find docs', search_queries: ['example docs'] });
  });

  it.each(['quota', 'http'] as const)('surfaces %s failures as execution errors, not empty results', async (mode) => {
    failure = mode;
    expect(await invoke(TOOL_EXECUTION_APPROVAL.APPROVE)).toBe(TOOL_EXECUTION_ERROR);
  });

  it('preserves MCP tool error content and its error flag', async () => {
    failure = 'tool';
    expect(await invoke(TOOL_EXECUTION_APPROVAL.APPROVE)).toEqual({
      isError: true,
      content: [{ type: 'text', text: 'Search failed' }],
    });
  });
});
