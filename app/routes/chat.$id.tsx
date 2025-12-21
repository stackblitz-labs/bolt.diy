import { json, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { default as IndexRoute } from './_index';
import { getProjectByUrlId } from '~/lib/services/projects.server';
import { auth } from '~/lib/auth/auth.server';

export async function loader(args: LoaderFunctionArgs) {
  const { params, request } = args;
  const urlId = params.id;

  if (!urlId) {
    return json({ id: null, projectId: null, error: 'URL ID is required' }, { status: 400 });
  }

  try {
    // Get the current user
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session || !session.user || !session.user.id) {
      return json({ id: null, projectId: null, error: 'Authentication required' }, { status: 401 });
    }

    const user = session.user;

    // Try to resolve the URL ID to a project
    const project = await getProjectByUrlId(urlId, user.id);

    if (!project) {
      // Project not found, could be a regular chat or invalid URL
      return json({
        id: urlId,
        projectId: null, // No project found, fall back to regular chat
        error: null,
      });
    }

    return json({
      id: urlId,
      projectId: project.id, // Use the actual project ID
      error: null,
    });
  } catch (error) {
    // Log authentication/database errors for debugging while falling back gracefully
    console.error('Chat authentication error:', error);

    // If there's an authentication error or other issue, fall back to regular chat
    return json({
      id: urlId,
      projectId: null,
      error: null, // Don't show error to user, just fall back to regular chat
    });
  }
}

export default IndexRoute;
