import Cookies from 'js-cookie';
import React, { useCallback, useEffect, useState } from 'react';
import { IconButton } from '~/components/ui/IconButton';
import type { ManagedIdentityOptions } from '~/lib/modules/llm/providers/openai-azure';
import type { ProviderInfo } from '~/types/model';

interface APIKeyManagerProps {
  provider: ProviderInfo;
  apiKey: string;
  setApiKey: (key: string) => void;
  getApiKeyLink?: string;
  labelForGetApiKey?: string;
  managedIdentityOptions: ManagedIdentityOptions;
  setManagedIdentityOptions: (managedIdentityOptions: ManagedIdentityOptions) => void;
}

// cache which stores whether the provider's API key is set via environment variable
const providerEnvKeyStatusCache: Record<string, boolean> = {};
const providerEnvManagedIdentityOptionsStatusCache: Record<string, boolean> = {};

const apiKeyMemoizeCache: { [k: string]: Record<string, string> } = {};

export function getApiKeysFromCookies() {
  const storedApiKeys = Cookies.get('apiKeys');
  let parsedKeys: Record<string, string> = {};

  if (storedApiKeys) {
    parsedKeys = apiKeyMemoizeCache[storedApiKeys];

    if (!parsedKeys) {
      parsedKeys = apiKeyMemoizeCache[storedApiKeys] = JSON.parse(storedApiKeys);
    }
  }

  return parsedKeys;
}

