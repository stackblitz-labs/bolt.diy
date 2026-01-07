import { json, type MetaFunction } from '~/lib/remix-types';
import { Suspense } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { PageContainer } from '~/layout/PageContainer';
import { useUser } from '~/hooks/useUser';
import LandingPage from '~/components/broken-dreams/LandingPage';

export const meta: MetaFunction = () => {
  return [{ title: 'Replay Builder' }];
};

export const loader = () => json({});

const Nothing = () => null;

export default function Index() {
  useUser();

  return (
    <PageContainer>
      <Suspense fallback={<Nothing />}>
        <ClientOnly>{() => <LandingPage />}</ClientOnly>
      </Suspense>
    </PageContainer>
  );
}
