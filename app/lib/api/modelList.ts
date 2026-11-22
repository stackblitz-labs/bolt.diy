import type { ModelInfo } from '~/lib/modules/llm/types';

const inFlightRequests = new Map<string, Promise<ModelInfo[]>>();

export function fetchModelsForProviders(providerNames: string[]): Promise<ModelInfo[]> {
  const activeProviderNames = [...providerNames].sort().join(',');
  const url = `/api/models?providers=${encodeURIComponent(activeProviderNames)}`;
  const existingRequest = inFlightRequests.get(url);

  if (existingRequest) {
    return existingRequest;
  }

  const request = fetch(url)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to fetch model list (${response.status})`);
      }

      const data = (await response.json()) as { modelList: ModelInfo[] };
      return data.modelList;
    })
    .finally(() => {
      inFlightRequests.delete(url);
    });

  inFlightRequests.set(url, request);
  return request;
}
