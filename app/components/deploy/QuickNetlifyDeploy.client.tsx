/**
 * Quick Netlify Deployment Component
 * Contributed by Keoma Wright
 *
 * This component provides a streamlined one-click deployment to Netlify
 * with automatic build detection and configuration.
 */

import { useState } from 'react';
import { toast } from 'react-toastify';
import { useStore } from '@nanostores/react';
import { workbenchStore } from '~/lib/stores/workbench';
import { webcontainer } from '~/lib/webcontainer';
import { path } from '~/utils/path';
import { chatId } from '~/lib/persistence/useChatHistory';
import type { ActionCallbackData } from '~/lib/runtime/message-parser';

interface QuickDeployConfig {
  framework?: 'react' | 'vue' | 'angular' | 'svelte' | 'next' | 'nuxt' | 'gatsby' | 'static';
  buildCommand?: string;
  outputDirectory?: string;
  nodeVersion?: string;
}

export function QuickNetlifyDeploy() {
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployUrl, setDeployUrl] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const currentChatId = useStore(chatId);

  const detectFramework = async (): Promise<QuickDeployConfig> => {
    try {
      const container = await webcontainer;

      // Read package.json to detect framework
      let packageJson: any = {};

      try {
        const packageContent = await container.fs.readFile('/package.json', 'utf-8');
        packageJson = JSON.parse(packageContent);
      } catch {
        console.log('No package.json found, assuming static site');
        return {
          framework: 'static',
          buildCommand: '',
          outputDirectory: '/',
          nodeVersion: '18',
        };
      }

      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      const scripts = packageJson.scripts || {};

      // Detect framework based on dependencies
      const config: QuickDeployConfig = {
        nodeVersion: '18',
      };

      if (deps.next) {
        config.framework = 'next';
        config.buildCommand = scripts.build || 'npm run build';
        config.outputDirectory = '.next';
      } else if (deps.nuxt || deps.nuxt3) {
        config.framework = 'nuxt';
        config.buildCommand = scripts.build || 'npm run build';
        config.outputDirectory = '.output/public';
      } else if (deps.gatsby) {
        config.framework = 'gatsby';
        config.buildCommand = scripts.build || 'npm run build';
        config.outputDirectory = 'public';
      } else if (deps['@angular/core']) {
        config.framework = 'angular';
        config.buildCommand = scripts.build || 'npm run build';
        config.outputDirectory = 'dist';
      } else if (deps.vue) {
        config.framework = 'vue';
        config.buildCommand = scripts.build || 'npm run build';
        config.outputDirectory = 'dist';
      } else if (deps.svelte) {
        config.framework = 'svelte';
        config.buildCommand = scripts.build || 'npm run build';
        config.outputDirectory = 'public';
      } else if (deps.react) {
        config.framework = 'react';
        config.buildCommand = scripts.build || 'npm run build';
        config.outputDirectory = 'build';

        // Check for Vite
        if (deps.vite) {
          config.outputDirectory = 'dist';
        }
      } else {
        config.framework = 'static';
        config.buildCommand = scripts.build || '';
        config.outputDirectory = '/';
      }

      return config;
    } catch (error) {
      console.error('Error detecting framework:', error);
      return {
        framework: 'static',
        buildCommand: '',
        outputDirectory: '/',
        nodeVersion: '18',
      };
    }
  };

  const handleQuickDeploy = async (): Promise<string | null> => {
    if (!currentChatId) {
      toast.error('No active project found');
      return null;
    }

    try {
      setIsDeploying(true);
      setDeployUrl(null);

      const artifact = workbenchStore.firstArtifact;

      if (!artifact) {
        throw new Error('No active project found');
      }

      // Detect framework and configuration
      const config = await detectFramework();

      toast.info(`Detected ${config.framework || 'static'} project. Starting deployment...`);

      // Create deployment artifact for visual feedback
      const deploymentId = `quick-deploy-${Date.now()}`;
      workbenchStore.addArtifact({
        id: deploymentId,
        messageId: deploymentId,
        title: 'Quick Netlify Deployment',
        type: 'standalone',
      });

      const deployArtifact = workbenchStore.artifacts.get()[deploymentId];

      // Build the project if needed
      if (config.buildCommand) {
        deployArtifact.runner.handleDeployAction('building', 'running', { source: 'netlify' });

        const actionId = 'build-' + Date.now();
        const actionData: ActionCallbackData = {
          messageId: 'quick-netlify-build',
          artifactId: artifact.id,
          actionId,
          action: {
            type: 'build' as const,
            content: config.buildCommand,
          },
        };

        artifact.runner.addAction(actionData);
        await artifact.runner.runAction(actionData);

        if (!artifact.runner.buildOutput) {
          deployArtifact.runner.handleDeployAction('building', 'failed', {
            error: 'Build failed. Check the terminal for details.',
            source: 'netlify',
          });
          throw new Error('Build failed');
        }
      }

      // Prepare deployment
      deployArtifact.runner.handleDeployAction('deploying', 'running', { source: 'netlify' });

      const container = await webcontainer;

      // Determine the output directory
      let outputPath = config.outputDirectory || '/';

      if (artifact.runner.buildOutput && artifact.runner.buildOutput.path) {
        outputPath = artifact.runner.buildOutput.path.replace('/home/project', '');
      }

      // Collect files for deployment
      async function getAllFiles(dirPath: string): Promise<Record<string, string>> {
        const files: Record<string, string> = {};

        try {
          const entries = await container.fs.readdir(dirPath, { withFileTypes: true });

          for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);

            // Skip node_modules and other build artifacts
            if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.cache') {
              continue;
            }

            if (entry.isFile()) {
              try {
                const content = await container.fs.readFile(fullPath, 'utf-8');
                const deployPath = fullPath.replace(outputPath, '');
                files[deployPath] = content;
              } catch (e) {
                console.warn(`Could not read file ${fullPath}:`, e);
              }
            } else if (entry.isDirectory()) {
              const subFiles = await getAllFiles(fullPath);
              Object.assign(files, subFiles);
            }
          }
        } catch (e) {
          console.error(`Error reading directory ${dirPath}:`, e);
        }

        return files;
      }

      const fileContents = await getAllFiles(outputPath);

      // Create netlify.toml configuration
      const netlifyConfig = `
[build]
  publish = "${config.outputDirectory || '/'}"
  ${config.buildCommand ? `command = "${config.buildCommand}"` : ''}

[build.environment]
  NODE_VERSION = "${config.nodeVersion}"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"
    X-Content-Type-Options = "nosniff"
`;

      fileContents['/netlify.toml'] = netlifyConfig;

      // Deploy to Netlify using the quick deploy endpoint
      const response = await fetch('/api/netlify-quick-deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          files: fileContents,
          chatId: currentChatId,
          framework: config.framework,
        }),
      });

      const data = (await response.json()) as { success: boolean; url?: string; siteId?: string; error?: string };

      if (!response.ok || !data.success) {
        deployArtifact.runner.handleDeployAction('deploying', 'failed', {
          error: data.error || 'Deployment failed',
          source: 'netlify',
        });
        throw new Error(data.error || 'Deployment failed');
      }

      // Deployment successful
      setDeployUrl(data.url || null);

      deployArtifact.runner.handleDeployAction('complete', 'complete', {
        url: data.url || '',
        source: 'netlify',
      });

      toast.success('Deployment successful! Your app is live.');

      // Store deployment info
      if (data.siteId) {
        localStorage.setItem(`netlify-quick-site-${currentChatId}`, data.siteId);
      }

      return data.url || null;
    } catch (error) {
      console.error('Quick deploy error:', error);
      toast.error(error instanceof Error ? error.message : 'Deployment failed');

      return null;
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img className="w-5 h-5" src="https://cdn.simpleicons.org/netlify" alt="Netlify" />
          <h3 className="text-lg font-semibold text-bolt-elements-textPrimary">Quick Deploy to Netlify</h3>
        </div>
        {deployUrl && (
          <a
            href={deployUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-bolt-elements-link-text hover:text-bolt-elements-link-textHover underline"
          >
            View Live Site →
          </a>
        )}
      </div>

      <p className="text-sm text-bolt-elements-textSecondary">
        Deploy your project to Netlify instantly with automatic framework detection and configuration.
      </p>

      <button
        onClick={handleQuickDeploy}
        disabled={isDeploying}
        className="px-6 py-3 rounded-lg bg-accent-500 text-white font-medium hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
      >
        {isDeploying ? (
          <>
            <span className="i-ph:spinner-gap animate-spin w-5 h-5" />
            Deploying...
          </>
        ) : (
          <>
            <span className="i-ph:rocket-launch w-5 h-5" />
            Deploy Now
          </>
        )}
      </button>

      {deployUrl && (
        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
          <p className="text-sm text-green-600 dark:text-green-400">
            ✅ Your app is live at:{' '}
            <a href={deployUrl} target="_blank" rel="noopener noreferrer" className="underline font-medium">
              {deployUrl}
            </a>
          </p>
        </div>
      )}

      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors flex items-center gap-1"
      >
        <span className={`i-ph:caret-right transform transition-transform ${showAdvanced ? 'rotate-90' : ''}`} />
        Advanced Options
      </button>

      {showAdvanced && (
        <div className="p-3 rounded-lg bg-bolt-elements-background-depth-2 text-sm text-bolt-elements-textSecondary space-y-2">
          <p>• Automatic framework detection (React, Vue, Next.js, etc.)</p>
          <p>• Smart build command configuration</p>
          <p>• Optimized output directory selection</p>
          <p>• SSL/HTTPS enabled by default</p>
          <p>• Global CDN distribution</p>
        </div>
      )}
    </div>
  );
}
