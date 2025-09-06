import { useState } from 'react';
import { useStore } from '@nanostores/react';
import { workbenchStore } from '~/lib/stores/workbench';
import { streamingState } from '~/lib/stores/streaming';
import { DeployDialog } from './DeployDialog';

export const DeployButton = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activePreviewIndex] = useState(0);
  const previews = useStore(workbenchStore.previews);
  const activePreview = previews[activePreviewIndex];
  const isStreaming = useStore(streamingState);

  return (
    <>
      <button
        onClick={() => setIsDialogOpen(true)}
        disabled={!activePreview || isStreaming}
        className="px-4 py-1.5 rounded-lg bg-accent-500 text-white hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 text-sm font-medium"
        title="Deploy your project"
      >
        <span className="i-ph:rocket-launch text-lg" />
        Deploy
      </button>

      <DeployDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} />
    </>
  );
};
