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
  const cfConn = useStore(cloudflareConnection);
  const currentChatId = useStore(chatId);

  const handleCloudflareDeploy = async () => {
    if (!cfConn.accountId || !cfConn.token) {
      toast.error('Please configure Cloudflare account and token in settings.');
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

      const deploymentId = `deploy-cloudflare`;
      workbenchStore.addArtifact({
        id: deploymentId,
        messageId: deploymentId,
        title: 'Cloudflare Deployment',
        type: 'standalone',
      });

      const deployArtifact = workbenchStore.artifacts.get()[deploymentId];

      deployArtifact.runner.handleDeployAction('building', 'running', { source: 'cloudflare' });

      const actionId = 'build-' + Date.now();
      const actionData: ActionCallbackData = {
        messageId: 'cloudflare build',
        artifactId: artifact.id,
        actionId,
        action: { type: 'build' as const, content: 'npm run build' },
      };

      artifact.runner.addAction(actionData);
      await artifact.runner.runAction(actionData);

      if (!artifact.runner.buildOutput) {
        deployArtifact.runner.handleDeployAction('building', 'failed', { error: 'Build failed', source: 'cloudflare' });
        throw new Error('Build failed');
      }

      deployArtifact.runner.handleDeployAction('deploying', 'running', { source: 'cloudflare' });

      const container = await webcontainer;
      const buildPath = artifact.runner.buildOutput.path.replace('/home/project', '');
      const commonDirs = [buildPath, '/dist', '/build', '/out', '/output', '/.next', '/public'];
      let finalBuildPath = buildPath;
      let found = false;

      for (const dir of commonDirs) {
        try {
          await container.fs.readdir(dir);
          finalBuildPath = dir;
          found = true;
          break;
        } catch {}
      }

      if (!found) {
        throw new Error('Could not find build output directory');
      }

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
            Object.assign(files, await getAllFiles(fullPath));
          }
        }

        return files;
      }

      const fileContents = await getAllFiles(finalBuildPath);
      const existingProject = localStorage.getItem(`cloudflare-project-${currentChatId}`);

      const response = await fetch('/api/cloudflare-deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName: existingProject || undefined,
          files: fileContents,
          token: cfConn.token,
          accountId: cfConn.accountId,
          chatId: currentChatId,
        }),
      });

      interface DeployResponse {
        deploy?: { url: string };
        project?: { name: string };
        error?: string;
      }

      const data = (await response.json()) as DeployResponse;

      if (!response.ok || !data.deploy || !data.project) {
        deployArtifact.runner.handleDeployAction('deploying', 'failed', {
          error: data.error || 'Invalid deployment response',
          source: 'cloudflare',
        });
        throw new Error(data.error || 'Invalid deployment response');
      }

      localStorage.setItem(`cloudflare-project-${currentChatId}`, data.project.name);

      deployArtifact.runner.handleDeployAction('complete', 'complete', { url: data.deploy.url, source: 'cloudflare' });

      return true;
    } catch (err) {
      console.error('Cloudflare deploy error:', err);
      toast.error(err instanceof Error ? err.message : 'Cloudflare deployment failed');

      return false;
    } finally {
      setIsDeploying(false);
    }
  };

  return { isDeploying, handleCloudflareDeploy, isConnected: !!cfConn.token };
}
