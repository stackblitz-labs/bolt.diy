import { json, type MetaFunction } from '~/lib/remix-types';
import { Suspense } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { BaseChat } from '~/components/chat/BaseChat/BaseChat';
import { Chat } from '~/components/chat/ChatComponent/Chat.client';
import { PageContainer } from '~/layout/PageContainer';
import { useUser } from '~/hooks/useUser';
import { checkSubscriptionStatus } from '~/lib/stripe/client';
import { useEffect } from 'react';
import { subscriptionStore } from '~/lib/stores/subscriptionStatus';

export const meta: MetaFunction = () => {
  return [{ title: 'Nut' }];
};

export const loader = () => json({});

const Nothing = () => null;

export default function Index() {
  const user = useUser();

  useEffect(() => {
    const fetchSubscriptionStatus = async () => {
      if (user) {
        const stripeStatus = await checkSubscriptionStatus();
        subscriptionStore.setSubscription(stripeStatus);
      }
    };

    fetchSubscriptionStatus();
  }, [user]);

  return (
    <PageContainer>
      <Suspense fallback={<Nothing />}>
        <ClientOnly fallback={<BaseChat />}>{() => <Chat />}</ClientOnly>
      </Suspense>
    </PageContainer>
  );
}
