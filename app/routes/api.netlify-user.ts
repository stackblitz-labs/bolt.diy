import { json } from '@remix-run/cloudflare';
import { getApiKeysFromCookie } from '~/lib/api/cookies';
import { withSecurity } from '~/lib/security';

async function netlifyUserLoader({ request, context }: { request: Request; context: any }) {
  try {
    // Get API keys from cookies (server-side only)
    const cookieHeader = request.headers.get('Cookie');
    const apiKeys = getApiKeysFromCookie(cookieHeader);

    // Try to get Netlify token from various sources
    const netlifyToken =
      apiKeys.VITE_NETLIFY_ACCESS_TOKEN ||
      context?.cloudflare?.env?.VITE_NETLIFY_ACCESS_TOKEN ||
      process.env.VITE_NETLIFY_ACCESS_TOKEN;

    if (!netlifyToken) {
      return json({ error: 'Netlify token not found' }, { status: 401 });
    }

    // Make server-side request to Netlify API
    const response = await fetch('https://api.netlify.com/api/v1/user', {
      headers: {
        Authorization: `Bearer ${netlifyToken}`,
        'User-Agent': 'bolt.diy-app',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        return json({ error: 'Invalid Netlify token' }, { status: 401 });
      }

      throw new Error(`Netlify API error: ${response.status}`);
    }

    const userData = (await response.json()) as {
      id: string;
      name: string | null;
      email: string;
      avatar_url: string | null;
      full_name: string | null;
    };

    return json({
      id: userData.id,
      name: userData.name,
      email: userData.email,
      avatar_url: userData.avatar_url,
      full_name: userData.full_name,
    });
  } catch (error) {
    console.error('Error fetching Netlify user:', error);
    return json(
      {
        error: 'Failed to fetch Netlify user information',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export const loader = withSecurity(netlifyUserLoader, {
  rateLimit: true,
  allowedMethods: ['GET'],
});

async function netlifyUserAction({ request, context }: { request: Request; context: any }) {
  try {
    const formData = await request.formData();
    const action = formData.get('action');

    // Get API keys from cookies (server-side only)
    const cookieHeader = request.headers.get('Cookie');
    const apiKeys = getApiKeysFromCookie(cookieHeader);

    // Try to get Netlify token from various sources
    const netlifyToken =
      apiKeys.VITE_NETLIFY_ACCESS_TOKEN ||
      context?.cloudflare?.env?.VITE_NETLIFY_ACCESS_TOKEN ||
      process.env.VITE_NETLIFY_ACCESS_TOKEN;

    if (!netlifyToken) {
      return json({ error: 'Netlify token not found' }, { status: 401 });
    }

    if (action === 'get_sites') {
      // Fetch user sites
      const response = await fetch('https://api.netlify.com/api/v1/sites', {
        headers: {
          Authorization: `Bearer ${netlifyToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'bolt.diy-app',
        },
      });

      if (!response.ok) {
        throw new Error(`Netlify API error: ${response.status}`);
      }

      const sites = (await response.json()) as Array<{
        id: string;
        name: string;
        url: string;
        admin_url: string;
        build_settings: any;
        created_at: string;
        updated_at: string;
      }>;

      return json({
        sites: sites.map((site) => ({
          id: site.id,
          name: site.name,
          url: site.url,
          admin_url: site.admin_url,
          build_settings: site.build_settings,
          created_at: site.created_at,
          updated_at: site.updated_at,
        })),
        totalSites: sites.length,
      });
    }

    return json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in Netlify user action:', error);
    return json(
      {
        error: 'Failed to process Netlify request',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export const action = withSecurity(netlifyUserAction, {
  rateLimit: true,
  allowedMethods: ['POST'],
});
