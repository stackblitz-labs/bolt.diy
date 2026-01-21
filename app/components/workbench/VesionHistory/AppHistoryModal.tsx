import { useStore } from '@nanostores/react';
import { appHistoryModalStore, closeAppHistoryModal } from '~/lib/stores/appHistoryModal';
import AppHistory from '~/components/panels/HistoryPanel/AppHistory';
import { IconButton } from '~/components/ui/IconButton';
import { RotateCw, X } from '~/components/ui/Icon';

const AppHistoryModal = () => {
  const { isOpen, appId } = useStore(appHistoryModalStore);

  if (!isOpen || !appId) {
    return null;
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      closeAppHistoryModal();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-40 flex items-center justify-center p-4"
      onClick={handleOverlayClick}
    >
      <div
        className="flex flex-col w-full max-w-6xl max-h-[90vh] bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-2xl shadow-2xl z-50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-bolt-elements-borderColor border-opacity-50">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center shadow-sm">
              <RotateCw className="text-white" size={18} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-bolt-elements-textHeading">Version History</h2>
              <p className="text-sm text-bolt-elements-textSecondary">View and manage app versions</p>
            </div>
          </div>

          <IconButton
            onClick={closeAppHistoryModal}
            className="flex items-center justify-center w-8 h-8 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-2 rounded-lg transition-all duration-200 hover:scale-105"
            icon={<X size={16} />}
            aria-label="Close modal"
            size="xxl"
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          <AppHistory appId={appId} />
        </div>
      </div>
    </div>
  );
};

export default AppHistoryModal;
