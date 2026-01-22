import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useStore } from '@nanostores/react';
import { netlifyConnection } from '~/lib/stores/netlify';
import { vercelConnection } from '~/lib/stores/vercel';
import { isGitLabConnected } from '~/lib/stores/gitlabConnection';
import { workbenchStore } from '~/lib/stores/workbench';
import { streamingState } from '~/lib/stores/streaming';
import { classNames } from '~/utils/classNames';
import { useState } from 'react';
import { NetlifyDeploymentLink } from '~/components/chat/NetlifyDeploymentLink.client';
import { VercelDeploymentLink } from '~/components/chat/VercelDeploymentLink.client';
import { useVercelDeploy } from '~/components/deploy/VercelDeploy.client';
import { useNetlifyDeploy } from '~/components/deploy/NetlifyDeploy.client';
import { useGitHubDeploy } from '~/components/deploy/GitHubDeploy.client';
import { useGitLabDeploy } from '~/components/deploy/GitLabDeploy.client';
import { GitHubDeploymentDialog } from '~/components/deploy/GitHubDeploymentDialog';
import { GitLabDeploymentDialog } from '~/components/deploy/GitLabDeploymentDialog';

interface DeployButtonProps {
  onVercelDeploy?: () => Promise<void>;
  onNetlifyDeploy?: () => Promise<void>;
  onGitHubDeploy?: () => Promise<void>;
  onGitLabDeploy?: () => Promise<void>;
}

