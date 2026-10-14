import type { LoaderFunctionArgs } from 'react-router';
import { requireMCPAdmin } from '~/lib/.server/mcp-admin';
import { MCPService } from '~/lib/services/mcpService';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('api.mcp-check');

export async function loader({ request, context }: LoaderFunctionArgs) {
  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET' } });
  }

  const denied = await requireMCPAdmin(request, context);

  if (denied) {
    return denied;
  }

  try {
    const mcpService = MCPService.getInstance();
    const serverTools = await mcpService.checkServersAvailabilities();

    return Response.json(serverTools, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    logger.error('Error checking MCP servers:', error);
    return Response.json({ error: 'Failed to check MCP servers' }, { status: 500 });
  }
}
