import type { ActionFunction } from 'react-router';
import { getApiKeysFromCookie } from '~/lib/api/cookies';
import { withSecurity } from '~/lib/security';
import type { SupabaseProject } from '~/types/supabase';

export const loader = withSecurity(
  async ({ request, context }) => {
    const apiKeys = getApiKeysFromCookie(request.headers.get('Cookie'));
    const env = context?.cloudflare?.env as { VITE_SUPABASE_ACCESS_TOKEN?: string } | undefined;

    const token = [
      apiKeys?.VITE_SUPABASE_ACCESS_TOKEN,
      env?.VITE_SUPABASE_ACCESS_TOKEN,
      process.env.VITE_SUPABASE_ACCESS_TOKEN,
    ]
      .find((value) => typeof value === 'string' && value.trim())
      ?.trim();

    const headers = { 'Cache-Control': 'no-store' };

    if (!token) {
      return Response.json({ error: 'Supabase token not found' }, { status: 401, headers });
    }

    try {
      const response = await fetch('https://api.supabase.com/v1/projects', {
        headers: { Authorization: `Bearer ${token}` },
        signal: request.signal,
      });

      if (response.ok) {
        return new Response(null, { status: 204, headers });
      }

      if (response.status === 401 || response.status === 403) {
        return Response.json({ error: 'Invalid Supabase token' }, { status: 401, headers });
      }
    } catch {
      // Report upstream failures without including request or credential details.
    }

    return Response.json({ error: 'Unable to validate the Supabase token' }, { status: 502, headers });
  },
  { allowedMethods: ['GET'] },
);

export const action: ActionFunction = async ({ request }) => {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const { token } = (await request.json()) as any;

    const projectsResponse = await fetch('https://api.supabase.com/v1/projects', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!projectsResponse.ok) {
      const errorText = await projectsResponse.text();
      console.error('Projects fetch failed:', errorText);

      return Response.json({ error: 'Failed to fetch projects' }, { status: 401 });
    }

    const projects = (await projectsResponse.json()) as SupabaseProject[];

    const uniqueProjectsMap = new Map<string, SupabaseProject>();

    for (const project of projects) {
      if (!uniqueProjectsMap.has(project.id)) {
        uniqueProjectsMap.set(project.id, project);
      }
    }

    const uniqueProjects = Array.from(uniqueProjectsMap.values());

    uniqueProjects.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return Response.json({
      user: { email: 'Connected', role: 'Admin' },
      stats: {
        projects: uniqueProjects,
        totalProjects: uniqueProjects.length,
      },
    });
  } catch (error) {
    console.error('Supabase API error:', error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : 'Authentication failed',
      },
      { status: 401 },
    );
  }
};
