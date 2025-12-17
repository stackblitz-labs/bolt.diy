import React from 'react';
import { useStore } from '@nanostores/react';
import { designPanelStore } from '~/lib/stores/designSystemStore';
import { classNames } from '~/utils/classNames';
import { Save, X } from 'lucide-react';

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
    <div className="bg-bolt-elements-background-depth-1 px-4 py-3 flex items-center justify-end">
      <div className="flex items-center gap-2">
        {hasChanges && (
          <button
            onClick={handleDiscard}
            className={classNames(
              'px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200',
              'border border-bolt-elements-borderColor',
              'bg-bolt-elements-background-depth-2 text-bolt-elements-textPrimary',
              'hover:bg-bolt-elements-background-depth-3 hover:border-bolt-elements-focus/50',
            )}
          >
            <div className="flex items-center gap-2">
              <X size={16} />
              <span>Discard Changes</span>
            </div>
          </button>
        )}
        {!hasChanges && (
          <button
            onClick={() => designPanelStore.isVisible.set(false)}
            className={classNames(
              'px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200',
              'border border-bolt-elements-borderColor',
              'bg-bolt-elements-background-depth-2 text-bolt-elements-textPrimary',
              'hover:bg-bolt-elements-background-depth-3 hover:border-bolt-elements-focus/50',
            )}
          >
            <div className="flex items-center gap-2">
              <X size={16} />
              <span>Close</span>
            </div>
          </button>
        )}

        <button
          onClick={handlers.onSave}
          disabled={!hasChanges || isSaving}
          className={classNames(
            'px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200',
            'border',
            hasChanges && !isSaving
              ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white border-blue-600 hover:from-blue-600 hover:to-blue-700 hover:shadow-md'
              : 'bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary border-bolt-elements-borderColor',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'flex items-center gap-2',
          )}
          title={hasChanges ? (isSaving ? 'Saving...' : 'Save theme changes') : 'No changes to save'}
        >
          {isSaving ? (
            <>
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Save size={16} />
              <span>Save</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
