import { useState } from 'react';
import { toast } from 'react-toastify';
import { database } from '~/lib/persistence/apps';
import { chatStore } from '~/lib/stores/chat';
import { useStore } from '@nanostores/react';
import { Trash2 } from '~/components/ui/Icon';
import { Button } from '~/components/ui/button';

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
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-bolt-elements-textPrimary">Clear Chat History</h3>
        <p className="text-xs text-bolt-elements-textSecondary mt-1">Remove all chat messages from this application</p>
      </div>

      <div className="p-4 border border-bolt-elements-borderColor rounded-md bg-bolt-elements-background-depth-2">
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm text-bolt-elements-textSecondary text-center">
            This action cannot be undone. All chat messages will be permanently removed.
          </p>
          <Button
            onClick={handleClearHistory}
            disabled={isClearing}
            variant="outline"
            className="h-9 border-bolt-elements-borderColor hover:bg-bolt-elements-background-depth-1"
          >
            {isClearing ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-bolt-elements-textSecondary border-t-transparent rounded-full animate-spin"></div>
                Clearing History...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Trash2 size={16} className="text-bolt-elements-textSecondary" />
                Clear Chat History
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ClearAppHistory;
