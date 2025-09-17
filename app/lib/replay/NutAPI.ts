import { getCurrentUserId, getCurrentAccessToken } from '~/lib/supabase/client';

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

export async function callNutAPI(
  method: string,
  request: any,
  responseCallback?: ResponseCallback,
  overrideUserId?: string,
): Promise<any> {
  const userId = overrideUserId ?? (await getCurrentUserId());
  const accessToken = await getCurrentAccessToken();

  const apiHost = import.meta.env.VITE_REPLAY_API_HOST || 'https://dispatch.replay.io';
  const url = `${apiHost}/nut/${method}`;

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
