import { type Message } from 'ai';
import { type FileMap } from './constants';
import type { IProviderSetting } from '~/types/model';
import { agentQueue } from '../agent/queue';
import { type StreamingOptions } from './stream-text-logic';

export async function streamText(props: {
  messages: Omit<Message, 'id'>[];
  env?: Env;
  options?: StreamingOptions;
  apiKeys?: Record<string, string>;
  files?: FileMap;
  providerSettings?: Record<string, IProviderSetting>;
  promptId?: string;
  contextOptimization?: boolean;
  contextFiles?: FileMap;
  summary?: string;
  messageSliceId?: number;
}) {
  const job = await agentQueue.add('stream-text', props);

  return job.id;
}
