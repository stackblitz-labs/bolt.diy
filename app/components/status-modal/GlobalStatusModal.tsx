import { useStore } from '@nanostores/react';
import { statusModalStore } from '~/lib/stores/statusModal';
import { StatusModal } from './StatusModal';
import { chatStore, continueBuilding } from '~/lib/stores/chat';

export function GlobalStatusModal() {
  const isOpen = useStore(statusModalStore.isOpen);
  const appSummary = useStore(chatStore.appSummary);

  if (!isOpen || !appSummary) {
    return null;
  }

  const handleContinueBuilding = () => {
    continueBuilding();
  };

  return <StatusModal appSummary={appSummary} onContinueBuilding={handleContinueBuilding} />;
}
