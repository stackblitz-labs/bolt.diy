import type { ActionFunctionArgs } from 'react-router';
import { z } from 'zod';
import { createWebContext, WebContextError } from '~/lib/.server/web-context';
import { withSecurity } from '~/lib/security';

const webSearchRequestSchema = z.object({
  mode: z.enum(['search', 'url']),
  query: z.string().trim().max(500).default(''),
  url: z.string().trim().max(2048).optional(),
  model: z.string().trim().min(1).max(200),
  provider: z.string().trim().min(1).max(80),
});

export const action = withSecurity(webSearchAction, {
  allowedMethods: ['POST'],
});

async function webSearchAction({ context, request }: ActionFunctionArgs) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const parsed = webSearchRequestSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message || 'Invalid web context request.' }, { status: 400 });
  }

  const { mode, query, url, model, provider } = parsed.data;

  if (mode === 'url' && !url) {
    return Response.json({ error: 'Enter a URL to fetch.' }, { status: 400 });
  }

  if (mode === 'search' && query.length < 2) {
    return Response.json({ error: 'Enter a search query.' }, { status: 400 });
  }

  try {
    const result = await createWebContext({
      request,
      cloudflareEnv: context.cloudflare?.env as unknown as Record<string, unknown> | undefined,
      mode,
      query,
      url,
      model,
      providerName: provider,
    });

    return Response.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create web context.';

    const status =
      error instanceof WebContextError
        ? error.status
        : error instanceof DOMException && error.name === 'TimeoutError'
          ? 504
          : 502;

    return Response.json({ error: message }, { status });
  }
}