export function getManagedIdentityOptionsFromCookies() {
  const storedManagedIdentity = Cookies.get('managedIdentityOptions');
  let parsedManagedIdentity: ManagedIdentityOptions = { clientId: '', tenantId: '' };

  if (storedManagedIdentity) {
    parsedManagedIdentity = JSON.parse(storedManagedIdentity);
  }

  return parsedManagedIdentity;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const APIKeyManager: React.FC<APIKeyManagerProps> = ({
  provider,
  apiKey,
  setApiKey,
  managedIdentityOptions: managedIdentityOptions,
  setManagedIdentityOptions: setManagedIdentityOptions,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempKey, setTempKey] = useState(apiKey);
  const [tempManagedIdentityOptions, setTempManagedIdentityOptions] = useState(managedIdentityOptions);
  const [isEnvKeySet, setIsEnvKeySet] = useState(false);
  const [isEnvManagedIdentityOptionsSet, setIsEnvManagedIdentityOptionsSet] = useState(false);

  // Reset states and load saved key when provider changes
  useEffect(() => {
    // Load saved API key from cookies for this provider
    const savedKeys = getApiKeysFromCookies();
    const savedKey = savedKeys[provider.name] || '';
    const savedManagedIdentityOptions = getManagedIdentityOptionsFromCookies();

    setTempKey(savedKey);
    setApiKey(savedKey);
    setManagedIdentityOptions?.(savedManagedIdentityOptions);
    setTempManagedIdentityOptions(savedManagedIdentityOptions);
    setIsEditing(false);
  }, [provider.name]);

  const checkEnvApiKey = useCallback(async () => {
    // Check cache first
    if (providerEnvKeyStatusCache[provider.name] !== undefined) {
      setIsEnvKeySet(providerEnvKeyStatusCache[provider.name]);
      return;
    }

    try {
      const response = await fetch(`/api/check-env-key?provider=${encodeURIComponent(provider.name)}`);
      const data = await response.json();
      const isSet = (data as { isSet: boolean }).isSet;

      // Cache the result
      providerEnvKeyStatusCache[provider.name] = isSet;
      setIsEnvKeySet(isSet);
    } catch (error) {
      console.error('Failed to check environment API key:', error);
      setIsEnvKeySet(false);
    }
  }, [provider.name]);

  const checkEnvManagedIdentityOptions = useCallback(async () => {
    // Check cache first
    if (providerEnvManagedIdentityOptionsStatusCache[provider.name] !== undefined) {
      setIsEnvManagedIdentityOptionsSet(providerEnvManagedIdentityOptionsStatusCache[provider.name]);
      return;
    }

    try {
      const response = await fetch(`/api/check-env-managed-identity?provider=${encodeURIComponent(provider.name)}`);
      const data = await response.json();
      const isSet = (data as { isSet: boolean }).isSet;

      // Cache the result
      providerEnvManagedIdentityOptionsStatusCache[provider.name] = isSet;
      setIsEnvManagedIdentityOptionsSet(isSet);
    } catch (error) {
      console.error('Failed to check environment Managed Identity Options:', error);
      setIsEnvManagedIdentityOptionsSet(false);
    }
  }, [provider.name]);

  useEffect(() => {
    checkEnvApiKey();
  }, [checkEnvApiKey]);

  useEffect(() => {
    checkEnvManagedIdentityOptions();
  }, [checkEnvManagedIdentityOptions]);

  const handleSave = () => {
    // Save to parent state
    setApiKey(tempKey);

    // Save to cookies
    const currentKeys = getApiKeysFromCookies();
    const newKeys = { ...currentKeys, [provider.name]: tempKey };
    Cookies.set('apiKeys', JSON.stringify(newKeys));

    setIsEditing(false);
  };

  const handleManagedIdentityOptionsSave = () => {
    // Save to parent state
    setManagedIdentityOptions(tempManagedIdentityOptions);

    // Save to cookies
    Cookies.set('managedIdentityOptions', JSON.stringify(tempManagedIdentityOptions));

    setIsEditing(false);
  };

  return (
    <div className="flex flex-wrap items-center justify-between py-3 px-1">
      <div className="flex items-center gap-2 flex-1">
        <div className="flex items-center gap-2">
          {provider.supportsManagedIdentity ? (
            <>
              <span className="text-sm font-medium text-bolt-elements-textSecondary">
                {provider?.name} Managed Identity:
              </span>
              {!isEditing && (
                <div className="flex items-center gap-2">
                  {managedIdentityOptions ? (
                    <>
                      <div className="i-ph:check-circle-fill text-green-500 w-4 h-4" />
                      <span className="text-xs text-green-500">Set via UI</span>
                    </>
                  ) : isEnvManagedIdentityOptionsSet ? (
                    <>
                      <div className="i-ph:check-circle-fill text-green-500 w-4 h-4" />
                      <span className="text-xs text-green-500">Set via environment variable</span>
                    </>
                  ) : (
                    <>
                      <div className="i-ph:x-circle-fill text-red-500 w-4 h-4" />
                      <span className="text-xs text-red-500">Not Set (Please set via UI or ENV_VAR)</span>
                    </>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <span className="text-sm font-medium text-bolt-elements-textSecondary">{provider?.name} API Key:</span>
              {!isEditing && (
                <div className="flex items-center gap-2">
                  {apiKey ? (
                    <>
                      <div className="i-ph:check-circle-fill text-green-500 w-4 h-4" />
                      <span className="text-xs text-green-500">Set via UI</span>
                    </>
                  ) : isEnvKeySet ? (
                    <>
                      <div className="i-ph:check-circle-fill text-green-500 w-4 h-4" />
                      <span className="text-xs text-green-500">Set via environment variable</span>
                    </>
                  ) : (
                    <>
                      <div className="i-ph:x-circle-fill text-red-500 w-4 h-4" />
                      <span className="text-xs text-red-500">Not Set (Please set via UI or ENV_VAR)</span>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {provider.supportsManagedIdentity ? (
        <>
          <div className="flex flex-wrap items-center gap-2 shrink-1">
            {isEditing ? (
              <>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={tempManagedIdentityOptions.clientId}
                    placeholder="Enter Client Id"
                    onChange={(e) =>
                      setManagedIdentityOptions({
                        ...tempManagedIdentityOptions,
                        clientId: e.target.value,
                      })
                    }
                    className="w-[300px] px-3 py-1.5 text-sm rounded border border-bolt-elements-borderColor 
                        bg-bolt-elements-prompt-background text-bolt-elements-textPrimary 
                        focus:outline-none focus:ring-2 focus:ring-bolt-elements-focus"
                  />
                  <IconButton
                    onClick={handleManagedIdentityOptionsSave}
                    title="Save Managed Identity Options"
                    className="bg-green-500/10 hover:bg-green-500/20 text-green-500"
                  >
                    <div className="i-ph:check w-4 h-4" />
                  </IconButton>
                  <IconButton
                    onClick={() => setIsEditing(false)}
                    title="Cancel"
                    className="bg-red-500/10 hover:bg-red-500/20 text-red-500"
                  >
                    <div className="i-ph:x w-4 h-4" />
                  </IconButton>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={tempManagedIdentityOptions.tenantId}
                    placeholder="Enter Tenant Id"
                    onChange={(e) =>
                      setManagedIdentityOptions({
                        ...tempManagedIdentityOptions,
                        tenantId: e.target.value,
                      })
                    }
                    className="w-[300px] px-3 py-1.5 text-sm rounded border border-bolt-elements-borderColor 
                        bg-bolt-elements-prompt-background text-bolt-elements-textPrimary 
                        focus:outline-none focus:ring-2 focus:ring-bolt-elements-focus"
                  />
                </div>
              </>
            ) : (
              <>
                {
                  <IconButton
                    onClick={() => setIsEditing(true)}
                    title="Edit API Key"
                    className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-500"
                  >
                    <div className="i-ph:pencil-simple w-4 h-4" />
                  </IconButton>
                }
                {!provider.supportsManagedIdentity && provider?.getApiKeyLink && !apiKey && (
                  <IconButton
                    onClick={() => window.open(provider?.getApiKeyLink)}
                    title="Get API Key"
                    className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-500 flex items-center gap-2"
                  >
                    <span className="text-xs whitespace-nowrap">{provider?.labelForGetApiKey || 'Get API Key'}</span>
                    <div className={`${provider?.icon || 'i-ph:key'} w-4 h-4`} />
                  </IconButton>
                )}
              </>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2 shrink-0">
            {isEditing ? (
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  value={tempKey}
                  placeholder="Enter API Key"
                  onChange={(e) => setTempKey(e.target.value)}
                  className="w-[300px] px-3 py-1.5 text-sm rounded border border-bolt-elements-borderColor 
                        bg-bolt-elements-prompt-background text-bolt-elements-textPrimary 
                        focus:outline-none focus:ring-2 focus:ring-bolt-elements-focus"
                />
                <IconButton
                  onClick={handleSave}
                  title="Save API Key"
                  className="bg-green-500/10 hover:bg-green-500/20 text-green-500"
                >
                  <div className="i-ph:check w-4 h-4" />
                </IconButton>
                <IconButton
                  onClick={() => setIsEditing(false)}
                  title="Cancel"
                  className="bg-red-500/10 hover:bg-red-500/20 text-red-500"
                >
                  <div className="i-ph:x w-4 h-4" />
                </IconButton>
              </div>
            ) : (
              <>
                {
                  <IconButton
                    onClick={() => setIsEditing(true)}
                    title="Edit API Key"
                    className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-500"
                  >
                    <div className="i-ph:pencil-simple w-4 h-4" />
                  </IconButton>
                }
                {provider?.getApiKeyLink && !apiKey && (
                  <IconButton
                    onClick={() => window.open(provider?.getApiKeyLink)}
                    title="Get API Key"
                    className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-500 flex items-center gap-2"
                  >
                    <span className="text-xs whitespace-nowrap">{provider?.labelForGetApiKey || 'Get API Key'}</span>
                    <div className={`${provider?.icon || 'i-ph:key'} w-4 h-4`} />
                  </IconButton>
                )}
              </>
            )}
          </div>
        </>
      )}
      ;
    </div>
  );
};
