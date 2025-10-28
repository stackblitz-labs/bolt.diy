import type { ServerBuild } from '@remix-run/cloudflare';
import { createPagesFunctionHandler } from '@remix-run/cloudflare-pages';
import { getServerBuild } from './server-build';

export const onRequest: PagesFunction = async (context) => {
  const serverBuild = await getServerBuild();

  const handler = createPagesFunctionHandler({
    build: serverBuild,
  });

  return handler(context);
};
