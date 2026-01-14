import { toast } from 'react-toastify';
import { useStore } from '@nanostores/react';
import { workbenchStore } from '~/lib/stores/workbench';
import { webcontainer } from '~/lib/webcontainer';
import { path } from '~/utils/path';
import { useState } from 'react';
import type { ActionCallbackData } from '~/lib/runtime/message-parser';
import { chatId } from '~/lib/persistence/useChatHistory';
import { getLocalStorage } from '~/lib/persistence/localStorage';

export function useGitLabDeploy() {
  const [isDeploying, setIsDeploying] = useState(false);
  const currentChatId = useStore(chatId);

  const handleGitLabDeploy = async () => {
    const connection = getLocalStorage('gitlab_connection');

    if (!connection?.token || !connection?.user) {
      toast.error('Please connect your GitLab account in Settings > Connections first');
      return false;
    }

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

      // Create a deployment artifact for visual feedback
      const deploymentId = `deploy-gitlab-project`;
      workbenchStore.addArtifact({
        id: deploymentId,
        messageId: deploymentId,
        title: 'GitLab Deployment',
        type: 'standalone',
      });

      const deployArtifact = workbenchStore.artifacts.get()[deploymentId];

      // Notify that build is starting
      deployArtifact.runner.handleDeployAction('building', 'running', { source: 'gitlab' });

      const actionId = 'build-' + Date.now();
      const actionData: ActionCallbackData = {
        messageId: 'gitlab build',
        artifactId: artifact.id,
        actionId,
        action: {
          type: 'build' as const,
          content: 'npm run build',
        },
      };

      // Add the action first
      artifact.runner.addAction(actionData);

      // Then run it
      await artifact.runner.runAction(actionData);

      if (!artifact.runner.buildOutput) {
        // Notify that build failed
        deployArtifact.runner.handleDeployAction('building', 'failed', {
          error: 'Build failed. Check the terminal for details.',
          source: 'gitlab',
        });
        throw new Error('Build failed');
      }

      // Notify that build succeeded and deployment preparation is starting
      deployArtifact.runner.handleDeployAction('deploying', 'running', {
        source: 'gitlab',
      });

      // Get all project files instead of just the build directory since we're deploying to a repository
      const container = await webcontainer;

      // Get all files recursively - we'll deploy the entire project, not just the build directory
      async function getAllFiles(dirPath: string, basePath: string = ''): Promise<Record<string, string>> {
        const files: Record<string, string> = {};
        const entries = await container.fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);

          // Create a relative path without the leading slash for GitLab
          const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;

          // Skip node_modules, .git directories and other common excludes
          if (
            entry.isDirectory() &&
            (entry.name === 'node_modules' ||
              entry.name === '.git' ||
              entry.name === 'dist' ||
              entry.name === 'build' ||
              entry.name === '.cache' ||
              entry.name === '.next')
          ) {
            continue;
          }

          if (entry.isFile()) {
            // Skip binary files, large files and other common excludes
            if (entry.name.endsWith('.DS_Store') || entry.name.endsWith('.log') || entry.name.startsWith('.env')) {
              continue;
            }

            try {
              const content = await container.fs.readFile(fullPath, 'utf-8');

              // Store the file with its relative path, not the full system path
              files[relativePath] = content;
            } catch (error) {
              console.warn(`Could not read file ${fullPath}:`, error);
              continue;
            }
          } else if (entry.isDirectory()) {
            const subFiles = await getAllFiles(fullPath, relativePath);
            Object.assign(files, subFiles);
          }
        }

        return files;
      }

      const fileContents = await getAllFiles('/');

      /*
       * Show GitLab deployment dialog here - it will handle the actual deployment
       * and will receive these files to deploy
       */

      /*
       * For now, we'll just complete the deployment with a success message
       * Notify that deployment preparation is complete
       */
      deployArtifact.runner.handleDeployAction('deploying', 'complete', {
        source: 'gitlab',
      });

      // Show success toast notification
      toast.success(`🚀 GitLab deployment preparation completed successfully!`);

      return {
        success: true,
        files: fileContents,
        projectName: artifact.title || 'bolt-project',
      };
    } catch (err) {
      console.error('GitLab deploy error:', err);
      toast.error(err instanceof Error ? err.message : 'GitLab deployment preparation failed');

      return false;
    } finally {
      setIsDeploying(false);
    }
  };

  return {
    isDeploying,
    handleGitLabDeploy,
    isConnected: !!getLocalStorage('gitlab_connection')?.user,
  };
}
