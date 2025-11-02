import { Worker } from 'bullmq';
import { streamText } from '../llm/stream-text-logic';
import { agentQueue } from './queue';
import { process } from 'node:process';
import { createClient } from 'redis';

const worker = new Worker(
  'agent-queue',
  async (job) => {
    const publisher = createClient({
      socket: {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: Number(process.env.REDIS_PORT) || 6379,
      },
    });
    await publisher.connect();

    try {
      console.log('Processing job:', job.data);
      const result = await streamText(job.data);

      for await (const chunk of result.fullStream) {
        publisher.publish(job.id, JSON.stringify(chunk));
      }
    } catch (error) {
      console.error('Job failed:', error);
      publisher.publish(job.id, JSON.stringify({ type: 'error', error: error.message }));
    } finally {
      publisher.quit();
    }
  },
  {
    connection: {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: Number(process.env.REDIS_PORT) || 6379,
    },
  },
);

agentQueue.on('drained', () => {
  worker.close();
});

export const closeWorker = async () => {
  await worker.close();
};

console.log('Agent worker started');
