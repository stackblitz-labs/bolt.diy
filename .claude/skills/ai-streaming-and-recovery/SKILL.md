---
name: ai-streaming-and-recovery
description: Use when working with AI streaming, LLM responses, or stream recovery. Covers SwitchableStream for multi-segment responses, StreamRecoveryManager for timeout handling, SSE patterns, token estimation, context window management, and Vercel AI SDK streaming. Triggers include "streaming", "SwitchableStream", "StreamRecoveryManager", "SSE", "server-sent events", "token limit", "context window", "stream timeout", "continue prompt", "max tokens", "streamText", "createDataStream", "LLM response".
---

# AI Streaming & Recovery Skill

## Goal

Handle LLM streaming responses with proper recovery, continuation, and token management following codebase patterns.

## Core Streaming Components

| Component | Path | Purpose |
|-----------|------|---------|
| `SwitchableStream` | `app/lib/.server/llm/switchable-stream.ts` | Switch between response segments |
| `StreamRecoveryManager` | `app/lib/.server/llm/stream-recovery.ts` | Handle timeouts and recovery |
| `stream-text.ts` | `app/lib/.server/llm/stream-text.ts` | Main LLM streaming function |
| `api.chat.ts` | `app/routes/api.chat.ts` | Chat API route with SSE |

## SwitchableStream

Allows switching to a new stream source when max tokens are reached:

```typescript
// app/lib/.server/llm/switchable-stream.ts
export default class SwitchableStream extends TransformStream {
  private _controller: TransformStreamDefaultController | null = null;
  private _currentReader: ReadableStreamDefaultReader | null = null;
  private _switches = 0;

  constructor() {
    let controllerRef: TransformStreamDefaultController | undefined;
    
    super({
      start(controller) {
        controllerRef = controller;
      },
    });
    
    this._controller = controllerRef!;
  }

  async switchSource(newStream: ReadableStream) {
    // Cancel previous reader
    if (this._currentReader) {
      await this._currentReader.cancel();
    }

    this._currentReader = newStream.getReader();
    this._pumpStream();
    this._switches++;
  }

  private async _pumpStream() {
    try {
      while (true) {
        const { done, value } = await this._currentReader!.read();
        if (done) break;
        this._controller!.enqueue(value);
      }
    } catch (error) {
      this._controller!.error(error);
    }
  }

  close() {
    this._currentReader?.cancel();
    this._controller?.terminate();
  }

  get switches() {
    return this._switches;
  }
}
```

### Usage in api.chat.ts

```typescript
const stream = new SwitchableStream();

const options: StreamingOptions = {
  onFinish: async ({ text: content, finishReason, usage }) => {
    cumulativeUsage.completionTokens += usage?.completionTokens || 0;
    cumulativeUsage.promptTokens += usage?.promptTokens || 0;

    // Check if we hit token limit and need to continue
    if (finishReason === 'length' && stream.switches < MAX_RESPONSE_SEGMENTS) {
      const switchesLeft = MAX_RESPONSE_SEGMENTS - stream.switches;
      logger.info(`Continuing message (${switchesLeft} switches left)`);

      // Add assistant response and continue prompt
      messages.push({ role: 'assistant', content });
      messages.push({ role: 'user', content: CONTINUE_PROMPT });

      // Stream new response
      const result = await streamText({ messages, ...otherOptions });
      result.mergeIntoDataStream(dataStream);
    }
  },
};
```

## StreamRecoveryManager

Monitors stream activity and handles timeouts:

