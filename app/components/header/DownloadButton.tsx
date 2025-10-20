import ReactModal from 'react-modal';
import { toast } from 'react-toastify';
import { workbenchStore } from '~/lib/stores/workbench';
import { downloadRepository } from '~/lib/replay/Deploy';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import WithTooltip from '~/components/ui/Tooltip';
import { useStore } from '@nanostores/react';
import { userStore } from '~/lib/stores/userAuth';
import { Download } from '~/components/ui/Icon';

ReactModal.setAppElement('#root');

export function DownloadButton() {
  const user = useStore(userStore.user);

  const handleDownload = async () => {
    const repositoryId = workbenchStore.repositoryId.get();
    if (!repositoryId) {
      toast.error('No repository ID found');
      return;
    }

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
    }
  };

  return (
    <>
      <TooltipProvider>
        <WithTooltip tooltip="Download Code">
          <button
            className="flex items-center justify-center p-2.5 rounded-xl bg-gradient-to-r from-slate-500 to-slate-600 hover:from-slate-600 hover:to-slate-700 text-white text-bolt-elements-textHeading border border-bolt-elements-borderColor transition-all duration-200 shadow-sm hover:shadow-md hover:scale-105 group"
            onClick={handleDownload}
          >
            <Download className="transition-transform duration-200 group-hover:scale-110" size={20} />
          </button>
        </WithTooltip>
      </TooltipProvider>
    </>
  );
}
