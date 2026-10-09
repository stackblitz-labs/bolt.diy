import React, { useRef, useState } from 'react';
import type { Message } from 'ai';
import { toast } from 'react-toastify';
import { createChatFromZip } from '~/utils/zipImport';
import { logStore } from '~/lib/stores/logs';
import { Button } from '~/components/ui/Button';
import { classNames } from '~/utils/classNames';

interface ImportZipButtonProps {
  className?: string;
  importChat?: (description: string, messages: Message[]) => Promise<void>;
}

export const ImportZipButton: React.FC<ImportZipButtonProps> = ({ className, importChat }) => {
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) {
      return;
    }

    setIsLoading(true);

    const loadingToast = toast.loading(`Importing ${file.name}…`);

    try {
      const result = await createChatFromZip(file);

      if (result.skippedBinary > 0) {
        logStore.logWarning('Skipping binary files during ZIP import', {
          zipName: file.name,
          binaryCount: result.skippedBinary,
        });
        toast.info(`Skipping ${result.skippedBinary} binary file${result.skippedBinary === 1 ? '' : 's'}`);
      }

      /*
       * Set flag before navigation so the new chat picks it up on mount.
       * importChat does a full window.location.href redirect, so append()
       * would be gone by the time it resolves.
       */
      if (result.hasExpoConfig) {
        /*
         * Expo/React Native — WebContainer can't run native code.
         * Ask bolt to review the code instead of trying to boot the project.
         */
        localStorage.setItem(
          'bolt_zip_autorun',
          'This is an Expo/React Native project. Review the code structure and give me a summary of what the app does and how it is organized. Do not run any install or dev server commands — I will run this locally with Expo CLI.',
        );
      } else if (result.hasPackageJson) {
        localStorage.setItem('bolt_zip_autorun', 'Install the dependencies and start the development server.');
      }

      if (importChat) {
        await importChat(file.name.replace(/\.zip$/i, ''), result.messages);
      }

      logStore.logSystem('ZIP imported successfully', {
        zipName: file.name,
        textFileCount: result.totalFiles - result.skippedBinary - result.skippedIgnored,
        binaryFileCount: result.skippedBinary,
        ignoredFileCount: result.skippedIgnored,
      });

      toast.success('ZIP imported successfully');
    } catch (error) {
      logStore.logError('Failed to import ZIP', error, { zipName: file.name });
      console.error('Failed to import ZIP:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to import ZIP');
    } finally {
      setIsLoading(false);
      toast.dismiss(loadingToast);

      // Reset so the same file can be re-selected
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  return (
    <>
      <input ref={inputRef} type="file" className="hidden" accept=".zip" onChange={handleFileChange} />
      <Button
        onClick={() => inputRef.current?.click()}
        title="Import ZIP"
        variant="default"
        size="lg"
        className={classNames(
          'gap-2 bg-bolt-elements-background-depth-1',
          'text-bolt-elements-textPrimary',
          'hover:bg-bolt-elements-background-depth-2',
          'border border-bolt-elements-borderColor',
          'h-10 px-4 py-2 min-w-[120px] justify-center',
          'transition-all duration-200 ease-in-out',
          className,
        )}
        disabled={isLoading}
      >
        <span className="i-ph:file-zip w-4 h-4" />
        {isLoading ? 'Importing…' : 'Import ZIP'}
      </Button>
    </>
  );
};
