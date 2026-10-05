import type { DataStreamWriter } from 'ai';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MCPService,
  mcpConfigSchema,
  mcpServerConfigSchema,
  sseServerConfigSchema,
  stdioServerConfigSchema,
  streamableHTTPServerConfigSchema,
} from './mcpService';
import { TOOL_EXECUTION_APPROVAL } from '~/utils/constants';

/*
 * `processToolInvocations` is the only place bolt turns a user-approved MCP tool
 * call into an executed tool call and forwards the result to the client. It also
 * emits one of the few wire parts bolt writes by hand, so it is pinned here
 * before the AI SDK upgrade changes the surrounding stream API.
 */

type TestWriter = DataStreamWriter & {
  write: ReturnType<typeof vi.fn>;
  writeMessageAnnotation: ReturnType<typeof vi.fn>;
};

function createWriter(): TestWriter {
  return { write: vi.fn(), writeMessageAnnotation: vi.fn() } as unknown as TestWriter;
}

function serviceWithTools(tools: Record<string, unknown>) {
  const internals = MCPService.getInstance() as unknown as {
    _tools: Record<string, unknown>;
    _toolsWithoutExecute: Record<string, unknown>;
    _toolNamesToServerNames: Map<string, string>;
  };

  internals._tools = tools;
  internals._toolsWithoutExecute = Object.fromEntries(
    Object.entries(tools).map(([name, tool]) => [name, { ...(tool as object), execute: undefined }]),
  );
  internals._toolNamesToServerNames = new Map(Object.keys(tools).map((name) => [name, 'test-server']));

  return internals as unknown as MCPService;
}

function messageWithParts(parts: unknown[]) {
  return [{ id: 'm1', role: 'user', content: 'run it', parts }] as never[];
}

function toolInvocationPart(toolName: string, state: string, result: unknown, args: Record<string, unknown> = {}) {
  return {
    type: 'tool-invocation',
    toolInvocation: { state, toolName, toolCallId: `call-${toolName}`, args, result },
  };
}

function resultOf(messages: unknown) {
  const parts = (messages as Array<{ parts?: unknown }>)[0].parts as Array<{ toolInvocation?: { result: unknown } }>;

  return parts[0]?.toolInvocation?.result;
}

describe('MCPService.processToolInvocations', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns messages untouched when the last message has no parts', async () => {
    const service = MCPService.getInstance();
    const messages = [{ id: 'm1', role: 'user', content: 'hi' }] as never[];

    await expect(service.processToolInvocations(messages, createWriter())).resolves.toBe(messages);
  });

  it('leaves non-tool parts alone', async () => {
    const service = serviceWithTools({});
    const writer = createWriter();
    const part = { type: 'text', text: 'hello' };

    const result = await service.processToolInvocations(messageWithParts([part]), writer);

    expect(result[0].parts).toEqual([part]);
    expect(writer.write).not.toHaveBeenCalled();
  });

  it('leaves tool calls that are not awaiting a result alone', async () => {
    const service = serviceWithTools({ search: { execute: vi.fn() } });
    const writer = createWriter();
    const part = toolInvocationPart('search', 'call', undefined);

    const result = await service.processToolInvocations(messageWithParts([part]), writer);

    expect(result[0].parts).toEqual([part]);
    expect(writer.write).not.toHaveBeenCalled();
  });

  it('leaves results for unknown tools alone', async () => {
    const service = serviceWithTools({});
    const writer = createWriter();
    const part = toolInvocationPart('ghost', 'result', TOOL_EXECUTION_APPROVAL.APPROVE);

    const result = await service.processToolInvocations(messageWithParts([part]), writer);

    expect(result[0].parts).toEqual([part]);
  });

  it('executes an approved tool and forwards the result to the client', async () => {
    const execute = vi.fn().mockResolvedValue('tool output');
    const service = serviceWithTools({ search: { execute } });
    const writer = createWriter();
    const part = toolInvocationPart('search', 'result', TOOL_EXECUTION_APPROVAL.APPROVE, { query: 'bolt' });

    const result = await service.processToolInvocations(messageWithParts([part]), writer);

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0][0]).toEqual({ query: 'bolt' });
    expect(resultOf(result)).toBe('tool output');
    expect(writer.write).toHaveBeenCalledTimes(1);

    const written = String(writer.write.mock.calls[0][0]);

    expect(written.startsWith('a:')).toBe(true);
    expect(written).toContain('"toolCallId":"call-search"');
    expect(written).toContain('tool output');
  });

  it('reports a tool error instead of throwing when execution fails', async () => {
    const service = serviceWithTools({ search: { execute: vi.fn().mockRejectedValue(new Error('boom')) } });
    const writer = createWriter();

    const result = await service.processToolInvocations(
      messageWithParts([toolInvocationPart('search', 'result', TOOL_EXECUTION_APPROVAL.APPROVE)]),
      writer,
    );

    expect(resultOf(result)).toBe('Error: An error occured while calling tool');
    expect(writer.write).toHaveBeenCalledTimes(1);
  });

  it('reports a missing execute function', async () => {
    const service = serviceWithTools({ search: { description: 'no execute here' } });
    const writer = createWriter();

    const result = await service.processToolInvocations(
      messageWithParts([toolInvocationPart('search', 'result', TOOL_EXECUTION_APPROVAL.APPROVE)]),
      writer,
    );

    expect(resultOf(result)).toBe('Error: No execute function found on tool');
  });

  it('denies a rejected tool call without executing it', async () => {
    const execute = vi.fn();
    const service = serviceWithTools({ search: { execute } });
    const writer = createWriter();

    const result = await service.processToolInvocations(
      messageWithParts([toolInvocationPart('search', 'result', TOOL_EXECUTION_APPROVAL.REJECT)]),
      writer,
    );

    expect(execute).not.toHaveBeenCalled();
    expect(resultOf(result)).toBe('Error: User denied access to tool execution');
  });

  it('ignores unrecognised approval responses', async () => {
    const service = serviceWithTools({ search: { execute: vi.fn() } });
    const writer = createWriter();
    const part = toolInvocationPart('search', 'result', 'maybe?');

    const result = await service.processToolInvocations(messageWithParts([part]), writer);

    expect(result[0].parts).toEqual([part]);
    expect(writer.write).not.toHaveBeenCalled();
  });

  it('only rewrites the tool part and keeps the rest of the message intact', async () => {
    const service = serviceWithTools({ search: { execute: vi.fn().mockResolvedValue('done') } });

    const messages = [
      { id: 'm0', role: 'user', content: 'earlier' },
      { id: 'm1', role: 'user', content: 'run it', parts: [{ type: 'text', text: 'run it' }] },
    ] as never[];

    const result = await service.processToolInvocations(messages, createWriter());

    expect(result).toHaveLength(2);
    expect(result[0]).toBe(messages[0]);
    expect(result[1].parts).toEqual([{ type: 'text', text: 'run it' }]);
  });
});

