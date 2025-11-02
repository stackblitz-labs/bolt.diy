import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { streamText } from '~/lib/.server/llm/stream-text';

export async function action({ request }: ActionFunctionArgs) {
  const { messages, files, promptId, contextOptimization } = await request.json();

  const jobId = await streamText({
    messages,
    files,
    promptId,
    contextOptimization,
    // TODO: Get these from the request
    apiKeys: {},
    providerSettings: {},
    env: {} as any,
  });

  return new Response(JSON.stringify({ jobId }), {
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
