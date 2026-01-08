import { useState } from 'react';
import ReactModal from 'react-modal';
import { toast } from 'react-toastify';
import { workbenchStore } from '~/lib/stores/workbench';
import { downloadRepository } from '~/lib/replay/Deploy';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import WithTooltip from '~/components/ui/Tooltip';
import { useStore } from '@nanostores/react';
import { userStore } from '~/lib/stores/auth';
import { Download, Crown, X } from '~/components/ui/Icon';
import { subscriptionStore } from '~/lib/stores/subscriptionStatus';
import { accountModalStore } from '~/lib/stores/accountModal';

ReactModal.setAppElement('#root');

export function DownloadButton() {
  const user = useStore(userStore);
  const stripeSubscription = useStore(subscriptionStore.subscription);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const isBuilder = stripeSubscription?.tier === 'builder';

  const handleDownload = async () => {
    if (!isBuilder) {
      setShowUpgradeModal(true);
      if (window.analytics) {
        window.analytics.track('Shown Upgrade Modal - Download Code', {
          timestamp: new Date().toISOString(),
          userId: user?.id,
          email: user?.email,
        });
      }
      return;
    }

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

  const handleUpgradeClick = () => {
    accountModalStore.open('billing');
    if (window.analytics) {
      window.analytics.track('Clicked Upgrade to Builder - Download Code', {
        timestamp: new Date().toISOString(),
        userId: user?.id,
        email: user?.email,
      });
    }
    setShowUpgradeModal(false);
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

      {/* Upgrade Modal */}
      <ReactModal
        isOpen={showUpgradeModal}
        onRequestClose={() => setShowUpgradeModal(false)}
        className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 outline-none"
        overlayClassName="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200]"
      >
        <div className="flex flex-col items-center text-center">
          {/* Close button */}
          <button
            onClick={() => setShowUpgradeModal(false)}
            className="absolute top-4 right-4 p-1 rounded-lg hover:bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors"
          >
            <X size={20} />
          </button>

          {/* Icon */}
          <div className="w-16 h-16 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-2xl flex items-center justify-center mb-4 border border-purple-500/30">
            <Crown className="text-purple-500" size={32} />
          </div>

          {/* Title */}
          <h2 className="text-xl font-bold text-bolt-elements-textHeading mb-2">Premium Feature</h2>

          {/* Description */}
          <p className="text-bolt-elements-textSecondary mb-6">
            Downloading code is a premium feature available exclusively to Builder plan subscribers. Upgrade now to
            download your projects and access all premium features.
          </p>

          {/* CTA Button */}
          <button
            onClick={handleUpgradeClick}
            className="w-full px-4 py-3 text-white bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-lg transition-all duration-200 flex items-center justify-center gap-3 font-medium shadow-sm hover:shadow-md group"
          >
            <Crown className="transition-transform duration-200 group-hover:scale-110" size={20} />
            <span className="transition-transform duration-200 group-hover:scale-105">Upgrade to Builder</span>
          </button>

          {/* Secondary action */}
          <button
            onClick={() => setShowUpgradeModal(false)}
            className="mt-3 text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors"
          >
            Maybe later
          </button>
        </div>
      </ReactModal>
    </>
  );
}