describe('MCPService.processToolCall', () => {
  it('annotates the stream with server and tool metadata', () => {
    const service = serviceWithTools({ search: { description: 'searches the web', execute: vi.fn() } });
    const writer = createWriter();

    service.processToolCall({ type: 'tool-call', toolCallId: 'call-1', toolName: 'search', args: {} }, writer);

    expect(writer.writeMessageAnnotation).toHaveBeenCalledWith({
      type: 'toolCall',
      toolCallId: 'call-1',
      serverName: 'test-server',
      toolName: 'search',
      toolDescription: 'searches the web',
    });
  });

  it('falls back to a placeholder description', () => {
    const service = serviceWithTools({ search: { execute: vi.fn() } });
    const writer = createWriter();

    service.processToolCall({ type: 'tool-call', toolCallId: 'call-1', toolName: 'search', args: {} }, writer);

    expect(writer.writeMessageAnnotation).toHaveBeenCalledWith(
      expect.objectContaining({ toolDescription: 'No description available' }),
    );
  });

  it('writes nothing for an unknown tool', () => {
    const service = serviceWithTools({});
    const writer = createWriter();

    service.processToolCall({ type: 'tool-call', toolCallId: 'call-1', toolName: 'ghost', args: {} }, writer);

    expect(writer.writeMessageAnnotation).not.toHaveBeenCalled();
  });

  it('reports whether a tool name is known', () => {
    const service = serviceWithTools({ search: { execute: vi.fn() } });

    expect(service.isValidToolName('search')).toBe(true);
    expect(service.isValidToolName('ghost')).toBe(false);
  });
});

describe('MCP config schemas', () => {
  it('accepts a stdio server config', () => {
    const parsed = stdioServerConfigSchema.parse({ type: 'stdio', command: 'node', args: ['server.js'] });

    expect(parsed.command).toBe('node');
  });

  it('rejects a stdio config without a command', () => {
    expect(stdioServerConfigSchema.safeParse({ type: 'stdio' }).success).toBe(false);
  });

  it('accepts sse and streamable-http configs', () => {
    expect(sseServerConfigSchema.safeParse({ type: 'sse', url: 'https://example.com/sse' }).success).toBe(true);
    expect(
      streamableHTTPServerConfigSchema.safeParse({ type: 'streamable-http', url: 'https://example.com/mcp' }).success,
    ).toBe(true);
  });

  it('rejects a malformed url', () => {
    expect(sseServerConfigSchema.safeParse({ type: 'sse', url: 'not a url' }).success).toBe(false);
  });

  it('unions the transport types', () => {
    expect(mcpServerConfigSchema.safeParse({ type: 'stdio', command: 'node' }).success).toBe(true);
    expect(mcpServerConfigSchema.safeParse({ type: 'sse', url: 'https://example.com' }).success).toBe(true);
    expect(mcpServerConfigSchema.safeParse({ type: 'carrier-pigeon' }).success).toBe(false);
  });

  it('parses a full config keyed by server name', () => {
    const config = mcpConfigSchema.parse({ mcpServers: { local: { type: 'stdio', command: 'node' } } });

    expect(Object.keys(config.mcpServers)).toEqual(['local']);
  });
});
