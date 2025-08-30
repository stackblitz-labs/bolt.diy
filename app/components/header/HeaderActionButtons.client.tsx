import { useStore } from '@nanostores/react';
import { workbenchStore } from '~/lib/stores/workbench';
import { useState } from 'react';
import { streamingState } from '~/lib/stores/streaming';
import { ExportChatButton } from '~/components/chat/chatExportAndImport/ExportChatButton';
import { useChatHistory } from '~/lib/persistence';
import { EnhancedDeployButton } from '~/components/deploy/EnhancedDeployButton';

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
      {shouldShowButtons && <EnhancedDeployButton />}
    </div>
  );
}
