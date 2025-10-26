import { useCallback, useState } from 'react';
import type { IProviderConfig } from '~/types/model';

export interface UseLocalProvidersReturn {
  localProviders: IProviderConfig[];
  refreshLocalProviders: () => void;
}

export function useLocalProviders(): UseLocalProvidersReturn {
  const [localProviders, setLocalProviders] = useState<IProviderConfig[]>([]);

  const refreshLocalProviders = useCallback(() => {
    /*
     * Refresh logic for local providers
     * This would typically involve checking the status of Ollama and LMStudio
     * For now, we'll just return an empty array
     */
    setLocalProviders([]);
  }, []);

  return {
    localProviders,
    refreshLocalProviders,
  };
}
