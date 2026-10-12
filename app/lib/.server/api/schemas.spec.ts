import type { UIMessage } from 'ai';
import { describe, expect, it } from 'vitest';
import { ValidationError } from './errors';
import {
  REQUEST_LIMITS,
  asMessages,
  chatRequestSchema,
  enhancerRequestSchema,
  isLegacyMessage,
  llmCallRequestSchema,
  parseBody,
} from './schemas';

function userMessage(text = 'build me an app'): UIMessage {
  return { id: 'm1', role: 'user', parts: [{ type: 'text', text }] };
}

describe('chatRequestSchema', () => {
  it('accepts the body Chat.client.tsx actually sends', () => {
    /*
     * Mirrors the `bodyRef` literal in Chat.client.tsx. If the client's shape
     * changes and this does not, the route starts rejecting real requests — so
     * this is the contract test that matters most.
     */
    const result = chatRequestSchema.safeParse({
      messages: [userMessage()],
      files: {
        '/src/index.ts': { type: 'file', content: 'export const a = 1;', isBinary: false },
        '/src': { type: 'folder' },
      },
      promptId: 'default',
      contextOptimization: true,
      chatMode: 'build',
      designScheme: {
        palette: { primary: '#9E7FFF' },
        features: ['rounded'],
        font: ['sans-serif'],
      },
      supabase: {
        isConnected: true,
        hasSelectedProject: true,
        credentials: { anonKey: 'anon', supabaseUrl: 'https://example.supabase.co' },
      },
      maxLLMSteps: 5,
    });

    expect(result.success).toBe(true);
  });

  it('accepts a minimal body', () => {
    expect(chatRequestSchema.safeParse({ messages: [userMessage()] }).success).toBe(true);
  });

  describe('rejections', () => {
    it('requires at least one message', () => {
      const result = chatRequestSchema.safeParse({ messages: [] });
      expect(result.success).toBe(false);
    });

    it('rejects a non-array messages field', () => {
      /*
       * Previously `messages: "hello"` passed `request.json<T>()` (a compile-time
       * assertion) and then `.reduce()` threw a TypeError — a 500 for what is
       * plainly a malformed request.
       */
      const result = chatRequestSchema.safeParse({ messages: 'hello' });
      expect(result.success).toBe(false);
    });

    it('rejects an unknown chatMode', () => {
      expect(chatRequestSchema.safeParse({ messages: [userMessage()], chatMode: 'agent' }).success).toBe(false);
    });

    it('rejects a negative or fractional maxLLMSteps', () => {
      for (const steps of [0, -1, 1.5, Number.NaN]) {
        expect(chatRequestSchema.safeParse({ messages: [userMessage()], maxLLMSteps: steps }).success).toBe(false);
      }
    });

    it('caps maxLLMSteps, the provider call multiplier', () => {
      /*
       * `stopWhen: isStepCount(maxLLMSteps)` allows that many full model
       * round-trips per HTTP request, so this is the field that decides how much
       * a single request can cost.
       */
      expect(chatRequestSchema.safeParse({ messages: [userMessage()], maxLLMSteps: 1_000_000 }).success).toBe(false);
      expect(
        chatRequestSchema.safeParse({ messages: [userMessage()], maxLLMSteps: REQUEST_LIMITS.MAX_LLM_STEPS }).success,
      ).toBe(true);
    });

    it('rejects a file entry with no content', () => {
      const result = chatRequestSchema.safeParse({
        messages: [userMessage()],
        files: { '/src/index.ts': { type: 'file', isBinary: false } },
      });

      expect(result.success).toBe(false);
    });

    it('rejects a file part with no url', () => {
      const result = chatRequestSchema.safeParse({
        messages: [{ id: 'm1', role: 'user', parts: [{ type: 'file', mediaType: 'image/png' }] }],
      });

      expect(result.success).toBe(false);
    });

    it('caps file attachments per message', () => {
      const attachment = { type: 'file', mediaType: 'image/png', url: 'https://example.com/image.png' };

      expect(
        chatRequestSchema.safeParse({
          messages: [
            {
              id: 'm1',
              role: 'user',
              parts: Array.from({ length: REQUEST_LIMITS.MAX_ATTACHMENTS_PER_MESSAGE }, () => attachment),
            },
          ],
        }).success,
      ).toBe(true);
      expect(
        chatRequestSchema.safeParse({
          messages: [
            {
              id: 'legacy-at-limit',
              role: 'user',
              content: 'look at these',
              experimental_attachments: Array.from({ length: REQUEST_LIMITS.MAX_ATTACHMENTS_PER_MESSAGE }, () => ({})),
            },
          ],
        }).success,
      ).toBe(true);
      expect(
        chatRequestSchema.safeParse({
          messages: [
            {
              id: 'm1',
              role: 'user',
              parts: Array.from({ length: REQUEST_LIMITS.MAX_ATTACHMENTS_PER_MESSAGE + 1 }, () => attachment),
            },
          ],
        }).success,
      ).toBe(false);

      expect(
        chatRequestSchema.safeParse({
          messages: [
            {
              id: 'legacy',
              role: 'user',
              content: 'look at these',
              experimental_attachments: Array.from(
                { length: REQUEST_LIMITS.MAX_ATTACHMENTS_PER_MESSAGE + 1 },
                () => ({}),
              ),
            },
          ],
        }).success,
      ).toBe(false);
    });

    it('accepts realistic inline image data URLs within the chat body budget', () => {
      const dataUrl = `data:image/png;base64,${'a'.repeat(100 * 1024)}`;

      const result = chatRequestSchema.safeParse({
        messages: [{ id: 'm1', role: 'user', parts: [{ type: 'file', mediaType: 'image/png', url: dataUrl }] }],
      });

      expect(result.success).toBe(true);
    });

    it('keeps ordinary URLs bounded', () => {
      const result = chatRequestSchema.safeParse({
        messages: [
          {
            id: 'm1',
            role: 'user',
            parts: [{ type: 'file', mediaType: 'image/png', url: `https://${'a'.repeat(8192)}` }],
          },
        ],
      });

      expect(result.success).toBe(false);
    });

    it('rejects messages with neither current parts nor legacy content', () => {
      expect(chatRequestSchema.safeParse({ messages: [{}] }).success).toBe(false);
    });

    it('rejects messages without a supported role before model conversion', () => {
      expect(chatRequestSchema.safeParse({ messages: [{ parts: [{ type: 'text', text: 'hello' }] }] }).success).toBe(
        false,
      );
    });

    it('bounds oversized text parts', () => {
      const result = chatRequestSchema.safeParse({
        messages: [
          {
            id: 'm1',
            role: 'user',
            parts: [{ type: 'text', text: 'x'.repeat(REQUEST_LIMITS.MAX_TEXT_PART_CHARS + 1) }],
          },
        ],
      });

      expect(result.success).toBe(false);
    });

    it('bounds the message count', () => {
      const many = Array.from({ length: REQUEST_LIMITS.MAX_MESSAGES + 1 }, (_, i) => userMessage(`m${i}`));
      expect(chatRequestSchema.safeParse({ messages: many }).success).toBe(false);
    });
  });

  describe('compatibility', () => {
    it('accepts a persisted v4 message that still carries content', () => {
      /*
       * Older conversations are stored with `content` and no `parts`. Rejecting
       * that shape would make those chats unopenable, so it stays valid.
       */
      const result = chatRequestSchema.safeParse({
        messages: [{ id: 'm1', role: 'user', content: 'legacy message' }],
      });

      expect(result.success).toBe(true);
    });

    it('tolerates unknown SDK part types', () => {
      /*
       * The SDK adds part types between releases. A strict union here would
       * break conversations the moment it does, which is a far worse failure
       * than accepting a part this app does not itself render.
       */
      const result = chatRequestSchema.safeParse({
        messages: [{ id: 'm1', role: 'assistant', parts: [{ type: 'some-future-sdk-part', payload: { a: 1 } }] }],
      });

      expect(result.success).toBe(true);
    });

    it('strips apiKeys from the validated body', () => {
      /*
       * The client still sends apiKeys in its body, but the server reads keys
       * from the cookie. They are dropped at the boundary so nothing downstream
       * can pick them up — including a future `logger.debug(body)`.
       */
      const body = { messages: [userMessage()], apiKeys: { OpenAI: 'sk-should-not-be-here' } };
      const parsed = parseBody(chatRequestSchema, body, 'chat');

      expect(parsed).not.toHaveProperty('apiKeys');
      expect(JSON.stringify(parsed)).not.toContain('sk-should-not-be-here');

      /* The caller's own object is untouched. */
      expect(body.apiKeys.OpenAI).toBe('sk-should-not-be-here');
    });

    it('still accepts the request when apiKeys is present', () => {
      expect(chatRequestSchema.safeParse({ messages: [userMessage()], apiKeys: { OpenAI: 'sk-x' } }).success).toBe(
        true,
      );
    });
  });

  describe('isLegacyMessage', () => {
    it.each([
      [{ content: 'hello' }, true],
      [{ parts: [{ type: 'text', text: 'hi' }] }, false],
      [{ parts: 'not-an-array', content: 'hello' }, true],
    ])('classifies %o as legacy=%s', (message, expected) => {
      expect(isLegacyMessage(message as { parts?: unknown; content?: unknown })).toBe(expected);
    });
  });
});

