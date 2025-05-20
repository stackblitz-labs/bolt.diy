import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { createScopedLogger } from '~/utils/logger';
import { createMCPClient } from '~/lib/services/mcp';

const logger = createScopedLogger('api.mcp-check');

export async function action({ request }: ActionFunctionArgs) {
  try {
    const body = (await request.json()) as { mcpServers?: Record<string, any> };
    const { mcpServers } = body;

    if (!mcpServers || typeof mcpServers !== 'object') {
      return Response.json({ error: 'Invalid MCP servers configuration' }, { status: 400 });
    }

    const serverStatus: Record<string, boolean> = {};
    const serverErrors: Record<string, string> = {};
    const serverTools: Record<string, any> = {};

    // Check each server in parallel
    const checkPromises = Object.entries(mcpServers).map(async ([serverName, serverConfig]) => {
      try {
        const client = await createMCPClient(serverName, serverConfig);

        if (client) {
          serverStatus[serverName] = true;

          // Get tools from the client
          try {
            const tools = await client.tools();
            serverTools[serverName] = tools;
          } catch (toolError) {
            logger.error(`Failed to get tools from server ${serverName}:`, toolError);
            serverErrors[serverName] =
              `Connected but failed to get tools: ${toolError instanceof Error ? toolError.message : String(toolError)}`;
          }

          await client.close();
        } else {
          serverStatus[serverName] = false;
          serverErrors[serverName] = 'Failed to create client';
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Failed to check MCP server ${serverName}:`, error);
        serverStatus[serverName] = false;
        serverErrors[serverName] = errorMessage;
      }
    });

    await Promise.all(checkPromises);

    return Response.json({ serverStatus, serverErrors, serverTools });
  } catch (error) {
    logger.error('Error checking MCP servers:', error);
    return Response.json({ error: 'Failed to check MCP servers' }, { status: 500 });
  }
}
