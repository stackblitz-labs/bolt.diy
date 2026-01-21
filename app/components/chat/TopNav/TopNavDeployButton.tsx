import { useStore } from '@nanostores/react';
import { toast } from 'react-toastify';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import WithTooltip from '~/components/ui/Tooltip';
import { Button } from '~/components/ui/button';
import { chatStore } from '~/lib/stores/chat';
import { deployModalStore } from '~/lib/stores/deployModal';
import { workbenchStore } from '~/lib/stores/workbench';
import { database } from '~/lib/persistence/apps';
import { downloadRepository } from '~/lib/replay/Deploy';
import { ChevronDown, Check, Loader2 } from '~/components/ui/Icon';
import { DeployStatus } from '~/components/header/components/DeployChat/DeployChatButton';

export function TopNavDeployButton() {
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

  const isDeploying = status === DeployStatus.Started;
  const isDeployed = status === DeployStatus.Succeeded;

  return (
    <TooltipProvider>
      <WithTooltip tooltip={isDeploying ? 'Deploying...' : isDeployed ? 'Deployed' : 'Deploy App'}>
        <Button
          variant="outline"
          onClick={handleOpenModal}
          disabled={isDeploying}
          className="h-9 px-4 gap-2 rounded-full border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 hover:bg-bolt-elements-background-depth-2 text-bolt-elements-textPrimary shadow-xs disabled:opacity-60"
        >
          {isDeploying ? (
            <Loader2 className="animate-spin" size={16} />
          ) : isDeployed ? (
            <Check className="text-green-500" size={16} />
          ) : null}
          <span className="text-sm font-medium">Deploy</span>
          <ChevronDown size={16} className="text-bolt-elements-textSecondary" />
        </Button>
      </WithTooltip>
    </TooltipProvider>
  );
}
