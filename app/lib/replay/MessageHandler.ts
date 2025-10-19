// Methods for communicating with the message handler in the Preview iframe.

import { type MessageHandlerRequest, type MessageHandlerRequestMap } from './MessageHandlerInterface';

let lastRequestId = 0;

function sendIframeRequest<K extends keyof MessageHandlerRequestMap>(
  iframe: HTMLIFrameElement,
  request: Extract<MessageHandlerRequest, { request: K }>,
) {
  if (!iframe.contentWindow) {
    return undefined;
  }

  const target = iframe.contentWindow;
  const requestId = ++lastRequestId;
  target.postMessage({ id: requestId, request, source: '@@replay-nut' }, '*');

  return new Promise<MessageHandlerRequestMap[K]['response']>((resolve) => {
    const handler = (event: MessageEvent) => {
      if (event.data?.source !== '@@replay-nut' || event.source !== target || event.data?.id !== requestId) {
        return;
      }

      window.removeEventListener('message', handler);
      resolve(event.data.response);
    };
    window.addEventListener('message', handler);
  });
}

// User simulation data generated for analysis by the backend.
export type SimulationData = unknown;

export async function getIFrameSimulationData(iframe: HTMLIFrameElement): Promise<SimulationData> {
  const buffer = await sendIframeRequest(iframe, { request: 'recording-data' });

  if (!buffer) {
    return undefined;
  }

  const decoder = new TextDecoder();
  const jsonString = decoder.decode(new Uint8Array(buffer));

  return JSON.parse(jsonString) as SimulationData;
}