```typescript
// app/lib/.server/llm/stream-recovery.ts
export interface StreamRecoveryOptions {
  maxRetries?: number;
  timeout?: number;         // Default: 30000ms
  onTimeout?: () => void;
  onRecovery?: () => void;
}

export class StreamRecoveryManager {
  private _retryCount = 0;
  private _timeoutHandle: NodeJS.Timeout | null = null;
  private _lastActivity: number = Date.now();
  private _isActive = true;

  constructor(private _options: StreamRecoveryOptions = {}) {
    this._options = {
      maxRetries: 3,
      timeout: 30000,
      ..._options,
    };
  }

  startMonitoring() {
    this._resetTimeout();
  }

  updateActivity() {
    this._lastActivity = Date.now();
    this._resetTimeout();
  }

  private _resetTimeout() {
    if (this._timeoutHandle) {
      clearTimeout(this._timeoutHandle);
    }

    if (!this._isActive) return;

    this._timeoutHandle = setTimeout(() => {
      if (this._isActive) {
        this._handleTimeout();
      }
    }, this._options.timeout);
  }

  private _handleTimeout() {
    if (this._retryCount >= this._options.maxRetries!) {
      logger.error('Max retries reached');
      this.stop();
      return;
    }

    this._retryCount++;
    logger.info(`Recovery attempt ${this._retryCount}`);

    this._options.onTimeout?.();
    this._resetTimeout();
    this._options.onRecovery?.();
  }

  stop() {
    this._isActive = false;
    if (this._timeoutHandle) {
      clearTimeout(this._timeoutHandle);
    }
  }

  getStatus() {
    return {
      isActive: this._isActive,
      retryCount: this._retryCount,
      lastActivity: this._lastActivity,
      timeSinceLastActivity: Date.now() - this._lastActivity,
    };
  }
}
```

### Usage in api.chat.ts

```typescript
const streamRecovery = new StreamRecoveryManager({
  timeout: 45000,
  maxRetries: 2,
  onTimeout: () => {
    logger.warn('Stream timeout - attempting recovery');
  },
});

// In streaming loop
for await (const part of result.fullStream) {
  streamRecovery.updateActivity();  // Reset timeout on each chunk

  if (part.type === 'error') {
    streamRecovery.stop();
    logger.error('Streaming error:', part.error);
    return;
  }
}

streamRecovery.stop();  // Cleanup when done
```

## Token Estimation & Guard

Prevent context window overflow:

```typescript
const TOKEN_LIMIT_WARNING_THRESHOLD = 150000;
const TOKEN_LIMIT_MAX = 190000;

// Rough estimate: ~4 chars per token
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function estimateMessagesTokens(messages: Messages): number {
  return messages.reduce((total, msg) => {
    const content = typeof msg.content === 'string' 
      ? msg.content 
      : JSON.stringify(msg.content);
    return total + estimateTokens(content);
  }, 0);
}

function truncateMessagesIfNeeded(
  messages: Messages,
  maxTokens: number = TOKEN_LIMIT_MAX,
): { messages: Messages; truncated: boolean; originalTokens: number; finalTokens: number } {
  const originalTokens = estimateMessagesTokens(messages);

  if (originalTokens <= maxTokens) {
    return { messages, truncated: false, originalTokens, finalTokens: originalTokens };
  }

  logger.warn(`Messages exceed limit: ${originalTokens} > ${maxTokens}. Truncating...`);

  // Strategy: Keep first message (system) and last N messages
  const truncatedMessages: Messages = [];
  const lastMessages = messages.slice(-3);  // Always keep last 3
  const lastMessagesTokens = estimateMessagesTokens(lastMessages);

  if (lastMessagesTokens > maxTokens) {
    // Emergency: return just the last message
    return {
      messages: [messages[messages.length - 1]],
      truncated: true,
      originalTokens,
      finalTokens: estimateMessagesTokens([messages[messages.length - 1]]),
    };
  }

  const remainingBudget = maxTokens - lastMessagesTokens;
  let currentTokens = 0;

  // Add messages from beginning until budget exhausted
  for (let i = 0; i < messages.length - 3; i++) {
    const msg = messages[i];
    const msgTokens = estimateTokens(
      typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
    );

    if (currentTokens + msgTokens <= remainingBudget) {
      truncatedMessages.push(msg);
      currentTokens += msgTokens;
    } else {
      truncatedMessages.push({
        id: 'truncation-notice',
        role: 'system',
        content: `[Previous ${messages.length - 3 - i} messages truncated]`,
      });
      break;
    }
  }

  truncatedMessages.push(...lastMessages);
  return {
    messages: truncatedMessages,
    truncated: true,
    originalTokens,
    finalTokens: estimateMessagesTokens(truncatedMessages),
  };
}
```

## SSE Response Pattern

