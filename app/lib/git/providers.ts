import type { GitProvider, ProviderKey } from './types';

export const gitProviders: Record<ProviderKey, GitProvider> = {
  github: {
    url: 'github.com',
    title: 'GitHub',
    instructions: 'Enter your GitHub username and personal access token.',
    tokenSetupSteps: [
      '1. Go to GitHub.com → Settings → Developer settings → Personal access tokens → Tokens (classic)',
      '2. Generate new token (classic) with these scopes:',
      '   • repo (Full control of private repositories)',
      '   • workflow (Optional: Update GitHub Action workflows)',
      '3. Copy the generated token and paste it here',
    ],
  },
  gitlab: {
    url: 'gitlab.com',
    title: 'GitLab',
    instructions: 'To set up GitLab access:',
    tokenSetupSteps: [
      '1. Go to GitLab.com → Profile Settings → Access Tokens',
      '2. Create a new token with these scopes:',
      '   • api (Full API access)',
      '   • write_repository (Read/write access)',
      '3. Copy the generated token and paste it here',
    ],
  },
};
