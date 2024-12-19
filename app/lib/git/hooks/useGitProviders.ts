import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { lookupSavedPassword, saveGitAuth, ensureEncryption, removeGitAuth } from '~/lib/auth';
import { gitProviders } from '~/lib/git';
import type { ProviderState, ProviderCredentials, GitHubUser, GitLabUser, ProviderKey } from '~/lib/git';

const initialCredentials: ProviderState = {
  github: { username: '', token: '', isConnected: false, isVerifying: false },
  gitlab: { username: '', token: '', isConnected: false, isVerifying: false },
};

const createGitHubHeaders = (token: string): HeadersInit => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
  Accept: 'application/json',
});

const createGitLabHeaders = (token: string): HeadersInit => ({
  'PRIVATE-TOKEN': token,
  'Content-Type': 'application/json',
  Accept: 'application/json',
});

export function useGitProviders() {
  const [credentials, setCredentials] = useState<ProviderState>(initialCredentials);
  const [expandedProviders, setExpandedProviders] = useState<Record<ProviderKey, boolean>>({
    github: false,
    gitlab: false,
  });

  useEffect(() => {
    initializeEncryption();
  }, []);

  const initializeEncryption = async () => {
    const success = await ensureEncryption();

    if (success) {
      loadSavedCredentials();
    }
  };

  const loadSavedCredentials = async () => {
    for (const [key, provider] of Object.entries(gitProviders)) {
      const auth = await lookupSavedPassword(provider.url);

      if (auth?.username && auth?.password) {
        setCredentials((prev) => ({
          ...prev,
          [key]: {
            ...prev[key as ProviderKey],
            username: auth.username || '',
            token: auth.password || '',
            isConnected: true,
          },
        }));
      }
    }
  };

  const verifyCredentials = async (providerKey: ProviderKey, username: string, token: string) => {
    const provider = gitProviders[providerKey];
    setCredentials((prev) => ({
      ...prev,
      [providerKey]: { ...prev[providerKey], isVerifying: true },
    }));

    try {
      const apiUrl = providerKey === 'github' ? 'https://api.github.com/user' : 'https://gitlab.com/api/v4/user';
      const headers = providerKey === 'github' ? createGitHubHeaders(token) : createGitLabHeaders(token);

      const response = await fetch(apiUrl, { headers });
      const data = await response.json();

      const isValid =
        response.ok &&
        ((providerKey === 'github' && (data as GitHubUser).login === username) ||
          (providerKey === 'gitlab' && (data as GitLabUser).username === username));

      setCredentials((prev) => ({
        ...prev,
        [providerKey]: {
          ...prev[providerKey],
          isConnected: !!isValid,
          isVerifying: false,
        },
      }));

      if (!isValid && response.ok) {
        toast.error(`The ${provider.title} token is valid but belongs to a different user.`);
      }

      return isValid;
    } catch (error) {
      console.error(`Error verifying ${provider.title} credentials:`, error);
      setCredentials((prev) => ({
        ...prev,
        [providerKey]: {
          ...prev[providerKey],
          isConnected: false,
          isVerifying: false,
        },
      }));

      return false;
    }
  };

  const handleSaveConnection = async (providerKey: ProviderKey) => {
    const provider = gitProviders[providerKey];
    const { username, token } = credentials[providerKey];

    if (!username || !token) {
      toast.error(`Please provide both ${provider.title} username and token`);
      return;
    }

    const isValid = await verifyCredentials(providerKey, username, token);

    if (isValid) {
      await saveGitAuth(provider.url, { username, password: token });
    } else {
      toast.error(`Invalid ${provider.title} credentials. Please check your username and token.`);
    }
  };

  const handleDisconnect = async (providerKey: ProviderKey) => {
    const provider = gitProviders[providerKey];
    await removeGitAuth(provider.url);
    setCredentials((prev) => ({
      ...prev,
      [providerKey]: {
        ...prev[providerKey],
        username: '',
        token: '',
        isConnected: false,
      },
    }));
  };

  const updateProviderCredentials = (providerKey: ProviderKey, updates: Partial<ProviderCredentials>) => {
    setCredentials((prev) => ({
      ...prev,
      [providerKey]: { ...prev[providerKey], ...updates },
    }));
  };

  const toggleProvider = (provider: ProviderKey) => {
    setExpandedProviders((prev) => ({
      ...prev,
      [provider]: !prev[provider],
    }));
  };

  return {
    providers: gitProviders,
    credentials,
    expandedProviders,
    handleSaveConnection,
    handleDisconnect,
    updateProviderCredentials,
    toggleProvider,
  };
}
