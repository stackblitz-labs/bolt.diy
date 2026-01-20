---
name: mcp-tools-and-servers
description: Use when working with Model Context Protocol (MCP) tools and servers. Covers MCPService singleton, tool registration, STDIO/SSE/Streamable-HTTP transports, tool invocation lifecycle, api.mcp routes, and MCP configuration. Triggers include "MCP", "MCPService", "mcp server", "mcp tool", "tool call", "tool invocation", "api.mcp-update-config", "experimental_createMCPClient", "stdio transport", "sse transport", "streamable-http".
---

# MCP Tools & Servers Skill

## Goal

Integrate Model Context Protocol (MCP) tools and servers for extending AI capabilities with external tools.

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   api.chat.ts   │───▶│   MCPService    │───▶│  MCP Servers    │
│                 │    │   (singleton)   │    │  (STDIO/SSE)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   Tool Calls    │
                       │   (approve/     │
                       │    reject)      │
                       └─────────────────┘
```

## MCPService Singleton

```typescript
// app/lib/services/mcpService.ts
import {
  experimental_createMCPClient,
  type ToolSet,
  type Message,
  type DataStreamWriter,
  convertToCoreMessages,
  formatDataStreamPart,
} from 'ai';
import { Experimental_StdioMCPTransport } from 'ai/mcp-stdio';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { z } from 'zod';

export class MCPService {
  private static _instance: MCPService;
  private _tools: ToolSet = {};
  private _toolsWithoutExecute: ToolSet = {};
  private _mcpToolsPerServer: MCPServerTools = {};
  private _toolNamesToServerNames = new Map<string, string>();
  private _config: MCPConfig = { mcpServers: {} };

  static getInstance(): MCPService {
    if (!MCPService._instance) {
      MCPService._instance = new MCPService();
    }
    return MCPService._instance;
  }

  // ... methods
}
```

## Server Configuration Schemas

```typescript
// STDIO Transport (local processes)
export const stdioServerConfigSchema = z.object({
  type: z.enum(['stdio']).optional(),
  command: z.string().min(1, 'Command cannot be empty'),
  args: z.array(z.string()).optional(),
  cwd: z.string().optional(),
  env: z.record(z.string()).optional(),
}).transform((data) => ({ ...data, type: 'stdio' as const }));

// SSE Transport (Server-Sent Events)
export const sseServerConfigSchema = z.object({
  type: z.enum(['sse']).optional(),
  url: z.string().url('URL must be valid'),
  headers: z.record(z.string()).optional(),
}).transform((data) => ({ ...data, type: 'sse' as const }));

// Streamable HTTP Transport
export const streamableHTTPServerConfigSchema = z.object({
  type: z.enum(['streamable-http']).optional(),
  url: z.string().url('URL must be valid'),
  headers: z.record(z.string()).optional(),
}).transform((data) => ({ ...data, type: 'streamable-http' as const }));

// Combined schema
export const mcpServerConfigSchema = z.union([
  stdioServerConfigSchema,
  sseServerConfigSchema,
  streamableHTTPServerConfigSchema,
]);

export const mcpConfigSchema = z.object({
  mcpServers: z.record(z.string(), mcpServerConfigSchema),
});
```

## Creating MCP Clients

```typescript
private async _createMCPClient(
  serverName: string,
  serverConfig: MCPServerConfig
): Promise<MCPClient> {
  const validatedConfig = this._validateServerConfig(serverName, serverConfig);

  if (validatedConfig.type === 'stdio') {
    return await this._createStdioClient(serverName, serverConfig);
  } else if (validatedConfig.type === 'sse') {
    return await this._createSSEClient(serverName, serverConfig);
  } else {
    return await this._createStreamableHTTPClient(serverName, serverConfig);
  }
}

private async _createStdioClient(
  serverName: string,
  config: STDIOServerConfig
): Promise<MCPClient> {
  logger.debug(`Creating STDIO client for '${serverName}': ${config.command}`);

  const client = await experimental_createMCPClient({
    transport: new Experimental_StdioMCPTransport(config),
  });

  return Object.assign(client, { serverName });
}

private async _createSSEClient(
  serverName: string,
  config: SSEServerConfig
): Promise<MCPClient> {
  logger.debug(`Creating SSE client for ${serverName}: ${config.url}`);

  const client = await experimental_createMCPClient({
    transport: config,
  });

  return Object.assign(client, { serverName });
}

