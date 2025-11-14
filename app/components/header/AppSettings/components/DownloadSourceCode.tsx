import { toast } from 'react-toastify';

import { workbenchStore } from '~/lib/stores/workbench';

import { downloadRepository } from '~/lib/replay/Deploy';

import { useStore } from '@nanostores/react';

import { classNames } from '~/utils/classNames';

import { userStore } from '~/lib/stores/auth';

import { Download } from '~/components/ui/Icon';

import { useState } from 'react';

const DownloadSourceCode = () => {
  const user = useStore(userStore);
  const [isDownloading, setIsDownloading] = useState(false);
  const repositoryId = useStore(workbenchStore.repositoryId);

  const handleDownload = async () => {
    if (!repositoryId || isDownloading) {
      return;
    }

    setIsDownloading(true);
    try {
      const repositoryContents = await downloadRepository(repositoryId);

      const byteCharacters = atob(repositoryContents);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/zip' });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `repository-${repositoryId}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('Repository downloaded successfully');
      if (window.analytics) {
        window.analytics.track('Downloaded Code', {
          timestamp: new Date().toISOString(),
          userId: user?.id,
          email: user?.email,
        });
      }
    } catch (error) {
      console.error('Error downloading repository:', error);
      toast.error('Failed to download repository');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="p-5 bg-bolt-elements-background-depth-2 rounded-2xl border border-bolt-elements-borderColor">
      <div className="flex flex-col items-center gap-3">
        <p className="text-bolt-elements-textPrimary leading-relaxed font-medium text-center">
          Download your app's source code as a ZIP file to run locally or deploy elsewhere.
        </p>
        <button
          onClick={handleDownload}
          disabled={isDownloading || !repositoryId}
          className={classNames(
            'inline-flex items-center justify-center px-8 py-4 rounded-xl text-sm font-semibold transition-all duration-200 shadow-sm w-full sm:w-auto',
            {
              'bg-gradient-to-r from-slate-500 to-slate-600 text-white hover:from-slate-600 hover:to-slate-700 hover:shadow-md hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-slate-500/20':
                !isDownloading && repositoryId,
              'bg-bolt-elements-background-depth-1 text-bolt-elements-textSecondary border border-bolt-elements-borderColor border-opacity-30 cursor-not-allowed':
                isDownloading || !repositoryId,
            },
          )}
        >
          {isDownloading ? (
            <span className="flex items-center gap-3">
              <div className="w-4 h-4 border-2 border-bolt-elements-textSecondary border-t-transparent rounded-full animate-spin"></div>
              Downloading...
            </span>
          ) : (
            <span className="flex items-center gap-3">
              <Download size={18} />
              Download Source Code
            </span>
          )}
        </button>

        <p className="text-xs text-bolt-elements-textSecondary">
          The ZIP file contains all your app's code and dependencies
        </p>
      </div>
    </div>
  );
};

export default DownloadSourceCode;
