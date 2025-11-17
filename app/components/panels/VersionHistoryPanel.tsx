import { useStore } from '@nanostores/react';
import { chatStore } from '~/lib/stores/chat';
import AppHistory from '~/components/workbench/VesionHistory/AppHistory';
import { History } from '~/components/ui/Icon';
import { versionHistoryStore } from '~/lib/stores/versionHistory';

export const VersionHistoryPanel = () => {
  const appId = useStore(chatStore.currentAppId);
  const history = useStore(versionHistoryStore.history);
  const isLoading = useStore(versionHistoryStore.isLoading);

  if (!appId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-bolt-elements-textSecondary">No app loaded</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-bolt-elements-background-depth-1 rounded-xl border border-bolt-elements-borderColor shadow-lg overflow-hidden">
      <div className="bg-bolt-elements-background-depth-1 border-b border-bolt-elements-borderColor border-opacity-50 shadow-sm rounded-t-xl">
        <div className="flex items-center gap-2 px-4 h-[38px]">
          <div className="flex-1 text-bolt-elements-textSecondary text-sm font-medium truncate">Version History</div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <AppHistory appId={appId} cachedHistory={history} isLoading={isLoading} />
      </div>
    </div>
  );
};
