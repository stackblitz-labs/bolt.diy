import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { requireSession } from '~/lib/auth/guards.server';
import CreateProjectPage from '~/components/projects/CreateProjectPage';

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await requireSession(request);
  return json({ user: session.user });
}

export default function NewProjectRoute() {
  return <CreateProjectPage />;
}
