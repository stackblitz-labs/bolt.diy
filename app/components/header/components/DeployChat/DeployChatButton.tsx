import { useState } from 'react';
import ReactModal from 'react-modal';
import { useStore } from '@nanostores/react';
import { chatStore } from '~/lib/stores/chat';
import { deployModalStore } from '~/lib/stores/deployModal';
import { workbenchStore } from '~/lib/stores/workbench';
import { database } from '~/lib/persistence/apps';
import { downloadRepository } from '~/lib/replay/Deploy';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import WithTooltip from '~/components/ui/Tooltip';
import { Button } from '~/components/ui/button';
import { toast } from 'react-toastify';
import { Check, Rocket } from 'lucide-react';
import { subscriptionStore } from '~/lib/stores/subscriptionStatus';
import { userStore } from '~/lib/stores/auth';
import { Crown, X } from '~/components/ui/Icon';
import { accountModalStore } from '~/lib/stores/accountModal';

export enum DeployStatus {
  NotStarted,
  Started,
  Succeeded,
}

export function DeployChatButton() {
  const status = useStore(deployModalStore.status);
  const appId = useStore(chatStore.currentAppId);
  const stripeSubscription = useStore(subscriptionStore.subscription);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const user = useStore(userStore);

  const isBuilder = stripeSubscription?.tier === 'builder';

  const handleOpenModal = async () => {
    if (!appId) {
      toast.error('No app ID found');
      return;
    }

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

    deployModalStore.setLoadingData(true);
    deployModalStore.open();

    // Check for database
    const repositoryId = workbenchStore.repositoryId.get();
    if (repositoryId) {
      try {
        const repositoryContents = await downloadRepository(repositoryId);
        const byteCharacters = atob(repositoryContents);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/zip' });

        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            const zipContents = event.target.result as string;
            deployModalStore.setDatabaseFound(zipContents.includes('supabase'));
          }
        };
        reader.readAsText(blob);
      } catch (error) {
        console.error('Error downloading repository:', error);
        toast.error('Failed to download repository');
      }
    }

    // Load existing settings
    const existingSettings = await database.getAppDeploySettings(appId);
    if (existingSettings) {
      deployModalStore.setDeploySettings(existingSettings);
    }

    deployModalStore.setLoadingData(false);
    deployModalStore.setStatus(DeployStatus.NotStarted);
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
        <WithTooltip
          tooltip={
            status === DeployStatus.Started
              ? 'Deploying...'
              : status === DeployStatus.Succeeded
                ? 'Deployed'
                : 'Deploy App'
          }
        >
          <Button
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white rounded-xl p-2.5 transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 border border-white/20 hover:border-white/30 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 group"
            onClick={handleOpenModal}
            disabled={status === DeployStatus.Started}
          >
            {status === DeployStatus.Started ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : status === DeployStatus.Succeeded ? (
              <Check className="text-green-500 text-xl drop-shadow-sm transition-transform duration-200 group-hover:scale-110" />
            ) : (
              <Rocket className="text-xl text-white drop-shadow-sm transition-transform duration-200 group-hover:scale-110" />
            )}
          </Button>
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
            Deploying apps is a premium feature available exclusively to Builder plan subscribers. Upgrade now to deploy
            your projects and access all premium features.
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
