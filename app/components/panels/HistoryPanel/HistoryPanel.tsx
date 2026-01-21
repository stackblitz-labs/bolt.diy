import { useStore } from '@nanostores/react';
import { chatStore } from '~/lib/stores/chat';
import { History } from 'lucide-react';
import AppHistory from '~/components/panels/HistoryPanel/AppHistory';

export const HistoryPanel = () => {
  const appId = useStore(chatStore.currentAppId);

  return (
    <div className="@container flex flex-col h-full w-full bg-bolt-elements-background-depth-1 rounded-md border border-bolt-elements-borderColor shadow-lg overflow-hidden">
      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {!appId ? (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <div className="w-16 h-16 bg-bolt-elements-background-depth-2 rounded-2xl flex items-center justify-center mb-4 border border-bolt-elements-borderColor">
              <History className="text-bolt-elements-textSecondary" size={24} />
            </div>
            <h3 className="text-lg font-semibold text-bolt-elements-textHeading mb-2">No App Selected</h3>
            <p className="text-bolt-elements-textSecondary text-sm">
              Start a conversation to create an app and view its version history.
            </p>
          </div>
        ) : (
          <AppHistory appId={appId} />
        )}
      </div>
    </div>
  );
};
