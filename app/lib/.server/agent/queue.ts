import { Queue } from 'bullmq';
import { process } from 'node:process';

export const agentQueue = new Queue('agent-queue', {
  connection: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT) || 6379,
  },
});

export const closeAgentQueue = async () => {
  await agentQueue.close();
};
