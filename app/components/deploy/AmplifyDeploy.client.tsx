import { toast } from 'react-toastify';
import { useStore } from '@nanostores/react';
import { amplifyConnection } from '~/lib/stores/amplify';
import { workbenchStore } from '~/lib/stores/workbench';
import { webcontainer } from '~/lib/webcontainer';
import { path } from '~/utils/path';
import { useState } from 'react';
import type { ActionCallbackData } from '~/lib/runtime/message-parser';
import { chatId } from '~/lib/persistence/useChatHistory';

export function useAmplifyDeploy() {
  const [isDeploying, setIsDeploying] = useState(false);
  const amplifyConn = useStore(amplifyConnection);
  const currentChatId = useStore(chatId);

  const handleAmplifyDeploy = async () => {
    const isPlatformManaged = !amplifyConn.user;

    if (!currentChatId) {
      toast.error('No active chat found');
      return false;
    }

    try {
      setIsDeploying(true);

      const artifact = workbenchStore.firstArtifact;

      if (!artifact) {
        throw new Error('No active project found');
      }

      // Create deployment artifact
      const deploymentArtifactId = `deploy-amplify-project`;
      workbenchStore.addArtifact({
        id: deploymentArtifactId,
        messageId: deploymentArtifactId,
        title: 'AWS Amplify Deployment',
        type: 'standalone',
      });

      const deployArtifact = workbenchStore.artifacts.get()[deploymentArtifactId];

      // Build phase
      deployArtifact.runner.handleDeployAction('building', 'running', { source: 'amplify' });

      const actionId = 'build-' + Date.now();
      const actionData: ActionCallbackData = {
        messageId: 'amplify build',
        artifactId: artifact.id,
        actionId,
        action: {
          type: 'build' as const,
          content: 'npm run build',
        },
      };

      artifact.runner.addAction(actionData);
      await artifact.runner.runAction(actionData);

      if (!artifact.runner.buildOutput) {
        deployArtifact.runner.handleDeployAction('building', 'failed', {
          error: 'Build failed. Check the terminal for details.',
          source: 'amplify',
        });
        throw new Error('Build failed');
      }

      // Upload phase
      deployArtifact.runner.handleDeployAction('deploying', 'running', { source: 'amplify' });

      const container = await webcontainer;
      const buildPath = artifact.runner.buildOutput.path.replace('/home/project', '');

      // Find build directory
      let finalBuildPath = buildPath;
      const commonOutputDirs = [buildPath, '/dist', '/build', '/out', '/output', '/.next', '/public'];

      for (const dir of commonOutputDirs) {
        try {
          await container.fs.readdir(dir);
          finalBuildPath = dir;
          break;
        } catch {
          continue;
        }
      }

      // Get all files
      async function getAllFiles(dirPath: string): Promise<Record<string, string>> {
        const files: Record<string, string> = {};
        const entries = await container.fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);

          if (entry.isFile()) {
            const content = await container.fs.readFile(fullPath, 'utf-8');
            const deployPath = fullPath.replace(finalBuildPath, '');
            files[deployPath] = content;
          } else if (entry.isDirectory()) {
            const subFiles = await getAllFiles(fullPath);
            Object.assign(files, subFiles);
          }
        }

        return files;
      }

      const fileContents = await getAllFiles(finalBuildPath);

      // Deploy
      const response = await fetch('/api/amplify-deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          files: fileContents,
          chatId: currentChatId,
          authMode: isPlatformManaged ? 'platform-managed' : 'user-token',
          accessKeyId: amplifyConn.accessKeyId,
          secretAccessKey: amplifyConn.secretAccessKey,
          region: amplifyConn.region,
        }),
      });

      const data = (await response.json()) as any;

      if (!response.ok || !data.success) {
        deployArtifact.runner.handleDeployAction('deploying', 'failed', {
          error: data.error || 'Deployment failed',
          source: 'amplify',
        });
        throw new Error(data.error || 'Deployment failed');
      }

      // Store deployment info
      localStorage.setItem(
        `amplify-deployment-${currentChatId}`,
        JSON.stringify({
          deploymentId: data.deploymentId,
          externalId: data.externalId,
          url: data.url,
        }),
      );

      /*
       * TODO: Implement Amplify status polling when API is ready (Phase 3)
       * For now, skip polling and mark as complete immediately
       */
      deployArtifact.runner.handleDeployAction('complete', 'complete', {
        url: data.url,
        source: 'amplify',
      });

      toast.success('🚀 AWS Amplify deployment completed successfully!');

      return true;
    } catch (error) {
      console.error('Amplify deploy error:', error);
      toast.error(error instanceof Error ? error.message : 'Deployment failed');

      return false;
    } finally {
      setIsDeploying(false);
    }
  };

  return {
    isDeploying,
    handleAmplifyDeploy,
    isConnected: !!amplifyConn.user,
    isPlatformManagedAvailable: true,
  };
}
