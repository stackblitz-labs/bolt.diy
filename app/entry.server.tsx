import type { AppLoadContext } from '~/lib/remix-types';
import { RemixServer } from '@remix-run/react';
import { isbot } from 'isbot';
import { renderToString } from 'react-dom/server';
import { renderHeadToString } from 'remix-island';
import { Head } from './root';
import { themeStore } from '~/lib/stores/theme';

export const handleError = (error: Error): Error => {
  // Log error to console
  console.error('Server error:', error);
  return error;
};

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: any,
  _loadContext: AppLoadContext,
) {
  // Check if the request is from a bot
  const userAgent = request.headers.get('user-agent');
  const isBot = isbot(userAgent || '');

  // Create the HTML string
  const markup = renderToString(<RemixServer context={remixContext} url={request.url} />);

  // If this is a bot request, we can wait for all data to be ready
  if (isBot) {
    /*
     * In Cloudflare, we had:
     * await readable.allReady;
     *
     * For Vercel, we could do additional processing for bots
     * such as waiting for all data fetching to complete.
     * Future enhancement: add mechanism to ensure all data is loaded
     * before rendering for bots (important for SEO)
     */
    console.log(`Bot detected: ${userAgent}`);
  }

  // @ts-ignore - Fix for incompatible EntryContext types between different remix versions
  const head = renderHeadToString({ request, remixContext, Head });

  // Build full HTML response
  const html = `<!DOCTYPE html>
<html lang="en" data-theme="${themeStore.value}">
<head>${head}</head>
<body>
  <div id="root" class="w-full h-full">${markup}</div>
</body>
</html>`;

  responseHeaders.set('Content-Type', 'text/html');

  // 🔒 SECURITY: Set comprehensive security headers
  responseHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');

  // Content Security Policy
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.lgrckt-in.com https://widget.intercom.io https://js.intercomcdn.com https://cdn.segment.com https://js.stripe.com https://va.vercel-scripts.com https://replay-analytics.netlify.app blob:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: https: blob:",
    "media-src 'self' https://static.replay.io",
    "connect-src 'self' https://*.replay.io https://auth.nut.new https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://widget.intercom.io https://api.intercom.io https://api-iam.intercom.io wss://*.intercom.io https://telemetry.replay.io https://*.github.com https://*.githubusercontent.com https://cdn.segment.com https://api.segment.io https://va.vercel-scripts.com https://vitals.vercel-insights.com https://*.lgrckt-in.com http://*.ts.net https://replay-analytics.netlify.app https://builder-reference-app-tracker.netlify.app",
    "frame-src 'self' https://js.stripe.com https://www.youtube.com https://www.youtube-nocookie.com https://intercom-sheets.com https://*.replay.io",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];

  // Only add upgrade-insecure-requests in production
  if (process.env.NODE_ENV === 'production') {
    cspDirectives.push('upgrade-insecure-requests');
  }

  responseHeaders.set('Content-Security-Policy', cspDirectives.join('; '));

  // Additional security headers
  responseHeaders.set('X-Content-Type-Options', 'nosniff');
  responseHeaders.set('X-Frame-Options', 'DENY');
  responseHeaders.set('X-XSS-Protection', '1; mode=block');
  responseHeaders.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  responseHeaders.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');

  return new Response(html, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}