private async _createStreamableHTTPClient(
  serverName: string,
  config: StreamableHTTPServerConfig
): Promise<MCPClient> {
  logger.debug(`Creating Streamable-HTTP client for ${serverName}: ${config.url}`);

  const client = await experimental_createMCPClient({
    transport: new StreamableHTTPClientTransport(new URL(config.url), {
      requestInit: { headers: config.headers },
    }),
  });

  return Object.assign(client, { serverName });
}
```

## Tool Registration

```typescript
private _registerTools(serverName: string, tools: ToolSet) {
  for (const [toolName, tool] of Object.entries(tools)) {
    // Warn on tool name conflicts
    if (this._tools[toolName]) {
      const existingServer = this._toolNamesToServerNames.get(toolName);
      if (existingServer && existingServer !== serverName) {
        logger.warn(
          `Tool conflict: "${toolName}" from "${serverName}" overrides "${existingServer}"`
        );
      }
    }

    this._tools[toolName] = tool;
    this._toolsWithoutExecute[toolName] = { ...tool, execute: undefined };
    this._toolNamesToServerNames.set(toolName, serverName);
  }
}
```

## Updating Configuration

```typescript
async updateConfig(config: MCPConfig) {
  logger.debug('Updating MCP config', JSON.stringify(config));
  this._config = config;
  await this._createClients();
  return this._mcpToolsPerServer;
}

private async _createClients() {
  await this._closeClients();  // Close existing clients

  const promises = Object.entries(this._config?.mcpServers || []).map(
    async ([serverName, config]) => {
      try {
        const client = await this._createMCPClient(serverName, config);
        const tools = await client.tools();
        
        this._registerTools(serverName, tools);
        this._mcpToolsPerServer[serverName] = {
          status: 'available',
          client,
          tools,
          config,
        };
      } catch (error) {
        logger.error(`Failed to init MCP client: ${serverName}`, error);
        this._mcpToolsPerServer[serverName] = {
          status: 'unavailable',
          error: (error as Error).message,
          client: null,
          config,
        };
      }
    }
  );

  await Promise.allSettled(promises);
}
```

## Processing Tool Calls

```typescript
// Annotate tool calls for UI
processToolCall(toolCall: ToolCall, dataStream: DataStreamWriter): void {
  const { toolCallId, toolName } = toolCall;

  if (this.isValidToolName(toolName)) {
    const { description = 'No description' } = this.toolsWithoutExecute[toolName];
    const serverName = this._toolNamesToServerNames.get(toolName);

    if (serverName) {
      dataStream.writeMessageAnnotation({
        type: 'toolCall',
        toolCallId,
        serverName,
        toolName,
        toolDescription: description,
      } satisfies ToolCallAnnotation);
    }
  }
}

// Process tool invocations with approval/rejection
async processToolInvocations(
  messages: Message[],
  dataStream: DataStreamWriter
): Promise<Message[]> {
  const lastMessage = messages[messages.length - 1];
  const parts = lastMessage.parts;

  if (!parts) return messages;

  const processedParts = await Promise.all(
    parts.map(async (part) => {
      if (part.type !== 'tool-invocation') return part;

      const { toolInvocation } = part;
      const { toolName, toolCallId } = toolInvocation;

      if (!this.isValidToolName(toolName) || toolInvocation.state !== 'result') {
        return part;
      }

      let result;

      if (toolInvocation.result === TOOL_EXECUTION_APPROVAL.APPROVE) {
        const toolInstance = this._tools[toolName];

        if (toolInstance?.execute) {
          try {
            result = await toolInstance.execute(toolInvocation.args, {
              messages: convertToCoreMessages(messages),
              toolCallId,
            });
          } catch (error) {
            logger.error(`Error calling tool "${toolName}":`, error);
            result = TOOL_EXECUTION_ERROR;
          }
        } else {
          result = TOOL_NO_EXECUTE_FUNCTION;
        }
      } else if (toolInvocation.result === TOOL_EXECUTION_APPROVAL.REJECT) {
        result = TOOL_EXECUTION_DENIED;
      } else {
        return part;
      }

      // Forward result to client
      dataStream.write(
        formatDataStreamPart('tool_result', { toolCallId, result })
      );

      return {
        ...part,
        toolInvocation: { ...toolInvocation, result },
      };
    })
  );

  return [...messages.slice(0, -1), { ...lastMessage, parts: processedParts }];
}
```

## API Routes

### Update MCP Config

```typescript
// app/routes/api.mcp-update-config.ts
import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { MCPService, type MCPConfig } from '~/lib/services/mcpService';

