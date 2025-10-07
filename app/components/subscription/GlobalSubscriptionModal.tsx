import { useStore } from '@nanostores/react';
import { subscriptionModalStore } from '~/lib/stores/subscriptionModal';
import { SubscriptionModal } from './SubscriptionModal';

export function GlobalSubscriptionModal() {
  const { currentTier } = useStore(subscriptionModalStore);

  return <SubscriptionModal currentTier={currentTier} />;
}
