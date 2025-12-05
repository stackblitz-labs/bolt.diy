import { useEffect, useRef } from 'react';
import { useStore } from '@nanostores/react';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import { AnimatePresence, cubicBezier, motion } from 'framer-motion';
import WithTooltip from '~/components/ui/Tooltip';
import { chatStore } from '~/lib/stores/chat';
import { ArrowUp, StopCircle } from '~/components/ui/Icon';
import { ChatMode } from '~/lib/replay/SendChatMessage';
import type { ChatMessageParams } from '~/components/chat/ChatComponent/components/ChatImplementer/ChatImplementer';
import { workbenchStore } from '~/lib/stores/workbench';

interface ReactComponent {
  displayName?: string;
  name?: string;
}

interface SelectedElementData {
  component: ReactComponent | null;
  tree: ReactComponent[];
}

interface SendButtonProps {
  disabled?: boolean;
  handleStop?: () => void;
  handleSendMessage?: (params: ChatMessageParams) => void;
  input?: string;
  uploadedFiles?: File[];
}

const customEasingFn = cubicBezier(0.4, 0, 0.2, 1);

export const SendButton = ({
  disabled,
  handleStop,
  handleSendMessage,
  input = '',
  uploadedFiles = [],
}: SendButtonProps) => {
  const hasPendingMessage = useStore(chatStore.hasPendingMessage);
  const selectedElement = useStore(workbenchStore.selectedElement) as SelectedElementData | null;
  const showStopConfirmation = useStore(chatStore.showStopConfirmation);
  const popupRef = useRef<HTMLDivElement>(null);

  // Close popup when clicking outside
  useEffect(() => {
    if (!showStopConfirmation) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        chatStore.showStopConfirmation.set(false);
      }
    };

    // Add a small delay before attaching the listener to prevent immediate closure
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showStopConfirmation]);

  const className = `absolute flex justify-center items-center bottom-[22px] right-[22px] p-2 ${
    hasPendingMessage
      ? 'bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600'
      : 'bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600'
  } text-white rounded-xl h-[40px] w-[40px] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl hover:scale-105 border border-white/20 hover:border-white/30 group`;

  // Determine tooltip text based on button state
  const tooltipText = hasPendingMessage ? 'Stop Generation' : 'Send Message';

  const handleClick = (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    event.preventDefault();

    if (disabled) {
      return;
    }

    if (hasPendingMessage) {
      chatStore.showStopConfirmation.set(true);
      return;
    }

    if (input.length > 0 || uploadedFiles.length > 0) {
      // Transform selectedElement to API format
      const componentReference = selectedElement?.tree
        ? {
            componentNames: selectedElement.tree.map((comp: ReactComponent) => comp.displayName || 'Anonymous'),
          }
        : undefined;

      handleSendMessage?.({
        messageInput: input,
        chatMode: ChatMode.UserMessage,
        componentReference,
      });

      // Clear selected element after sending
      if (selectedElement) {
        workbenchStore.setSelectedElement(null);
      }
    }
  };

  const confirmStop = () => {
    handleStop?.();
    chatStore.showStopConfirmation.set(false);
  };

  const cancelStop = () => {
    chatStore.showStopConfirmation.set(false);
  };

  useEffect(() => {
    if (!hasPendingMessage) {
      chatStore.showStopConfirmation.set(false);
    }
  }, [hasPendingMessage]);

  return (
    <>
      <AnimatePresence>
        <TooltipProvider>
          <WithTooltip tooltip={tooltipText}>
            <motion.button
              className={className}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ ease: customEasingFn, duration: 0.17 }}
              disabled={disabled}
              onClick={handleClick}
            >
              {!hasPendingMessage ? (
                <ArrowUp
                  className="transition-transform duration-200 group-hover:scale-110"
                  size={20}
                  strokeWidth={2.5}
                />
              ) : (
                <StopCircle className="transition-transform duration-200 group-hover:scale-110" size={20} />
              )}
            </motion.button>
          </WithTooltip>
        </TooltipProvider>
      </AnimatePresence>

      {/* Stop Confirmation Popup */}
      {showStopConfirmation && (
        <div className="absolute bottom-0 right-[72px] z-150" ref={popupRef}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col justify-center items-center bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 p-4 min-w-[150px]"
          >
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Confirm stop?</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={cancelStop}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
              >
                No
              </button>
              <button
                onClick={confirmStop}
                className="px-3 py-1.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-md transition-colors"
              >
                Yes
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
};
