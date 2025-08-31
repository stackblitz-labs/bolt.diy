import { useStore } from '@nanostores/react';
import { workbenchStore } from '~/lib/stores/workbench';
import { useState } from 'react';
import { streamingState } from '~/lib/stores/streaming';
import { ExportChatButton } from '~/components/chat/chatExportAndImport/ExportChatButton';
import { useChatHistory } from '~/lib/persistence';
import { DeployButton } from '~/components/deploy/DeployButton';
import { ImportProjectButton } from '~/components/import-project/ImportProjectButton';
import { authStore } from '~/lib/stores/auth';
import { useNavigate } from '@remix-run/react';
import { motion } from 'framer-motion';

interface HeaderActionButtonsProps {
  chatStarted: boolean;
}

export function HeaderActionButtons({ chatStarted }: HeaderActionButtonsProps) {
  const [activePreviewIndex] = useState(0);
  const previews = useStore(workbenchStore.previews);
  const activePreview = previews[activePreviewIndex];
  const isStreaming = useStore(streamingState);
  const authState = useStore(authStore);
  const navigate = useNavigate();
  const { exportChat } = useChatHistory();

  const shouldShowButtons = !isStreaming && activePreview;

  return (
    <div className="flex items-center gap-2">
      {/* Multi-User Button - Only show if not authenticated */}
      {!authState.isAuthenticated && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('/auth')}
          className="relative group px-3 py-1.5 rounded-lg bg-bolt-elements-button-secondary-background hover:bg-bolt-elements-button-secondary-backgroundHover border border-bolt-elements-borderColor transition-all"
          title="Activate Multi-User Features"
        >
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4 text-blue-400 group-hover:text-blue-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
            <span className="text-xs font-medium text-bolt-elements-textSecondary group-hover:text-bolt-elements-textPrimary hidden sm:inline">
              Multi-User
            </span>
            <div className="absolute -top-1 -right-1">
              <span className="flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
              </span>
            </div>
          </div>
        </motion.button>
      )}
      <ImportProjectButton />
      {chatStarted && shouldShowButtons && <ExportChatButton exportChat={exportChat} />}
      {shouldShowButtons && <DeployButton />}
    </div>
  );
}
