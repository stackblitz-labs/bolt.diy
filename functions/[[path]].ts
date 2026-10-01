// import type { ServerBuild } from '@remix-run/cloudflare';
// import { createPagesFunctionHandler } from '@remix-run/cloudflare-pages';
// 
// export const onRequest: PagesFunction = async (context) => {
 //  const serverBuild = (await import('../build/server')) as unknown as ServerBuild;
// 
 //  const handler = createPagesFunctionHandler({
   //  build: serverBuild,
  // });

 //  return handler(context);
// };


import type { Handler } from "@netlify/functions";

export const handler: Handler = async (event, context) => {
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "Bolt.diy function is running",
      path: event.path,
    }),
  };
};
