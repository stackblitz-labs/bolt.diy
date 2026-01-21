import { toast } from 'react-toastify';
import { database } from '~/lib/persistence/apps';
import { chatStore } from '~/lib/stores/chat';
import { useStore } from '@nanostores/react';
import { isCopyingStore, setIsCopying } from '~/lib/stores/loadAppStore';
import { Copy } from '~/components/ui/Icon';
import { Button } from '~/components/ui/button';

const CopyApp = () => {
  const isCopying = useStore(isCopyingStore);
  const initialAppId = useStore(chatStore.currentAppId);

  const handleCopyApp = async () => {
    if (!initialAppId || isCopying) {
      return;
    }

    setIsCopying(true);
    try {
      const newAppId = await database.copyApp(initialAppId);
      toast.success('App copied successfully!');
      window.location.href = `/app/${newAppId}`;
    } catch (error) {
      console.error('Failed to copy app:', error);
      toast.error('Failed to copy app. Please try again.');
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-bolt-elements-textPrimary">Copy Application</h3>
        <p className="text-xs text-bolt-elements-textSecondary mt-1">Create an independent copy of this application</p>
      </div>

      <div className="p-4 border border-bolt-elements-borderColor rounded-md bg-bolt-elements-background-depth-2">
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm text-bolt-elements-textSecondary text-center">
            Your copy will be independent and you'll have full access to modify it without affecting the original.
          </p>
          <Button onClick={handleCopyApp} disabled={isCopying} variant="outline" className="h-9">
            {isCopying ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-bolt-elements-textSecondary border-t-transparent rounded-full animate-spin"></div>
                Copying App...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Copy size={16} className="text-bolt-elements-textSecondary" />
                Copy App
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CopyApp;
