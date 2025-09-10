/**
 * Stream Buffer Utility for Optimized Chunk Processing
 * Author: Keoma Wright
 * Purpose: Provides efficient buffering and batching for stream processing
 */

export class StreamBuffer {
  private _buffer: string[] = [];
  private _bufferSize = 0;
  private readonly _maxBufferSize: number;
  private readonly _flushInterval: number;
  private _flushTimer: NodeJS.Timeout | null = null;
  private _onFlush: (data: string) => void;

  constructor(options: { maxBufferSize?: number; flushInterval?: number; onFlush: (data: string) => void }) {
    this._maxBufferSize = options.maxBufferSize || 4096; // 4KB default
    this._flushInterval = options.flushInterval || 50; // 50ms default
    this._onFlush = options.onFlush;
  }

  add(chunk: string): void {
    this._buffer.push(chunk);
    this._bufferSize += chunk.length;

    // Flush if buffer size exceeds threshold
    if (this._bufferSize >= this._maxBufferSize) {
      this.flush();
    } else if (!this._flushTimer) {
      // Set timer for time-based flush
      this._flushTimer = setTimeout(() => this.flush(), this._flushInterval);
    }
  }

  flush(): void {
    if (this._buffer.length === 0) {
      return;
    }

    // Join all buffered chunks
    const data = this._buffer.join('');

    // Clear buffer
    this._buffer = [];
    this._bufferSize = 0;

    // Clear timer
    if (this._flushTimer) {
      clearTimeout(this._flushTimer);
      this._flushTimer = null;
    }

    // Call flush handler
    this._onFlush(data);
  }

  destroy(): void {
    this.flush();

    if (this._flushTimer) {
      clearTimeout(this._flushTimer);
      this._flushTimer = null;
    }
  }
}

/**
 * Creates an optimized transform stream with buffering
 */
export function createBufferedTransformStream(options?: {
  maxBufferSize?: number;
  flushInterval?: number;
  transform?: (chunk: string) => string;
}): TransformStream<string, Uint8Array> {
  const encoder = new TextEncoder();
  let buffer: StreamBuffer | null = null;

  return new TransformStream<string, Uint8Array>({
    start(controller) {
      buffer = new StreamBuffer({
        maxBufferSize: options?.maxBufferSize,
        flushInterval: options?.flushInterval,
        onFlush: (data) => {
          const transformed = options?.transform ? options.transform(data) : data;
          controller.enqueue(encoder.encode(transformed));
        },
      });
    },

    transform(chunk) {
      if (buffer && typeof chunk === 'string') {
        buffer.add(chunk);
      }
    },

    flush() {
      if (buffer) {
        buffer.destroy();
        buffer = null;
      }
    },
  });
}
