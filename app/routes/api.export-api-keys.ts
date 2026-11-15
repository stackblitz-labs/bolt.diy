import type { LoaderFunction } from 'react-router';
import { getApiKeysFromCookie } from '~/lib/api/cookies';

export const loader: LoaderFunction = async ({ request }) => {
  /*
   * Export only keys supplied by this browser session. Server environment keys
   * belong to the deployment owner and must never be exposed to anonymous users.
   */
  const cookieHeader = request.headers.get('Cookie');
  const apiKeysFromCookie = getApiKeysFromCookie(cookieHeader);

  return Response.json(apiKeysFromCookie, {
    headers: { 'Cache-Control': 'no-store' },
  });
};
