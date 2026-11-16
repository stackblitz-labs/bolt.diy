import { isbot } from 'isbot';
import { renderToReadableStream } from 'react-dom/server';
import { ServerRouter, type EntryContext, type RouterContextProvider } from 'react-router';
import { createSecurityHeaders } from './lib/security';
import { cspNonceContext } from './lib/security/nonce';

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  loadContext: Readonly<RouterContextProvider>,
) {
  const nonce = loadContext.get(cspNonceContext);

  const body = await renderToReadableStream(<ServerRouter context={routerContext} url={request.url} nonce={nonce} />, {
    signal: request.signal,
    onError(error: unknown) {
      console.error(error);
      responseStatusCode = 500;
    },
  });

  if (isbot(request.headers.get('user-agent') || '') || routerContext.isSpaMode) {
    await body.allReady;
  }

  responseHeaders.set('Content-Type', 'text/html');

  /*
   * WebContainer requires a cross-origin-isolated document.
   * `credentialless` is used because the preview iframe and the
   * COEP header would otherwise block every third-party subresource.
   */
  responseHeaders.set('Cross-Origin-Embedder-Policy', 'credentialless');
  responseHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');
  Object.entries(createSecurityHeaders(nonce)).forEach(([name, value]) => responseHeaders.set(name, value));

  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}
