import type { LoaderFunctionArgs } from 'react-router';

export const loader = async ({ request: _request }: LoaderFunctionArgs) => {
  return Response.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
};