describe('llmCallRequestSchema', () => {
  const valid = { message: 'hello', model: 'gpt-4o', provider: { name: 'OpenAI' } };

  it('accepts the streaming and non-streaming shapes', () => {
    expect(llmCallRequestSchema.safeParse({ ...valid, system: 'be brief', streamOutput: true }).success).toBe(true);
    expect(llmCallRequestSchema.safeParse({ ...valid, streamOutput: false }).success).toBe(true);
    expect(llmCallRequestSchema.safeParse(valid).success).toBe(true);
  });

  it('requires a message, model and provider name', () => {
    expect(llmCallRequestSchema.safeParse({ ...valid, message: undefined }).success).toBe(false);
    expect(llmCallRequestSchema.safeParse({ ...valid, model: '' }).success).toBe(false);
    expect(llmCallRequestSchema.safeParse({ ...valid, provider: {} }).success).toBe(false);
  });

  it('rejects a provider that is not an object', () => {
    /*
     * `const { name } = provider` on `provider: null` threw a TypeError that
     * surfaced as a 500; the schema makes it a 400.
     */
    expect(llmCallRequestSchema.safeParse({ ...valid, provider: null }).success).toBe(false);
    expect(llmCallRequestSchema.safeParse({ ...valid, provider: 'OpenAI' }).success).toBe(false);
  });
});

