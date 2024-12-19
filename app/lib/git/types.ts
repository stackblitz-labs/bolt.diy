export interface GitProvider {
  title: string;
  url: string;
  instructions: string;
  tokenSetupSteps: string[];
}

export interface ProviderCredentials {
  username: string;
  token: string;
  isConnected: boolean;
  isVerifying: boolean;
}

export type ProviderKey = 'github' | 'gitlab';

export type ProviderState = {
  [K in ProviderKey]: ProviderCredentials;
};

export interface GitHubUser {
  login: string;
}

export interface GitLabUser {
  username: string;
}
