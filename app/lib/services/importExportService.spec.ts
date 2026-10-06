import { describe, expect, it } from 'vitest';
import { ImportExportService } from './importExportService';

/**
 * Minimal IDBDatabase stub. getAllChats only touches db.name, db.version,
 * db.transaction(['chats'], 'readonly') -> objectStore('chats').getAll().
 */
function stubDb(rows: unknown[]): IDBDatabase {
  const request: Record<string, unknown> = {};

  const store = {
    getAll: () => {
      queueMicrotask(() => {
        request.result = rows;
        (request.onsuccess as (() => void) | undefined)?.();
      });
      return request;
    },
  };

  const transaction = { objectStore: () => store };

  return {
    name: 'stub',
    version: 2,
    transaction: () => transaction,
  } as unknown as IDBDatabase;
}

describe('ImportExportService.exportAllChats', () => {
  it('preserves parts, annotations and attachments on every message', async () => {
    const messages = [
      {
        id: 'm1',
        role: 'user',
        content: 'hello',
        annotations: [{ type: 'chatSummary', summary: 's' }],
        experimental_attachments: [{ name: 'a.png', contentType: 'image/png', url: 'data:image/png;base64,AAA' }],
      },
      {
        id: 'm2',
        role: 'assistant',
        content: '',
        parts: [
          { type: 'text', text: 'hi' },
          {
            type: 'tool-invocation',
            toolInvocation: { toolCallId: 'tc1', toolName: 'bash', args: { cmd: 'ls' }, state: 'result', result: 'ok' },
          },
        ],
        reasoning: 'thought',
      },
    ];

    const exported = await ImportExportService.exportAllChats(stubDb([{ id: 'c1', messages }]));

    expect(exported.chats).toHaveLength(1);
    expect(exported.chats[0].messages).toEqual(messages);
  });

  it('keeps unknown/future message fields instead of dropping them', async () => {
    const messages = [{ id: 'm1', role: 'user', content: 'x', someFutureField: { keep: true } }];

    const exported = await ImportExportService.exportAllChats(stubDb([{ id: 'c1', messages }]));

    expect(exported.chats[0].messages[0]).toHaveProperty('someFutureField', { keep: true });
  });

  it('does not alias the stored message objects', async () => {
    const messages = [{ id: 'm1', role: 'user', content: 'x' }];

    const exported = await ImportExportService.exportAllChats(stubDb([{ id: 'c1', messages }]));

    expect(exported.chats[0].messages[0]).not.toBe(messages[0]);
  });

  it('still fills in chat-level defaults', async () => {
    const exported = await ImportExportService.exportAllChats(
      stubDb([{ id: 'c1', messages: [{ id: 'm1', role: 'user', content: 'x' }] }]),
    );

    expect(exported.chats[0].description).toBe('');
    expect(exported.chats[0].urlId).toBeNull();
    expect(exported.chats[0].metadata).toBeNull();
    expect(exported.exportDate).toBeTruthy();
  });

  it('rejects when the database is missing', async () => {
    await expect(ImportExportService.exportAllChats(undefined as unknown as IDBDatabase)).rejects.toThrow(
      'Database not initialized',
    );
  });
});
