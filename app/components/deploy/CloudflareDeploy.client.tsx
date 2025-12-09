import { toast } from 'react-toastify';
import { useStore } from '@nanostores/react';
import { cloudflareConnection } from '~/lib/stores/cloudflare';
import { workbenchStore } from '~/lib/stores/workbench';
import { webcontainer } from '~/lib/webcontainer';
import { path } from '~/utils/path';
import { useState } from 'react';
import type { ActionCallbackData } from '~/lib/runtime/message-parser';
import { chatId } from '~/lib/persistence/useChatHistory';

export function useCloudflareDeploy() {
  const [isDeploying, setIsDeploying] = useState(false);
  const cloudflareConn = useStore(cloudflareConnection);
  const currentChatId = useStore(chatId);

  const handleCloudflareDeploy = async () => {
    // Platform-managed mode doesn't require user connection
    const isPlatformManaged = !cloudflareConn.user;

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
      const deploymentId = `deploy-cloudflare-project`;
      workbenchStore.addArtifact({
        id: deploymentId,
        messageId: deploymentId,
        title: 'Cloudflare Deployment',
        type: 'standalone',
      });

      const deployArtifact = workbenchStore.artifacts.get()[deploymentId];

      // Notify that build is starting
      deployArtifact.runner.handleDeployAction('building', 'running', { source: 'cloudflare' });

      // Set up build action
      const actionId = 'build-' + Date.now();
      const actionData: ActionCallbackData = {
        messageId: 'cloudflare build',
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
        deployArtifact.runner.handleDeployAction('building', 'failed', {
          error: 'Build failed. Check the terminal for details.',
          source: 'cloudflare',
        });
        throw new Error('Build failed');
      }

      // Notify that build succeeded and deployment is starting
      deployArtifact.runner.handleDeployAction('deploying', 'running', { source: 'cloudflare' });

      // Get the build files
      const container = await webcontainer;
      const buildPath = artifact.runner.buildOutput.path.replace('/home/project', '');

      // Find build directory
      let finalBuildPath = buildPath;
      const commonOutputDirs = [buildPath, '/dist', '/build', '/out', '/output', '/.next', '/public'];
      let buildPathExists = false;

      for (const dir of commonOutputDirs) {
        try {
          await container.fs.readdir(dir);
          finalBuildPath = dir;
          buildPathExists = true;
          break;
        } catch {
          continue;
        }
      }

      if (!buildPathExists) {
        throw new Error('Could not find build output directory');
      }

      // Get all files recursively
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

      console.log('[Cloudflare Deploy] Build path:', finalBuildPath);
      console.log('[Cloudflare Deploy] Collected files count:', Object.keys(fileContents).length);
      console.log('[Cloudflare Deploy] File paths:', Object.keys(fileContents).slice(0, 10));

      // Get all source project files for framework detection
      const allProjectFiles: Record<string, string> = {};

      async function getAllProjectFiles(dirPath: string): Promise<void> {
        const entries = await container.fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);

          if (entry.isFile()) {
            try {
              const content = await container.fs.readFile(fullPath, 'utf-8');

              // Store with relative path from project root
              let relativePath = fullPath;

              if (fullPath.startsWith('/home/project/')) {
                relativePath = fullPath.replace('/home/project/', '');
              } else if (fullPath.startsWith('./')) {
                relativePath = fullPath.replace('./', '');
              }

              allProjectFiles[relativePath] = content;
            } catch (error) {
              // Skip binary files or files that can't be read as text
              console.log(`Skipping file ${entry.name}: ${error}`);
            }
          } else if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            await getAllProjectFiles(fullPath);
          }
        }
      }

      // Try to read from the current directory first
      try {
        await getAllProjectFiles('.');
      } catch {
        // Fallback to /home/project if current directory doesn't work
        await getAllProjectFiles('/home/project');
      }

      // Deploy
      const response = await fetch('/api/cloudflare-deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          files: fileContents,
          sourceFiles: allProjectFiles,
          chatId: currentChatId,
          authMode: isPlatformManaged ? 'platform-managed' : 'user-token',
          token: cloudflareConn.token,
          accountId: cloudflareConn.accountId,
        }),
      });

      const data = (await response.json()) as any;

      if (!response.ok || !data.success) {
        deployArtifact.runner.handleDeployAction('deploying', 'failed', {
          error: data.error || 'Deployment failed',
          source: 'cloudflare',
        });
        throw new Error(data.error || 'Deployment failed');
      }

      // Store deployment info
      localStorage.setItem(
        `cloudflare-deployment-${currentChatId}`,
        JSON.stringify({
          deploymentId: data.deploymentId,
          url: data.url,
        }),
      );

      // Notify success
      deployArtifact.runner.handleDeployAction('complete', 'complete', {
        url: data.url,
        source: 'cloudflare',
      });

      toast.success('🚀 Cloudflare deployment completed successfully!');
      return true;
    } catch (error) {
      console.error('Cloudflare deploy error:', error);
      toast.error(error instanceof Error ? error.message : 'Deployment failed');
      return false;
    } finally {
      setIsDeploying(false);
    }
  };

  return {
    isDeploying,
    handleCloudflareDeploy,
    isConnected: !!cloudflareConn.user,
    isPlatformManagedAvailable: true, // Always available for platform-managed mode
  };
}

