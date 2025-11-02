import { closeAgentQueue } from '../app/lib/.server/agent/queue';
import { closeWorker } from '../app/lib/.server/agent/worker';

export default async () => {
  await closeWorker();
  await closeAgentQueue();
};
