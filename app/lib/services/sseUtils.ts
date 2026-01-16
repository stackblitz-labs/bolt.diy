import type { GenerationPhase, GenerationProgress, GenerationStatus } from '~/types/generation';

export type SSEWriter = WritableStreamDefaultWriter<Uint8Array>;

export function createSSEStream() {
  const encoder = new TextEncoder();
  const stream = new TransformStream<Uint8Array, Uint8Array>();
  const writer = stream.writable.getWriter();

  async function send<T>(event: string, data: T) {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    await writer.write(encoder.encode(message));
  }

  async function close() {
    await writer.close();
  }

  return { readable: stream.readable, writer, send, close };
}

export async function sendSSEEvent<T>(writer: SSEWriter, event: string, data: T) {
  const encoder = new TextEncoder();
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  await writer.write(encoder.encode(message));
}

export async function sendProgress(
  writer: SSEWriter,
  phase: GenerationPhase,
  status: GenerationStatus,
  message: string,
  percentage: number,
  extras?: Partial<Pick<GenerationProgress, 'startedAt' | 'templateName' | 'error'>>,
) {
  const progress: GenerationProgress = {
    phase,
    status,
    message,
    percentage,
    startedAt: extras?.startedAt ?? Date.now(),
    templateName: extras?.templateName,
    error: extras?.error,
  };

  await sendSSEEvent(writer, 'progress', progress);
}

export async function sendHeartbeat(writer: SSEWriter) {
  await sendSSEEvent(writer, 'heartbeat', { timestamp: Date.now() });
}
