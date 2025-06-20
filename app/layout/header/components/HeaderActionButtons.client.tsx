import { useStore } from '@nanostores/react';
import { workbenchStore } from '~/workbench/stores/workbench';
import { useState } from 'react';
import { streamingState } from '~/shared/stores/streaming';
import { ExportChatButton } from '~/chat/components/chatExportAndImport/ExportChatButton';
import { useChatHistory } from '~/shared/lib/persistence';
import { DeployButton } from '~/layout/header/components/DeployButton';

interface HeaderActionButtonsProps {
  chatStarted: boolean;
}

export function HeaderActionButtons({ chatStarted }: HeaderActionButtonsProps) {
  const [activePreviewIndex] = useState(0);
  const previews = useStore(workbenchStore.previews);
  const activePreview = previews[activePreviewIndex];
  const isStreaming = useStore(streamingState);
  const { exportChat } = useChatHistory();

  const shouldShowButtons = !isStreaming && activePreview;

  return (
    <div className="flex items-center">
      {chatStarted && shouldShowButtons && <ExportChatButton exportChat={exportChat} />}
      {shouldShowButtons && <DeployButton />}
    </div>
  );
}
