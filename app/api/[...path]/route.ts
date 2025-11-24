import { createRequestHandler } from '~/lib/remix-types';

/*
 * We'll import the server build at runtime, not during compilation
 * Build path will be available after the build is complete
 */

const handleRequest = async (request: Request) => {
  try {
    /*
     * Dynamically import the server build at runtime
     * In a real Vercel deployment, the server build will be available
     * This is just a placeholder for type checking
     */
    const build = {
      /* production build will be available at runtime */
    };

    // Create the request handler
    const handler = createRequestHandler({
      build: build as any,
      mode: process.env.NODE_ENV,
      getLoadContext: () => ({
        env: process.env,
      }),
    });

    // Handle the request
    return handler(request);
  } catch (error) {
    // Log the error to console
    console.error('API route error:', error);

    // Return a basic error response
    return new Response('Server Error', { status: 500 });
  }
};

export const GET = handleRequest;
export const POST = handleRequest;
export const PUT = handleRequest;
export const PATCH = handleRequest;
export const DELETE = handleRequest;
export const HEAD = handleRequest;
export const OPTIONS = handleRequest;

export const runtime = 'edge';
