import { type LoaderFunction } from '@remix-run/cloudflare';
import { createClient } from 'redis';
import { process } from 'node:process';

export const loader: LoaderFunction = ({ request }) => {
  const url = new URL(request.url);
  const jobId = url.searchParams.get('jobId');

  if (!jobId) {
    return new Response('Missing jobId', { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const subscriber = createClient({
        socket: {
          host: process.env.REDIS_HOST || '127.0.0.1',
          port: Number(process.env.REDIS_PORT) || 6379,
        },
      });

      await subscriber.connect();

      subscriber.subscribe(jobId, (message) => {
        controller.enqueue(`data: ${message}\\n\\n`);
      });

      request.signal.addEventListener('abort', () => {
        subscriber.unsubscribe(jobId);
        subscriber.quit();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
};