export async function action({ request }: ActionFunctionArgs) {
  try {
    const mcpConfig = await request.json<MCPConfig>();

    if (!mcpConfig || typeof mcpConfig !== 'object') {
      return Response.json(
        { error: 'Invalid MCP servers configuration' },
        { status: 400 }
      );
    }

    const mcpService = MCPService.getInstance();
    const serverTools = await mcpService.updateConfig(mcpConfig);

    return Response.json(serverTools);
  } catch (error) {
    logger.error('Error updating MCP config:', error);
    return Response.json(
      { error: 'Failed to update MCP config' },
      { status: 500 }
    );
  }
}
```

### Check MCP Server Status

```typescript
// app/routes/api.mcp-check.ts
import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { MCPService } from '~/lib/services/mcpService';

export async function action({ request }: ActionFunctionArgs) {
  try {
    const mcpService = MCPService.getInstance();
    const serverTools = await mcpService.checkServersAvailabilities();
    return Response.json(serverTools);
  } catch (error) {
    logger.error('Error checking MCP servers:', error);
    return Response.json(
      { error: 'Failed to check MCP servers' },
      { status: 500 }
    );
  }
}
```

## Usage in api.chat.ts

```typescript
const mcpService = MCPService.getInstance();

// Get tools without execute functions (for LLM tool definitions)
const mcpTools = mcpService.toolsWithoutExecute;

// Process tool calls in streaming response
for await (const part of result.fullStream) {
  if (part.type === 'tool-call') {
    mcpService.processToolCall(part, dataStream);
  }
}

// Process tool invocations before continuing
const processedMessages = await mcpService.processToolInvocations(
  messages,
  dataStream
);
```

## MCP Store

```typescript
// app/lib/stores/mcp.ts
import { map } from 'nanostores';

export interface MCPServerState {
  status: 'available' | 'unavailable' | 'connecting';
  tools?: string[];
  error?: string;
}

export const mcpServersStore = map<Record<string, MCPServerState>>({});

// Update server status
export function updateMCPServerStatus(
  serverName: string,
  status: MCPServerState
) {
  mcpServersStore.setKey(serverName, status);
}
```

## Configuration Examples

### STDIO Server (Local)

```json
{
  "mcpServers": {
    "filesystem": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"]
    }
  }
}
```

### SSE Server (Remote)

```json
{
  "mcpServers": {
    "remote-tools": {
      "type": "sse",
      "url": "https://mcp.example.com/sse",
      "headers": {
        "Authorization": "Bearer token123"
      }
    }
  }
}
```

### Streamable HTTP

```json
{
  "mcpServers": {
    "http-server": {
      "type": "streamable-http",
      "url": "https://mcp.example.com/stream",
      "headers": {
        "X-API-Key": "key123"
      }
    }
  }
}
```

## Constants

```typescript
// app/utils/constants.ts
export const TOOL_EXECUTION_APPROVAL = {
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
} as const;

export const TOOL_EXECUTION_ERROR = 'Tool execution failed';
export const TOOL_EXECUTION_DENIED = 'Tool execution denied by user';
export const TOOL_NO_EXECUTE_FUNCTION = 'Tool has no execute function';
```

## Checklist

- [ ] Use `MCPService.getInstance()` singleton pattern
- [ ] Validate config with Zod schemas before updating
- [ ] Handle all three transport types (STDIO, SSE, Streamable-HTTP)
- [ ] Log tool conflicts when registering
- [ ] Close existing clients before creating new ones
- [ ] Handle tool approval/rejection flow
- [ ] Forward tool results to client via dataStream
- [ ] Use `toolsWithoutExecute` for LLM tool definitions
- [ ] Handle unavailable servers gracefully
- [ ] Check server availability before tool calls

## References

- `app/lib/services/mcpService.ts` - Main MCPService implementation
- `app/routes/api.mcp-update-config.ts` - Config update route
- `app/routes/api.mcp-check.ts` - Server status check route
- `app/lib/stores/mcp.ts` - MCP state store
- `app/routes/api.chat.ts` - MCP integration in chat
