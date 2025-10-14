import { toast } from 'react-toastify';
import { database } from '~/lib/persistence/apps';
import { chatStore } from '~/lib/stores/chat';
import { useStore } from '@nanostores/react';
import { classNames } from '~/utils/classNames';
import { isCopyingStore, setIsCopying } from '~/lib/stores/loadAppStore';

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
    <div className="p-5 bg-bolt-elements-background-depth-2 rounded-2xl border border-bolt-elements-borderColor">
      <div className="flex flex-col items-center gap-3">
        <p className="text-bolt-elements-textPrimary leading-relaxed font-medium text-center">
          Create a copy of this app to make modifications that won't affect the original.
        </p>
        <button
          onClick={handleCopyApp}
          disabled={isCopying}
          className={classNames(
            'inline-flex items-center justify-center px-8 py-4 rounded-xl text-sm font-semibold transition-all duration-200 shadow-sm w-full sm:w-auto',
            {
              'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 hover:shadow-md hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500/20':
                !isCopying,
              'bg-bolt-elements-background-depth-1 text-bolt-elements-textSecondary border border-bolt-elements-borderColor/30 cursor-not-allowed':
                isCopying,
            },
          )}
        >
          {isCopying ? (
            <span className="flex items-center gap-3">
              <div className="w-4 h-4 border-2 border-bolt-elements-textSecondary border-t-transparent rounded-full animate-spin"></div>
              Creating Copy...
            </span>
          ) : (
            <span className="flex items-center gap-3">
              <div className="i-ph:copy-duotone text-lg"></div>
              Create a Copy
            </span>
          )}
        </button>

        <p className="text-xs text-bolt-elements-textSecondary">
          Your copy will be independent and you'll have full access to modify it
        </p>
      </div>
    </div>
  );
};

export default CopyApp;
