import { AlertTriangle } from '~/components/ui/Icon';

interface UnsavedChangesDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function UnsavedChangesDialog({ isOpen, onConfirm, onCancel }: UnsavedChangesDialogProps) {
  if (!isOpen) {
    return null;
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-[1001] flex items-center justify-center p-4 transition-all duration-300"
      onClick={handleOverlayClick}
    >
      <div
        className="bg-bolt-elements-background-depth-1 rounded-3xl border border-bolt-elements-borderColor shadow-3xl max-w-md w-full mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative px-8 pt-12 pb-8 text-center bg-gradient-to-br from-yellow-500/5 to-orange-500/5">
          {/* Warning icon */}
          <div className="mb-6">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-yellow-400 to-orange-500 shadow-2xl flex items-center justify-center">
              <AlertTriangle className="text-white" size={36} />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-bolt-elements-textHeading mb-3 leading-tight">Unsaved Changes</h2>

          {/* Subtitle */}
          <p className="text-bolt-elements-textSecondary font-medium">You have unsaved theme changes</p>
        </div>

        {/* Content */}
        <div className="px-8 pb-8">
          {/* Message */}
          <div className="text-center mb-8">
            <p className="text-bolt-elements-textPrimary leading-relaxed">
              Leaving the design tab will reset your theme changes. Do you want to continue?
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-4">
            <button
              onClick={onCancel}
              className="flex-1 py-3 px-6 rounded-2xl font-semibold text-bolt-elements-textPrimary bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor hover:bg-bolt-elements-background-depth-3 transition-all duration-200 hover:scale-105"
            >
              Stay
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 py-3 px-6 rounded-2xl font-semibold text-white bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105"
            >
              Leave
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

