import type { ActionFunctionArgs } from 'react-router';
import { z } from 'zod';
import { createWebContext, searchWeb, WebContextError } from '~/lib/.server/web-context';
import { withSecurity } from '~/lib/security';

const webSearchRequestSchema = z.object({
  action: z.enum(['search', 'prepare']).optional(),
  mode: z.enum(['search', 'url']),
  query: z.string().trim().max(500).default(''),
  url: z.string().trim().max(2048).optional(),
  selectedResults: z
    .array(z.object({ title: z.string().max(500), url: z.string().max(2048), snippet: z.string().max(2000) }))
    .max(3)
    .optional(),
  includePageContent: z.boolean().optional(),
  model: z.string().trim().max(200).optional(),
  provider: z.string().trim().max(80).optional(),
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

  const { action: requestAction, mode, query, url, model, provider, selectedResults, includePageContent } = parsed.data;

  if (requestAction === 'search') {
    if (query.length < 2) {
      return Response.json({ error: 'Enter a search query.' }, { status: 400 });
    }

    try {
      const results = await searchWeb({
        request,
        cloudflareEnv: context.cloudflare?.env as unknown as Record<string, unknown> | undefined,
        query,
      });

      return Response.json({ success: true, type: 'search', data: results });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Web search failed.';
      const status = error instanceof WebContextError ? error.status : error instanceof DOMException ? 504 : 502;

      return Response.json({ error: message }, { status });
    }
  }

  if (!model || !provider) {
    return Response.json({ error: 'Choose a model before preparing web context.' }, { status: 400 });
  }

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
      selectedResults,
      includePageContent,
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
