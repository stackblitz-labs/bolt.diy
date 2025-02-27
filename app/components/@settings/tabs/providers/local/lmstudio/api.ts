import type { ModelInfo, ApiClient } from '~/components/@settings/tabs/providers/local/common/types';

// Define LM Studio API response types
interface LMStudioError {
  error?: {
    message: string;
    type: string;
    code: string;
  };
}

interface LMStudioModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
  root?: string;
  parent?: string | null;
  permission?: any[];
}

interface LMStudioResponse {
  object: string;
  data: LMStudioModel[];
}

/**
 * Default timeout for API requests in milliseconds
 */
const DEFAULT_TIMEOUT = 5000; // 5 seconds

/**
 * LM Studio API client for local model inference
 */
export class LMStudioApiClient implements ApiClient {
  private _baseUrl: string;
  private _apiKey: string | undefined;

  constructor(baseUrl: string, apiKey?: string) {
    this._baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    this._apiKey = apiKey;
  }

  /**
   * Helper method for making API requests
   */
  private async _fetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this._baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.signal ? undefined : DEFAULT_TIMEOUT);

    try {
      console.log(`Making request to LM Studio: ${url}`);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (this._apiKey) {
        headers.Authorization = `Bearer ${this._apiKey}`;
      }

      try {
        // Try direct connection first
        const response = await fetch(url, {
          ...options,
          headers: {
            ...headers,
            ...options.headers,
          },
          signal: options.signal || controller.signal,
        });

        // Handle non-JSON responses
        const contentType = response.headers.get('content-type');

        if (!contentType || !contentType.includes('application/json')) {
          console.error(`LM Studio returned non-JSON response: ${contentType}`);
          throw new Error(`Server returned non-JSON response: ${contentType}`);
        }

        const responseData: T = await response.json();
        console.log(`LM Studio response for ${endpoint}:`, responseData);

        // Check for API-specific error format
        if (!response.ok) {
          const error = responseData as LMStudioError;

          if (error.error?.message) {
            throw new Error(error.error.message);
          }

          throw new Error(`HTTP error! status: ${response.status}`);
        }

        return responseData;
      } catch (directError) {
        console.error('Direct fetch to LM Studio failed:', directError);

        // If direct connection fails, try using our proxy endpoint
        console.log('Trying proxy endpoint for LM Studio connection');

        const proxyUrl = `/api/proxy/lm-studio?url=${encodeURIComponent(url)}`;

        const proxyResponse = await fetch(proxyUrl, {
          method: options.method || 'GET',
          headers: {
            ...headers,
            ...options.headers,
          },
          ...(options.body ? { body: options.body } : {}),
        });

        if (!proxyResponse.ok) {
          throw new Error(`Proxy HTTP error! status: ${proxyResponse.status}`);
        }

        const proxyData: T = await proxyResponse.json();
        console.log(`LM Studio proxy response for ${endpoint}:`, proxyData);

        return proxyData;
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Request to LM Studio timed out. Make sure the server is running and accessible.');
        }

        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          throw new Error(
            `Cannot connect to LM Studio at ${this._baseUrl}. Make sure the server is running and the URL is correct.`,
          );
        }

        throw error;
      }

      throw new Error('An unknown error occurred while connecting to LM Studio');
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Check if the LM Studio server is running
   */
  async isServerRunning(): Promise<boolean> {
    try {
      console.log('Checking LM Studio server status at:', this._baseUrl);

      // Check if we're likely dealing with a cross-origin situation
      const isCrossOrigin = this._isCrossOriginRequest();

      // If we're likely dealing with cross-origin, prioritize the proxy to avoid unnecessary CORS errors
      if (isCrossOrigin) {
        console.log('Cross-origin detected, prioritizing proxy for LM Studio server check');

        try {
          return await this.isServerRunningViaProxy();
        } catch (proxyError) {
          console.error('Proxy check for LM Studio server failed, trying direct as fallback:', proxyError);

          // Fall through to direct check as a fallback
        }
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

      try {
        const response = await fetch(`${this._baseUrl}/v1/models`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(this._apiKey && { Authorization: `Bearer ${this._apiKey}` }),
          },
          signal: controller.signal,
        });

        return response.ok;
      } catch (error) {
        console.error('Error checking LM Studio server:', error);

        // Try via proxy if direct check fails
        try {
          console.log('Trying proxy endpoint for LM Studio server check');
          return await this.isServerRunningViaProxy();
        } catch (proxyError) {
          console.error('Proxy check for LM Studio server also failed:', proxyError);
          return false;
        }
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      console.error('Error checking LM Studio server:', error);
      return false;
    }
  }

  /**
   * Check if the LM Studio server is running directly via the proxy
   */
  async isServerRunningViaProxy(): Promise<boolean> {
    try {
      console.log('Checking LM Studio server status via proxy at:', this._baseUrl);

      // Fix the URL path to match the actual endpoint name (lm-studio vs lmstudio)
      const proxyUrl = `/api/proxy/lmstudio?url=${encodeURIComponent(`${this._baseUrl}/v1/models`)}`;

      const proxyResponse = await fetch(proxyUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(this._apiKey && { Authorization: `Bearer ${this._apiKey}` }),
        },
      });

      if (proxyResponse.ok) {
        const data: LMStudioResponse | { object: string; data: any[] } = await proxyResponse.json();
        console.log('LM Studio proxy server response:', data);

        return data.object === 'list' && Array.isArray(data.data);
      } else {
        console.error('LM Studio proxy returned non-OK status:', proxyResponse.status);
        return false;
      }
    } catch (error) {
      console.error('Error checking LM Studio server via proxy:', error);
      return false;
    }
  }

  /**
   * Get list of available models
   */
  async getModels(): Promise<ModelInfo[]> {
    try {
      console.log('Fetching LM Studio models from:', this._baseUrl);

      // Check if we're likely dealing with a cross-origin situation
      const isCrossOrigin = this._isCrossOriginRequest();

      // If we're likely dealing with cross-origin, prioritize the proxy to avoid unnecessary CORS errors
      if (isCrossOrigin) {
        console.log('Cross-origin detected, prioritizing proxy for LM Studio models');

        try {
          return await this.getModelsViaProxy();
        } catch (proxyError) {
          console.error('Proxy fetch for LM Studio models failed, trying direct as fallback:', proxyError);

          // Fall through to direct fetch as a fallback
        }
      }

      // Use direct fetch first, then fallback to proxy
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

      try {
        // Try direct connection
        const rawResponse = await fetch(`${this._baseUrl}/v1/models`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(this._apiKey && { Authorization: `Bearer ${this._apiKey}` }),
          },
          signal: controller.signal,
        });

        if (rawResponse.ok) {
          const data: LMStudioResponse = await rawResponse.json();
          console.log('LM Studio models response:', data);

          if (!data.data || !Array.isArray(data.data)) {
            console.error('Invalid response format from LM Studio:', data);
            return [];
          }

          return data.data.map((model: LMStudioModel) => ({
            name: model.id,
            desc: model.owned_by ? `Provided by ${model.owned_by}` : 'Local model hosted by LM Studio',
            installed: true,
          })) as ModelInfo[];
        } else {
          console.error('LM Studio returned non-OK status when fetching models:', rawResponse.status);
          return [];
        }
      } catch (fetchError) {
        console.error('Direct fetch for LM Studio models failed:', fetchError);

        // If direct connection fails, try using our proxy endpoint
        try {
          console.log('Trying proxy endpoint for LM Studio models');
          return await this.getModelsViaProxy();
        } catch (proxyError) {
          console.error('Proxy fetch for LM Studio models also failed:', proxyError);
          return [];
        }
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      console.error('Error getting LM Studio models:', error);
      return [];
    }
  }

  /**
   * Helper method to determine if we're likely dealing with a cross-origin request
   * This is a heuristic and not 100% accurate, but helps optimize the request flow
   */
  private _isCrossOriginRequest(): boolean {
    try {
      // Get the current origin
      const currentOrigin = window.location.origin;

      // Parse the base URL to get its origin
      const baseUrlObj = new URL(this._baseUrl);
      const baseOrigin = baseUrlObj.origin;

      // Compare origins
      const isCrossOrigin = currentOrigin !== baseOrigin;
      console.log(`Cross-origin check: current=${currentOrigin}, base=${baseOrigin}, result=${isCrossOrigin}`);

      return isCrossOrigin;
    } catch (error) {
      console.error('Error checking cross-origin:', error);

      // If we can't determine, assume it might be cross-origin to be safe
      return true;
    }
  }

  /**
   * Get models directly through the proxy
   * This is a fallback method when the regular getModels fails
   */
  async getModelsViaProxy(): Promise<ModelInfo[]> {
    try {
      console.log('Fetching LM Studio models via proxy from:', this._baseUrl);

      // Fix the URL path to match the actual endpoint name (lm-studio vs lmstudio)
      const proxyUrl = `/api/proxy/lmstudio?url=${encodeURIComponent(`${this._baseUrl}/v1/models`)}`;
      console.log('Proxy URL:', proxyUrl);

      const proxyResponse = await fetch(proxyUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(this._apiKey && { Authorization: `Bearer ${this._apiKey}` }),
        },
      });

      console.log('Proxy response status:', proxyResponse.status);

      if (proxyResponse.ok) {
        const data = (await proxyResponse.json()) as LMStudioResponse;
        console.log('LM Studio proxy models response:', data);

        // Check if the response has the expected structure
        if (data && typeof data === 'object' && 'data' in data && Array.isArray(data.data)) {
          console.log('Valid response format from LM Studio proxy, model count:', data.data.length);

          const mappedModels: ModelInfo[] = data.data.map((model: LMStudioModel) => ({
            name: model.id,
            desc: model.owned_by ? `Provided by ${model.owned_by}` : 'Local model hosted by LM Studio',
            installed: true,
          }));

          console.log('Mapped models from proxy response:', mappedModels);

          return mappedModels;
        } else {
          console.error('Invalid response format from LM Studio proxy:', data);
          return [];
        }
      } else {
        console.error('Error response from proxy:', proxyResponse.status, proxyResponse.statusText);
        return [];
      }
    } catch (error) {
      console.error('Error getting LM Studio models via proxy:', error);
      return [];
    }
  }

  /**
   * Check if a specific model exists
   */
  async modelExists(modelId: string): Promise<boolean> {
    try {
      console.log(`Checking if model ${modelId} exists in LM Studio`);

      // Try to get all models
      const models = await this.getModels();

      // Check if the model exists in the list
      const exists = models.some((model) => model.name === modelId);
      console.log(`Model ${modelId} exists in LM Studio: ${exists}`);

      return exists;
    } catch (error) {
      console.error(`Error checking if model ${modelId} exists:`, error);

      // Try via proxy if direct method fails
      try {
        const proxyModels = await this.getModelsViaProxy();
        const exists = proxyModels.some((model) => model.name === modelId);
        console.log(`Model ${modelId} exists in LM Studio (via proxy): ${exists}`);

        return exists;
      } catch (proxyError) {
        console.error(`Error checking if model ${modelId} exists via proxy:`, proxyError);
        return false;
      }
    }
  }

  /**
   * Generate completions
   */
  async generateCompletion(prompt: string, options: any = {}): Promise<any> {
    try {
      console.log('Generating completion with LM Studio');

      const data = await this._fetch<any>('/v1/completions', {
        method: 'POST',
        headers: this._getHeaders(),
        body: JSON.stringify({
          prompt,
          ...options,
        }),
      });

      return data;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to generate completion: ${error.message}`);
      }

      throw new Error('Failed to generate completion: Unknown error');
    }
  }

  /**
   * Get headers for API requests
   */
  private _getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this._apiKey) {
      headers.Authorization = `Bearer ${this._apiKey}`;
    }

    return headers;
  }
}

/**
 * Create a new LM Studio API client
 */
export function createLMStudioApiClient(baseUrl: string, apiKey: string | undefined = undefined) {
  return new LMStudioApiClient(baseUrl, apiKey);
}
