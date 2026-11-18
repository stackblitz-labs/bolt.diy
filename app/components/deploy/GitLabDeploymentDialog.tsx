import React from 'react';
import { gitlabDeploymentService } from './services/gitlabDeploymentService';
import { DeploymentDialog } from './shared/DeploymentDialog';
import type { DeploymentDialogProps } from './shared/types';
import { useDeployment } from './shared/useDeployment';

const GitLabIcon = () => (
  <svg viewBox="0 0 40 40" className="w-6 h-6">
    <path
      fill="currentColor"
      d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z"
    />
  </svg>
);

export function GitLabDeploymentDialog({ isOpen, onClose, projectName, files }: DeploymentDialogProps) {
  const deployment = useDeployment(gitlabDeploymentService, isOpen, projectName);

  const handleDeploy = async () => {
    await deployment.handleDeploy(files);
  };

  return (
    <DeploymentDialog
      isOpen={isOpen}
      onClose={onClose}
      serviceName="GitLab"
      serviceIcon={<GitLabIcon />}
      state={deployment.state}
      user={deployment.user}
      repositories={deployment.recentRepos}
      isConnected={deployment.isConnected}
      onStateChange={deployment.updateState}
      onDeploy={handleDeploy}
      onShowAuth={() => deployment.updateState({ showAuthDialog: true })}
      AuthDialogComponent={gitlabDeploymentService.getAuthDialogComponent()}
    />
  );
}