describe('enhancerRequestSchema', () => {
  it('requires a non-empty message', () => {
    expect(
      enhancerRequestSchema.safeParse({ message: 'x', model: 'gpt-4o', provider: { name: 'OpenAI' } }).success,
    ).toBe(true);

    expect(
      enhancerRequestSchema.safeParse({ message: '', model: 'gpt-4o', provider: { name: 'OpenAI' } }).success,
    ).toBe(false);
  });
});

describe('parseBody', () => {
  it('raises a 400 carrying the offending paths', () => {
    const error = (() => {
      try {
        parseBody(chatRequestSchema, { messages: [] }, 'chat');
        return null;
      } catch (e) {
        return e as ValidationError;
      }
    })();

    expect(error).toBeInstanceOf(ValidationError);
    expect(error!.status).toBe(400);
    expect(error!.isRetryable).toBe(false);
    expect(error!.message).toContain('Invalid chat request');
    expect(error!.issues.join(' ')).toContain('messages');
  });
});

describe('asMessages', () => {
  it('preserves the parts array through the round trip', () => {
    const parsed = parseBody(chatRequestSchema, { messages: [userMessage('keep me')] }, 'chat');
    const messages = asMessages(parsed.messages);

    expect(messages[0].parts).toEqual([{ type: 'text', text: 'keep me' }]);
  });
});