export const DeployButton = ({
  onVercelDeploy,
  onNetlifyDeploy,
  onGitHubDeploy,
  onGitLabDeploy,
}: DeployButtonProps) => {
  const netlifyConn = useStore(netlifyConnection);
  const vercelConn = useStore(vercelConnection);
  const gitlabIsConnected = useStore(isGitLabConnected);
  const [activePreviewIndex] = useState(0);
  const previews = useStore(workbenchStore.previews);
  const activePreview = previews[activePreviewIndex];
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployingTo, setDeployingTo] = useState<'netlify' | 'vercel' | 'github' | 'gitlab' | null>(null);
  const isStreaming = useStore(streamingState);
  const { handleVercelDeploy } = useVercelDeploy();
  const { handleNetlifyDeploy } = useNetlifyDeploy();
  const { handleGitHubDeploy } = useGitHubDeploy();
  const { handleGitLabDeploy } = useGitLabDeploy();
  const [showGitHubDeploymentDialog, setShowGitHubDeploymentDialog] = useState(false);
  const [showGitLabDeploymentDialog, setShowGitLabDeploymentDialog] = useState(false);
  const [githubDeploymentFiles, setGithubDeploymentFiles] = useState<Record<string, string> | null>(null);
  const [gitlabDeploymentFiles, setGitlabDeploymentFiles] = useState<Record<string, string> | null>(null);
  const [githubProjectName, setGithubProjectName] = useState('');
  const [gitlabProjectName, setGitlabProjectName] = useState('');

  const handleVercelDeployClick = async () => {
    setIsDeploying(true);
    setDeployingTo('vercel');

    try {
      if (onVercelDeploy) {
        await onVercelDeploy();
      } else {
        await handleVercelDeploy();
      }
    } finally {
      setIsDeploying(false);
      setDeployingTo(null);
    }
  };

  const handleNetlifyDeployClick = async () => {
    setIsDeploying(true);
    setDeployingTo('netlify');

    try {
      if (onNetlifyDeploy) {
        await onNetlifyDeploy();
      } else {
        await handleNetlifyDeploy();
      }
    } finally {
      setIsDeploying(false);
      setDeployingTo(null);
    }
  };

  const handleGitHubDeployClick = async () => {
    setIsDeploying(true);
    setDeployingTo('github');

    try {
      if (onGitHubDeploy) {
        await onGitHubDeploy();
      } else {
        const result = await handleGitHubDeploy();

        if (result && result.success && result.files) {
          setGithubDeploymentFiles(result.files);
          setGithubProjectName(result.projectName);
          setShowGitHubDeploymentDialog(true);
        }
      }
    } finally {
      setIsDeploying(false);
      setDeployingTo(null);
    }
  };

  const handleGitLabDeployClick = async () => {
    setIsDeploying(true);
    setDeployingTo('gitlab');

    try {
      if (onGitLabDeploy) {
        await onGitLabDeploy();
      } else {
        const result = await handleGitLabDeploy();

        if (result && result.success && result.files) {
          setGitlabDeploymentFiles(result.files);
          setGitlabProjectName(result.projectName);
          setShowGitLabDeploymentDialog(true);
        }
      }
    } finally {
      setIsDeploying(false);
      setDeployingTo(null);
    }
  };

  return (
    <>
      <div className="flex border border-bolt-elements-borderColor rounded-md overflow-hidden text-sm">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger
            disabled={isDeploying || !activePreview || isStreaming}
            className="rounded-md items-center justify-center [&:is(:disabled,.disabled)]:cursor-not-allowed [&:is(:disabled,.disabled)]:opacity-60 px-3 py-1.5 text-xs bg-accent-500 text-white hover:text-bolt-elements-item-contentAccent [&:not(:disabled,.disabled)]:hover:bg-bolt-elements-button-primary-backgroundHover outline-accent-500 flex gap-1.7"
          >
            {isDeploying ? `Deploying to ${deployingTo}...` : 'Deploy'}
            <span className={classNames('i-ph:caret-down transition-transform')} />
          </DropdownMenu.Trigger>
          <DropdownMenu.Content
            className={classNames(
              'z-[250]',
              'bg-bolt-elements-background-depth-2',
              'rounded-lg shadow-lg',
              'border border-bolt-elements-borderColor',
              'animate-in fade-in-0 zoom-in-95',
              'py-1',
            )}
            sideOffset={5}
            align="end"
          >
            <DropdownMenu.Item
              className={classNames(
                'cursor-pointer flex items-center w-full px-4 py-2 text-sm text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive gap-2 rounded-md group relative',
                {
                  'opacity-60 cursor-not-allowed': isDeploying || !activePreview || !netlifyConn.user,
                },
              )}
              disabled={isDeploying || !activePreview || !netlifyConn.user}
              onClick={handleNetlifyDeployClick}
            >
              <img
                className="w-5 h-5"
                height="24"
                width="24"
                crossOrigin="anonymous"
                src="https://cdn.simpleicons.org/netlify"
              />
              <span className="mx-auto">
                {!netlifyConn.user ? 'No Netlify Account Connected' : 'Deploy to Netlify'}
              </span>
              {netlifyConn.user && <NetlifyDeploymentLink />}
            </DropdownMenu.Item>

            <DropdownMenu.Item
              className={classNames(
                'cursor-pointer flex items-center w-full px-4 py-2 text-sm text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive gap-2 rounded-md group relative',
                {
                  'opacity-60 cursor-not-allowed': isDeploying || !activePreview || !vercelConn.user,
                },
              )}
              disabled={isDeploying || !activePreview || !vercelConn.user}
              onClick={handleVercelDeployClick}
            >
              <img
                className="w-5 h-5 bg-black p-1 rounded"
                height="24"
                width="24"
                crossOrigin="anonymous"
                src="https://cdn.simpleicons.org/vercel/white"
                alt="vercel"
              />
              <span className="mx-auto">{!vercelConn.user ? 'No Vercel Account Connected' : 'Deploy to Vercel'}</span>
              {vercelConn.user && <VercelDeploymentLink />}
            </DropdownMenu.Item>

            <DropdownMenu.Item
              className={classNames(
                'cursor-pointer flex items-center w-full px-4 py-2 text-sm text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive gap-2 rounded-md group relative',
                {
                  'opacity-60 cursor-not-allowed': isDeploying || !activePreview,
                },
              )}
              disabled={isDeploying || !activePreview}
              onClick={handleGitHubDeployClick}
            >
              <img
                className="w-5 h-5"
                height="24"
                width="24"
                crossOrigin="anonymous"
                src="https://cdn.simpleicons.org/github"
                alt="github"
              />
              <span className="mx-auto">Deploy to GitHub</span>
            </DropdownMenu.Item>

            <DropdownMenu.Item
              className={classNames(
                'cursor-pointer flex items-center w-full px-4 py-2 text-sm text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive gap-2 rounded-md group relative',
                {
                  'opacity-60 cursor-not-allowed': isDeploying || !activePreview || !gitlabIsConnected,
                },
              )}
              disabled={isDeploying || !activePreview || !gitlabIsConnected}
              onClick={handleGitLabDeployClick}
            >
              <img
                className="w-5 h-5"
                height="24"
                width="24"
                crossOrigin="anonymous"
                src="https://cdn.simpleicons.org/gitlab"
                alt="gitlab"
              />
              <span className="mx-auto">{!gitlabIsConnected ? 'No GitLab Account Connected' : 'Deploy to GitLab'}</span>
            </DropdownMenu.Item>

            <DropdownMenu.Item
              disabled
              className="flex items-center w-full rounded-md px-4 py-2 text-sm text-bolt-elements-textTertiary gap-2 opacity-60 cursor-not-allowed"
            >
              <img
                className="w-5 h-5"
                height="24"
                width="24"
                crossOrigin="anonymous"
                src="https://cdn.simpleicons.org/cloudflare"
                alt="cloudflare"
              />
              <span className="mx-auto">Deploy to Cloudflare (Coming Soon)</span>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </div>

      {/* GitHub Deployment Dialog */}
      {showGitHubDeploymentDialog && githubDeploymentFiles && (
        <GitHubDeploymentDialog
          isOpen={showGitHubDeploymentDialog}
          onClose={() => setShowGitHubDeploymentDialog(false)}
          projectName={githubProjectName}
          files={githubDeploymentFiles}
        />
      )}

      {/* GitLab Deployment Dialog */}
      {showGitLabDeploymentDialog && gitlabDeploymentFiles && (
        <GitLabDeploymentDialog
          isOpen={showGitLabDeploymentDialog}
          onClose={() => setShowGitLabDeploymentDialog(false)}
          projectName={gitlabProjectName}
          files={gitlabDeploymentFiles}
        />
      )}
    </>
  );
};
