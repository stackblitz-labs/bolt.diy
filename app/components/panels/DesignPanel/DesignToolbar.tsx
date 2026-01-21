import { useStore } from '@nanostores/react';
import { designPanelStore } from '~/lib/stores/designSystemStore';
import { classNames } from '~/utils/classNames';
import { sidebarPanelStore } from '~/lib/stores/sidebarPanel';
import { Button } from '~/components/ui/button';

export const DesignToolbar = () => {
  const handlers = useStore(designPanelStore.handlers);
  const themeChanges = useStore(designPanelStore.themeChanges);
  const isDesignPanelVisible = useStore(designPanelStore.isVisible);
  const isSaving = handlers.isSaving || false;

  if (!isDesignPanelVisible) {
    return null;
  }

  const hasChanges = themeChanges.hasChanges;

  const handleDiscard = () => {
    if (handlers.onDiscard) {
      handlers.onDiscard();
    }
  };

  return (
    <div className="bg-bolt-elements-background-depth-1 px-4 py-3 flex items-center justify-between border-t border-bolt-elements-borderColor">
      <Button
        onClick={
          hasChanges
            ? handleDiscard
            : () => {
                designPanelStore.isVisible.set(false);
                sidebarPanelStore.setActivePanel('chat');
              }
        }
        className={classNames(
          'flex-1 h-10 text-sm font-medium rounded-full transition-all duration-200',
          'border border-bolt-elements-borderColor',
          'bg-background text-bolt-elements-textPrimary',
          'hover:bg-bolt-elements-background-depth-2',
        )}
        variant="outline"
      >
        {hasChanges ? 'Discard changes' : 'Close'}
      </Button>

      <div className="w-3" />

      <Button
        onClick={handlers.onSave}
        disabled={!hasChanges || isSaving}
        className={classNames('flex-1 h-10 text-sm font-medium rounded-full transition-all duration-200')}
        variant="outline"
        title={hasChanges ? (isSaving ? 'Saving...' : 'Save theme changes') : 'No changes to save'}
      >
        {isSaving ? (
          <span className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            Saving...
          </span>
        ) : (
          'Save Changes'
        )}
      </Button>
    </div>
  );
};
