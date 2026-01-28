import { map } from 'nanostores';

export type GenerationStatus = 'idle' | 'generating' | 'generated' | 'error';

export const chatStore = map({
  started: false,
  aborted: false,
  showChat: true,
  generationStatus: 'idle' as GenerationStatus,
  projectName: '' as string,
});