```typescript
import { createDataStream } from 'ai';

export async function action({ request, context }: ActionFunctionArgs) {
  const encoder = new TextEncoder();

  const dataStream = createDataStream({
    execute: async (dataStream) => {
      // Write progress annotations
      dataStream.writeData({
        type: 'progress',
        label: 'response',
        status: 'in-progress',
        message: 'Generating Response',
      });

      // Apply token guard
      const guardResult = truncateMessagesIfNeeded(messages);
      if (guardResult.truncated) {
        dataStream.writeData({
          type: 'progress',
          label: 'token-optimization',
          status: 'complete',
          message: `Context optimized (${Math.round(guardResult.originalTokens / 1000)}K → ${Math.round(guardResult.finalTokens / 1000)}K tokens)`,
        });
      }

      // Stream LLM response
      const result = await streamText({
        messages: guardResult.messages,
        options,
        // ...other params
      });

      result.mergeIntoDataStream(dataStream);
    },
    onError: (error) => {
      // Provide user-friendly error messages
      if (error.message?.includes('token')) {
        return 'Token limit exceeded. Try a model with larger context.';
      }
      if (error.message?.includes('API key')) {
        return 'Invalid or missing API key.';
      }
      if (error.message?.includes('rate limit')) {
        return 'Rate limit exceeded. Please wait.';
      }
      return `Error: ${error.message}`;
    },
  }).pipeThrough(
    new TransformStream({
      transform: (chunk, controller) => {
        // Transform thought blocks
        if (typeof chunk === 'string' && chunk.startsWith('g')) {
          // Handle reasoning/thought content
        }
        controller.enqueue(encoder.encode(chunk));
      },
    }),
  );

  return new Response(dataStream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Connection': 'keep-alive',
      'Cache-Control': 'no-cache',
    },
  });
}
```

## SSE Heartbeats (Cloudflare Timeout)

For operations exceeding 30s, send heartbeats:

```typescript
const stream = new ReadableStream({
  async start(controller) {
    const encoder = new TextEncoder();
    
    // Send heartbeat every 5 seconds
    const heartbeat = setInterval(() => {
      controller.enqueue(encoder.encode(': heartbeat\n\n'));
    }, 5000);

    try {
      for await (const chunk of generateContent()) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
    } finally {
      clearInterval(heartbeat);
      controller.close();
    }
  },
});

return new Response(stream, {
  headers: {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  },
});
```

## Constants

```typescript
// app/lib/.server/llm/constants.ts
export const MAX_TOKENS = 8000;           // Max tokens per response segment
export const MAX_RESPONSE_SEGMENTS = 5;   // Max continuation switches
```

## Error Handling Patterns

```typescript
// Enhanced error messages for common issues
if (error.message?.includes('Invalid JSON response')) {
  return 'Invalid model name or API response. Check model configuration.';
}

if (error.message?.includes('prompt is too long')) {
  return 'Context too long. Messages have been truncated.';
}

if (error.message?.includes('network') || error.message?.includes('timeout')) {
  return 'Network error. Check connection and try again.';
}
```

## Checklist

- [ ] Use `SwitchableStream` for multi-segment responses
- [ ] Initialize `StreamRecoveryManager` with appropriate timeout
- [ ] Call `streamRecovery.updateActivity()` on each chunk
- [ ] Call `streamRecovery.stop()` when stream completes
- [ ] Apply `truncateMessagesIfNeeded()` before LLM calls
- [ ] Send SSE heartbeats every 5s for long operations
- [ ] Handle `finishReason === 'length'` for continuations
- [ ] Check `stream.switches < MAX_RESPONSE_SEGMENTS`
- [ ] Provide user-friendly error messages
- [ ] Log token usage with `cumulativeUsage`

## References

- `app/lib/.server/llm/switchable-stream.ts` - SwitchableStream class
- `app/lib/.server/llm/stream-recovery.ts` - StreamRecoveryManager
- `app/lib/.server/llm/stream-text.ts` - Main streaming function
- `app/routes/api.chat.ts` - Chat API with full streaming setup
- `app/lib/.server/llm/constants.ts` - Token limits and constants
