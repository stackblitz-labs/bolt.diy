import React, { useState, useCallback } from 'react';
import { ImportProjectDialog } from './ImportProjectDialog';
import { workbenchStore } from '~/lib/stores/workbench';
import { toast } from 'react-toastify';
import { useHotkeys } from 'react-hotkeys-hook';

export const ImportProjectButton: React.FC = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Add keyboard shortcut
  useHotkeys('ctrl+shift+i, cmd+shift+i', (e) => {
    e.preventDefault();
    setIsDialogOpen(true);
  });

  const handleImport = useCallback(async (files: Map<string, string>) => {
    try {
      console.log('[ImportProject] Starting import of', files.size, 'files');

      // Add files to workbench
      for (const [path, content] of files.entries()) {
        // Ensure path starts with /
        const normalizedPath = path.startsWith('/') ? path : `/${path}`;

        console.log('[ImportProject] Adding file:', normalizedPath);

        // Add file to workbench file system
        workbenchStore.files.setKey(normalizedPath, {
          type: 'file',
          content,
          isBinary: false,
        });
      }

      // Open the first file in the editor if any
      const firstFile = Array.from(files.keys())[0];

      if (firstFile) {
        const normalizedPath = firstFile.startsWith('/') ? firstFile : `/${firstFile}`;
        workbenchStore.setSelectedFile(normalizedPath);
      }

      toast.success(`Successfully imported ${files.size} files`, {
        position: 'bottom-right',
        autoClose: 3000,
      });

      setIsDialogOpen(false);
    } catch (error) {
      console.error('[ImportProject] Import failed:', error);
      toast.error('Failed to import project files', {
        position: 'bottom-right',
        autoClose: 5000,
      });
    }
  }, []);

  return (
    <>
      <button
        onClick={() => setIsDialogOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-bolt-elements-button-primary-background hover:bg-bolt-elements-button-primary-backgroundHover text-bolt-elements-button-primary-text transition-colors duration-200"
        title="Import existing project (Ctrl+Shift+I)"
      >
        <div className="i-ph:upload-simple text-lg" />
        <span className="text-sm font-medium">Import Project</span>
      </button>

      <ImportProjectDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} onImport={handleImport} />
    </>
  );
};
