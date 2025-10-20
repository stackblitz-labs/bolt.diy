import { useStore } from '@nanostores/react';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import WithTooltip from '~/components/ui/Tooltip';
import { openAppHistoryModal } from '~/lib/stores/appHistoryModal';
import { chatStore } from '~/lib/stores/chat';
import { List } from '~/components/ui/Icon';

const ViewVersionHistoryButton = () => {
  const appId = useStore(chatStore.currentAppId);

  const handleClick = () => {
    if (appId) {
      openAppHistoryModal(appId);
    }
  };

  if (!appId) {
    return null;
  }

  return (
    <TooltipProvider>
      <WithTooltip tooltip="View version history">
        <button
          onClick={handleClick}
          className="flex items-center justify-center p-2.5 rounded-xl bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-3 hover:text-bolt-elements-textPrimary border border-bolt-elements-borderColor transition-all duration-200 shadow-sm hover:shadow-md hover:scale-105 group"
          title="View version history"
        >
          <List className="transition-transform duration-200 group-hover:scale-110" size={20} strokeWidth={2.5} />
        </button>
      </WithTooltip>
    </TooltipProvider>
  );
};

export default ViewVersionHistoryButton;
