import { describe, expect, it } from 'vitest';
import { shouldPreserveChatMessagesOnRefresh } from './chatHistoryRefresh';

describe('shouldPreserveChatMessagesOnRefresh', () => {
  it('preserves live messages when the same chat is re-read after saving', () => {
    expect(
      shouldPreserveChatMessagesOnRefresh({ chatChanged: false, currentMessageCount: 3, storedMessageCount: 2 }),
    ).toBe(true);
  });

  it('resets messages when switching chats or hydrating an empty chat', () => {
    expect(
      shouldPreserveChatMessagesOnRefresh({ chatChanged: true, currentMessageCount: 3, storedMessageCount: 2 }),
    ).toBe(false);
    expect(
      shouldPreserveChatMessagesOnRefresh({ chatChanged: false, currentMessageCount: 0, storedMessageCount: 2 }),
    ).toBe(false);
  });
});
