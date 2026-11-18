import { describe, expect, it } from 'vitest';
import { getChatRequestFiles } from './chatRequestFiles';
import { chatRequestSchema } from '~/lib/.server/api/schemas';
import type { FileMap } from '~/lib/stores/files';

describe('chat request file context', () => {
  const files: FileMap = {
    '/home/project/public.ts': { type: 'file', content: 'public content', isBinary: false },
    '/home/project/protected': { type: 'folder', isLocked: true },
    '/home/project/protected/private.ts': {
      type: 'file',
      content: 'locked content',
      isBinary: false,
      isLocked: true,
      lockedByFolder: '/home/project/protected',
    },
  };

  it('preserves full file context for the classic path', () => {
    expect(getChatRequestFiles(files, false)).toBe(files);
  });

  it('keeps the native agent request compatible with the API and retains lock metadata', () => {
    const requestFiles = getChatRequestFiles(files, true);

    const request = chatRequestSchema.parse({
      chatMode: 'build',
      agentMode: true,
      messages: [{ id: 'prompt', role: 'user', parts: [{ type: 'text', text: 'Summarize the project' }] }],
      files: requestFiles,
    });

    expect(request.files).toEqual({
      '/home/project/protected': files['/home/project/protected'],
      '/home/project/protected/private.ts': { ...files['/home/project/protected/private.ts'], content: '' },
    });
    expect(files['/home/project/protected/private.ts']).toMatchObject({ content: 'locked content' });
  });
});
