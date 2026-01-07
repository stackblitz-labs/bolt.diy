import { json, type MetaFunction } from '~/lib/remix-types';
import { Suspense } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { Chat } from '~/components/chat/ChatComponent/Chat.client';
import { PageContainer } from '~/layout/PageContainer';
import { useUser } from '~/hooks/useUser';
import { checkSubscriptionStatus } from '~/lib/stripe/client';
import { useEffect } from 'react';
import { subscriptionStore } from '~/lib/stores/subscriptionStatus';
import { database } from '~/lib/persistence/apps';
import { buildAccessStore } from '~/lib/stores/buildAccess';
import { BaseChat } from '~/components/chat/BaseChat/BaseChat';

export const meta: MetaFunction = () => {
  return [{ title: 'Replay Builder' }];
};

export const loader = () => json({});

const Nothing = () => null;

export default function Index() {
  const user = useUser();

  useEffect(() => {
    const fetchAccess = async () => {
      if (user) {
        const stripeStatus = await checkSubscriptionStatus();
        const list = await database.getAllAppEntries();

        buildAccessStore.setAccess(stripeStatus.subscription, list.length ?? 0);
        subscriptionStore.setSubscription(stripeStatus);
      } else {
        // Clear subscription when user signs out
        subscriptionStore.setSubscription({ hasSubscription: false, subscription: null });
        buildAccessStore.clearAccess();
      }
    };

    fetchAccess();
  }, [user]);

  return (
    <PageContainer>
      <Suspense fallback={<Nothing />}>
        <ClientOnly fallback={<BaseChat />}>{() => <Chat />}</ClientOnly>
      </Suspense>
    </PageContainer>
  );
}
