import { getCurrentUserId, getCurrentAccessToken } from '~/lib/supabase/client';
import type { VisitData } from '~/lib/replay/SendChatMessage';

type ResponseCallback = (response: any) => void;

// Call the Nut API with the specified method and params.
//
// If a response callback is provided, responses are expected to be newline-delimited JSON
// and the callback will be called with each entry.
//
// Otherwise, the response is returned as a JSON object.

export class NutAPIError extends Error {
  method: string;
  status: number;
  responseText: string;

  constructor(method: string, status: number, responseText: string) {
    super(`NutAPI error: ${method} ${status} - ${responseText}`);
    this.method = method;
    this.status = status;
    this.responseText = responseText;
  }
}

function getMethodURL(method: string) {
  const apiHost = import.meta.env.VITE_REPLAY_API_HOST || 'https://agent.preprod.replay.io';
  return `${apiHost}/nut/${method}`;
}

export async function callNutAPI(
  method: string,
  request: any,
  responseCallback?: ResponseCallback,
  overrideUserId?: string,
): Promise<any> {
  const userId = overrideUserId ?? getCurrentUserId();
  const accessToken = await getCurrentAccessToken();

  const url = getMethodURL(method);

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'x-user-id': userId ?? '',
    Authorization: accessToken ? `Bearer ${accessToken}` : '',
  };

  const fetchOptions: RequestInit = {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  };

  if (responseCallback) {
    // Use native fetch for streaming
    const response = await fetch(url, fetchOptions);
    if (!response.body) {
      throw new Error('No response body for streaming');
    }
    if (!response.ok) {
      const errorText = await response.text();
      throw new NutAPIError(method, response.status, errorText);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      let newlineIdx;
      while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newlineIdx).trim();
        buffer = buffer.slice(newlineIdx + 1);
        if (line) {
          responseCallback(JSON.parse(line));
        }
      }
    }
    // Handle any trailing data after the last newline
    if (buffer.trim()) {
      responseCallback(JSON.parse(buffer.trim()));
    }
    return undefined;
  } else {
    // Use native fetch for non-streaming
    const response = await fetch(url, fetchOptions);
    if (!response.ok) {
      const errorText = await response.text();
      throw new NutAPIError(method, response.status, errorText);
    }
    return response.json();
  }
}

async function callAPIStreamBuffer(method: string, buffer: ArrayBuffer, extraHeaders?: Record<string, string>) {
  const url = getMethodURL(method);

  const userId = getCurrentUserId();
  const accessToken = await getCurrentAccessToken();

  const headers: HeadersInit = {
    'x-user-id': userId ?? '',
    Authorization: accessToken ? `Bearer ${accessToken}` : '',
    'Content-Type': 'application/octet-stream',
    'Content-Length': buffer.byteLength.toString(),
    ...extraHeaders,
  };

  // Create a ReadableStream for streaming the attachment data
  const stream = new ReadableStream({
    start(controller) {
      // Send the data in chunks to avoid memory issues with large files
      const chunkSize = 64 * 1024; // 64KB chunks
      let offset = 0;

      const sendChunk = () => {
        if (offset >= buffer.byteLength) {
          controller.close();
          return;
        }

        const chunk = buffer.slice(offset, offset + chunkSize);
        controller.enqueue(new Uint8Array(chunk));
        offset += chunkSize;

        // Use setTimeout to yield control and prevent blocking the main thread
        setTimeout(sendChunk, 0);
      };

      sendChunk();
    },
  });

  const fetchOptions: RequestInit = {
    method: 'POST',
    headers,
    body: stream,
    duplex: 'half',
  };

  const response = await fetch(url, fetchOptions);
  if (!response.ok) {
    const errorText = await response.text();
    throw new NutAPIError(`${method} failed`, response.status, errorText);
  }

  return response.json();
}

export async function createAttachment(mimeType: string, attachmentData: ArrayBuffer): Promise<string> {
  const json = await callAPIStreamBuffer('create-attachment', attachmentData, {
    'x-replay-attachment-type': mimeType,
  });
  return json.attachmentId;
}

export async function downloadAttachment(attachmentId: string): Promise<ArrayBuffer> {
  const apiHost = import.meta.env.VITE_REPLAY_API_HOST || 'https://dispatch.replay.io';
  const url = `${apiHost}/nut/download-attachment`;

  const userId = getCurrentUserId();
  const accessToken = await getCurrentAccessToken();

  const headers: HeadersInit = {
    'x-user-id': userId ?? '',
    Authorization: accessToken ? `Bearer ${accessToken}` : '',
    'Content-Type': 'application/json',
  };

  const fetchOptions: RequestInit = {
    method: 'POST',
    headers,
    body: JSON.stringify({ attachmentId }),
  };

  const response = await fetch(url, fetchOptions);
  if (!response.ok) {
    const errorText = await response.text();
    throw new NutAPIError('downloadAttachment', response.status, errorText);
  }

  if (!response.body) {
    throw new Error('No response body for streaming');
  }

  // Stream the response data
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  // Calculate total length and combine chunks
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result.buffer;
}

async function compressJSON(obj: any): Promise<ArrayBuffer> {
  // Convert JSON to string, then to Uint8Array
  const jsonString = JSON.stringify(obj);
  const blob = new Blob([jsonString]);

  // Compress using gzip
  const compressedStream = blob.stream().pipeThrough(new CompressionStream('gzip'));

  // Get the compressed data as a buffer
  const compressedBlob = await new Response(compressedStream).blob();
  const buffer = await compressedBlob.arrayBuffer();

  return buffer;
}

export async function uploadVisitData(visitData: VisitData): Promise<string | undefined> {
  const buffer = await compressJSON(visitData);
  try {
    const json = await callAPIStreamBuffer('create-visit-data', buffer);
    return json.visitDataId;
  } catch (e) {
    console.error('uploadVisitData failed', e);
    return undefined;
  }
}
