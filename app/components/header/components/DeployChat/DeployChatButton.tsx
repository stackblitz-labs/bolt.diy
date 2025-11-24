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

export enum DeployStatus {
  NotStarted,
  Started,
  Succeeded,
}

export function DeployChatButton() {
  const status = useStore(deployModalStore.status);
  const appId = useStore(chatStore.currentAppId);

  const handleOpenModal = async () => {
    if (!appId) {
      toast.error('No app ID found');
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

  return (
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
  );
}
