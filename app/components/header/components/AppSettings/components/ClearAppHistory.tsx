import { useState } from 'react';
import { toast } from 'react-toastify';
import { database } from '~/lib/persistence/apps';
import { chatStore } from '~/lib/stores/chat';
import { useStore } from '@nanostores/react';
import { classNames } from '~/utils/classNames';
import { Trash2 } from '~/components/ui/Icon';

const ClearAppHistory = () => {
  const [isClearing, setIsClearing] = useState(false);
  const appId = useStore(chatStore.currentAppId);

  const handleClearHistory = async () => {
    if (!appId || isClearing) {
      return;
    }

    setIsClearing(true);
    try {
      await database.clearAppHistory(appId);
      chatStore.messages.set([]);
      chatStore.events.set([]);
      toast.success('Chat history cleared successfully!');
    } catch (error) {
      console.error('Failed to clear chat history:', error);
      toast.error('Failed to clear chat history. Please try again.');
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="p-5 bg-bolt-elements-background-depth-2 rounded-2xl border border-bolt-elements-borderColor">
      <div className="flex flex-col items-center gap-3">
        <p className="text-bolt-elements-textPrimary leading-relaxed font-medium text-center">
          Clear all chat history for this app.
        </p>
        <button
          onClick={handleClearHistory}
          disabled={isClearing}
          className={classNames(
            'inline-flex items-center justify-center px-8 py-4 rounded-xl text-sm font-semibold transition-all duration-200 shadow-sm w-full sm:w-auto',
            {
              'bg-gradient-to-r from-rose-500 to-rose-600 text-white hover:from-rose-600 hover:to-rose-700 hover:shadow-md hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-rose-500/20':
                !isClearing,
              'bg-bolt-elements-background-depth-1 text-bolt-elements-textSecondary border border-bolt-elements-borderColor border-opacity-30 cursor-not-allowed':
                isClearing,
            },
          )}
        >
          {isClearing ? (
            <span className="flex items-center gap-3">
              <div className="w-4 h-4 border-2 border-bolt-elements-textSecondary border-t-transparent rounded-full animate-spin"></div>
              Clearing History...
            </span>
          ) : (
            <span className="flex items-center gap-3">
              <Trash2 size={18} />
              Clear Chat History
            </span>
          )}
        </button>

        <p className="text-xs text-bolt-elements-textSecondary">
          This action cannot be undone. All chat messages will be permanently removed.
        </p>
      </div>
    </div>
  );
};

export default ClearAppHistory;
