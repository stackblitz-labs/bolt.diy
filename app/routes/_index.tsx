import { json, redirect, type MetaFunction, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { useNavigate } from '@remix-run/react';
import { ProjectErrorBoundary } from '~/components/projects/ProjectErrorBoundary';
import { LandingPage } from '~/components/landing/LandingPage';
import { getSession } from '~/lib/auth/session.server';
import { getProjectsByUserId } from '~/lib/services/projects.server';

export const meta: MetaFunction = () => {
  return [{ title: 'HuskIT' }, { name: 'description', content: 'Talk with HuskIT, an AI assistant' }];
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const session = await getSession(request);

  if (session?.user) {
    const { total } = await getProjectsByUserId(session.user.id, { limit: 1 });

    if (total > 0) {
      return redirect('/app');
    } else {
      return redirect('/app/projects/new');
    }
  }

  return json({});
};

export default function Index() {
  const navigate = useNavigate();

  return (
    <ProjectErrorBoundary>
      <LandingPage onStart={() => navigate('/auth/signup')} />
    </ProjectErrorBoundary>
  );
}
