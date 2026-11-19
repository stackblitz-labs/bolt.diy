import { useStore } from '@nanostores/react';
import { useState } from 'react';
import { toast } from 'react-toastify';
import { formatBuildFailureOutput } from './deployUtils';
import {
  DEEDPAGE_MAX_BODY_BYTES,
  DEEDPAGE_TOKEN_KEY,
  deedPageBodySize,
  deedPageSiteKey,
  deedPageSlugForChat,
  toDeedPageFiles,
} from '~/lib/deedpage';
import { chatId } from '~/lib/persistence/useChatHistory';
import type { ActionCallbackData } from '~/lib/runtime/message-parser';
import { workbenchStore } from '~/lib/stores/workbench';
import { webcontainer } from '~/lib/webcontainer';
import { path } from '~/utils/path';

interface DeedPageDeployResponse {
  url?: string;
  slug?: string;
  version?: string;
  token?: string;
  error?: string;
}

/**
 * Deploys the build output to deed.page. No account is needed: the first
 * deploy returns an owner token that is kept in this browser and sent on later
 * deploys, so the same chat keeps updating the same https://<slug>.deed.page/ site.
 */
export function useDeedPageDeploy() {
  const [isDeploying, setIsDeploying] = useState(false);
  const currentChatId = useStore(chatId);

  const handleDeedPageDeploy = async () => {
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

      const deploymentId = `deploy-deedpage-project`;
      workbenchStore.addArtifact({
        id: deploymentId,
        messageId: deploymentId,
        title: 'deed.page Deployment',
        type: 'standalone',
      });

      const deployArtifact = workbenchStore.artifacts.get()[deploymentId];
      deployArtifact.runner.handleDeployAction('building', 'running', { source: 'deedpage' });

      const actionId = 'build-' + Date.now();

      const actionData: ActionCallbackData = {
        messageId: 'deedpage build',
        artifactId: artifact.id,
        actionId,
        action: {
          type: 'build' as const,
          content: 'npm run build',
        },
      };

      artifact.runner.addAction(actionData);
      await artifact.runner.runAction(actionData);

      const buildOutput = artifact.runner.buildOutput;

      if (!buildOutput || buildOutput.exitCode !== 0) {
        deployArtifact.runner.handleDeployAction('building', 'failed', {
          error: formatBuildFailureOutput(buildOutput?.output),
          source: 'deedpage',
        });
        throw new Error('Build failed');
      }

      deployArtifact.runner.handleDeployAction('deploying', 'running', { source: 'deedpage' });

      const container = await webcontainer;
      const buildPath = buildOutput.path.replace('/home/project', '');
      const commonOutputDirs = [buildPath, '/dist', '/build', '/out', '/output', '/public'];

      let finalBuildPath: string | null = null;

      for (const dir of commonOutputDirs) {
        try {
          await container.fs.readdir(dir);
          finalBuildPath = dir;
          break;
        } catch {
          continue;
        }
      }

      if (!finalBuildPath) {
        throw new Error('Could not find build output directory. Please check your build configuration.');
      }

      const outputRoot = finalBuildPath;
      const entries: Array<{ path: string; bytes: Uint8Array }> = [];

      async function collect(dirPath: string): Promise<void> {
        const dirEntries = await container.fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of dirEntries) {
          const fullPath = path.join(dirPath, entry.name);

          if (entry.isFile()) {
            entries.push({ path: path.relative(outputRoot, fullPath), bytes: await container.fs.readFile(fullPath) });
          } else if (entry.isDirectory()) {
            await collect(fullPath);
          }
        }
      }

      await collect(outputRoot);

      const files = toDeedPageFiles(entries);
      const siteKey = deedPageSiteKey(currentChatId);
      const slug = localStorage.getItem(siteKey) || deedPageSlugForChat(currentChatId);
      const token = localStorage.getItem(DEEDPAGE_TOKEN_KEY) || undefined;

      if (deedPageBodySize(slug, files) > DEEDPAGE_MAX_BODY_BYTES) {
        throw new Error('The build is larger than the 4 MB deed.page upload limit');
      }

      const response = await fetch('/api/deedpage-deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, files, token }),
      });

      const data = (await response.json()) as DeedPageDeployResponse;

      if (!response.ok || !data.url) {
        deployArtifact.runner.handleDeployAction('deploying', 'failed', {
          error: data.error || 'Invalid deployment response',
          source: 'deedpage',
        });
        throw new Error(data.error || 'Invalid deployment response');
      }

      localStorage.setItem(siteKey, data.slug || slug);

      if (data.token) {
        // First publish: deed.page returns the owner token once. It is the only key that can update or delete the site.
        localStorage.setItem(DEEDPAGE_TOKEN_KEY, data.token);
        toast.info(
          `deed.page created an owner token for your sites and saved it in this browser (localStorage "${DEEDPAGE_TOKEN_KEY}"). Copy it somewhere safe to manage your sites at deed.page/account.`,
          { autoClose: false },
        );
      }

      deployArtifact.runner.handleDeployAction('complete', 'complete', {
        url: data.url,
        source: 'deedpage',
      });

      toast.success(`🚀 deed.page deployment completed successfully!`);

      return true;
    } catch (err) {
      console.error('deed.page deploy error:', err);
      toast.error(err instanceof Error ? err.message : 'deed.page deployment failed');

      return false;
    } finally {
      setIsDeploying(false);
    }
  };

  return {
    isDeploying,
    handleDeedPageDeploy,
  };
}
