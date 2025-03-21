/**
 * Module for converting MCP servers to AI SDK tools
 */

import { type Tool } from 'ai';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { JSONSchemaToZod } from '@dmitryrechkin/json-schema-to-zod';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('MCPToolset');

export interface ToolSetConfig {
  mcpServers: Record<
    string,
    {
      baseUrl: string;
    }
  >;
  onCallTool?: (serverName: string, toolName: string, args: any, result: Promise<string>) => void;
}

export interface ToolSet {
  tools: Record<string, Tool>;
  clients: Record<string, Client>;
}

/**
 * Convert MCP servers to AI SDK toolset
 * @param config Toolset configuration
 * @returns Toolset and MCP clients
 */
export async function createToolSet(config: ToolSetConfig): Promise<ToolSet> {
  const toolset: ToolSet = {
    tools: {},
    clients: {},
  };

  for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
    // Create SSE transport layer - direct initialization
    const url = new URL(serverConfig.baseUrl);
    const transport = new SSEClientTransport(url);

    // Create MCP client
    const client = new Client({
      name: `${serverName}-client`,
      version: '1.0.0',
    });

    toolset.clients[serverName] = client;

    try {
      // Connect client
      await client.connect(transport);

      // Get list of tools
      const toolList = await client.listTools();

      // Convert each tool to AI SDK tool
      for (const tool of toolList.tools) {
        let toolName = tool.name;

        if (toolName !== serverName) {
          toolName = `${serverName}_${toolName}`;
        }

        /*
         * Convert JSON Schema to Zod object
         * Type assert tool.inputSchema as any to resolve type errors
         */
        const zodSchema = JSONSchemaToZod.convert(tool.inputSchema as any);

        toolset.tools[toolName] = {
          description: tool.description || '',
          parameters: zodSchema, // Use converted Zod schema
          execute: async (args) => {
            const resultPromise = (async () => {
              const result = await client.callTool({
                name: tool.name,
                arguments: args,
              });

              return JSON.stringify(result);
            })();

            if (config.onCallTool) {
              config.onCallTool(serverName, toolName, args, resultPromise);
            }

            return resultPromise;
          },
        };
      }
    } catch (error) {
      logger.error(`Failed to connect to MCP server ${serverName}:`, error);
    }
  }

  return toolset;
}
