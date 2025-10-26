import { json, type LoaderFunctionArgs } from '@remix-run/cloudflare';

export const loader = async ({ request: _request }: LoaderFunctionArgs) => {
  return json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
};
