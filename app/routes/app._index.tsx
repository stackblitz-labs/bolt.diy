/**
 * Protected Route Example
 *
 * Example of a protected route under /app/** that requires authentication.
 * This demonstrates the requireSession guard pattern for protecting workspace routes.
 *
 * Based on specs/002-better-auth/tasks.md (T026)
 */

import { json, type LoaderFunctionArgs, type MetaFunction } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { requireSession } from '~/lib/auth/guards.server';

export const meta: MetaFunction = () => {
  return [
    { title: 'Workspace - Huskit' },
    { name: 'description', content: 'Protected workspace dashboard' },
  ];
};

/**
 * Loader: Require authentication before rendering
 *
 * This route is protected - unauthenticated users will be redirected to login
 * with a returnTo parameter to come back here after authentication.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  // This will throw a redirect if not authenticated
  const session = await requireSession(request);

  return json({
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image,
    },
  });
}

/**
 * Protected Workspace Dashboard
 *
 * This is an example protected route. Only authenticated users can access it.
 */
export default function WorkspaceDashboard() {
  const { user } = useLoaderData<typeof loader>();

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-lg bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-bold text-gray-900">Welcome to Your Workspace</h1>
          <p className="mt-2 text-gray-600">
            This is a protected route. You must be authenticated to see this page.
          </p>

          <div className="mt-8 rounded-lg border border-gray-200 bg-gray-50 p-6">
            <h2 className="text-lg font-semibold text-gray-900">Your Profile</h2>
            <div className="mt-4 space-y-2">
              <p className="text-sm text-gray-600">
                <span className="font-medium">Name:</span> {user.name || 'Not set'}
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-medium">Email:</span> {user.email}
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-medium">User ID:</span> {user.id}
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> This is an example protected route. In a real application, you
              would add your workspace content here. All routes under <code>/app/**</code> should
              use the <code>requireSession</code> guard in their loaders.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

