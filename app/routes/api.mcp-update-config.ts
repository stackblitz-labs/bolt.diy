import type { ActionFunctionArgs } from 'react-router';
import { toApiErrorResponse } from '~/lib/.server/api/errors';
import { readJsonBody } from '~/lib/.server/api/read-body';
import { requireMCPAdmin } from '~/lib/.server/mcp-admin';
import { MCPService, mcpConfigSchema } from '~/lib/services/mcpService';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('api.mcp-update-config');

export async function action({ request, context }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } });
  }

  const denied = await requireMCPAdmin(request, context);

  if (denied) {
    return denied;
  }

  if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    return Response.json({ error: 'MCP configuration must use application/json.' }, { status: 415 });
  }

  try {
    const body = await readJsonBody(request, { maxBytes: 64 * 1024 });
    const parsed = mcpConfigSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ error: 'Invalid MCP servers configuration' }, { status: 400 });
    }

    const mcpService = MCPService.getInstance();
    const serverTools = await mcpService.updateConfig(parsed.data);

    return Response.json(serverTools, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    logger.error('Error updating MCP config:', error);
    return toApiErrorResponse(error);
  }
}
