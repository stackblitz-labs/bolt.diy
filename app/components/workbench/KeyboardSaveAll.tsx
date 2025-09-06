import { useEffect } from 'react';
import { toast } from 'react-toastify';
import { workbenchStore } from '~/lib/stores/workbench';

export function useKeyboardSaveAll() {
  useEffect(() => {
    const handleKeyPress = async (e: KeyboardEvent) => {
      // Ctrl+Shift+S or Cmd+Shift+S to save all
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 's') {
        e.preventDefault();

        const unsavedFiles = workbenchStore.unsavedFiles.get();

        if (unsavedFiles.size === 0) {
          toast.info('All files are already saved', {
            position: 'bottom-right',
            autoClose: 2000,
          });
          return;
        }

        try {
          const count = unsavedFiles.size;
          await workbenchStore.saveAllFiles();

          toast.success(`Saved ${count} file${count > 1 ? 's' : ''}`, {
            position: 'bottom-right',
            autoClose: 2000,
          });
        } catch {
          toast.error('Failed to save some files', {
            position: 'bottom-right',
            autoClose: 3000,
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);

    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);
}
