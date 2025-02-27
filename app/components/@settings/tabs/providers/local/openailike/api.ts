import type { ModelInfo, ApiClient } from '~/components/@settings/tabs/providers/local/common/types';

const DEFAULT_TIMEOUT = 5000; // 5 seconds

interface OpenAIError {
  error?: {
    message: string;
    type: string;
    code: string;
  };
}

interface OpenAIModel {
  id: string;
  object: string;
  owned_by?: string;
  permission?: any[];
}

interface OpenAIModelList {
  object: string;
  data: OpenAIModel[];
}

/**
 * OpenAI-like API client for local servers that implement the OpenAI API spec
 */
export class OpenAILikeApiClient implements ApiClient {
  private _baseUrl: string;
  private _apiKey: string | null;

  /**
   * Create a new OpenAI-like API client
   */
  constructor(baseUrl: string, apiKey?: string) {
    this._baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    this._apiKey = apiKey || null;
  }

  /**
   * Helper method for making API requests
   */
  private async _fetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this._baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.signal ? undefined : DEFAULT_TIMEOUT);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(this._apiKey && { Authorization: `Bearer ${this._apiKey}` }),
          ...options.headers,
        },
        signal: options.signal || controller.signal,
      });

      const data = await response.json();

      // Check for API-specific error format
      if (!response.ok) {
        const error = data as OpenAIError;

        if (error.error?.message) {
          throw new Error(error.error.message);
        }

        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return data as T;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Request timed out');
        }

        throw error;
      }

      throw new Error('An unknown error occurred');
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Set the API key
   */
  setApiKey(apiKey: string) {
    this._apiKey = apiKey;
  }

  /**
   * Check if the server is running and validate API compatibility
   */
  async isServerRunning(): Promise<boolean> {
    try {
      const response = await this._fetch<OpenAIModelList>('/v1/models');
      return response.object === 'list' && Array.isArray(response.data);
    } catch (error) {
      console.error('Error checking OpenAI-like server:', error);
      return false;
    }
  }

  /**
   * Get list of available models
   */
  async getModels(): Promise<ModelInfo[]> {
    try {
      const response = await this._fetch<OpenAIModelList>('/v1/models');

      if (!Array.isArray(response.data)) {
        throw new Error('Invalid response format: models data is not an array');
      }

      return response.data.map((model) => ({
        name: model.id,
        desc: model.owned_by ? `Provided by ${model.owned_by}` : 'Local model with OpenAI-compatible API',
        installed: true,
      }));
    } catch (error) {
      console.error('Error getting OpenAI-like models:', error);
      return [];
    }
  }

  /**
   * Generate completions
   */
  async generateCompletion(prompt: string, options: any = {}): Promise<any> {
    try {
      const data = await this._fetch('/v1/completions', {
        method: 'POST',
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
   * Generate chat completions
   */
  async generateChatCompletion(messages: any[], options: any = {}): Promise<any> {
    try {
      const data = await this._fetch('/v1/chat/completions', {
        method: 'POST',
        body: JSON.stringify({
          messages,
          ...options,
        }),
      });
      return data;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to generate chat completion: ${error.message}`);
      }

      throw new Error('Failed to generate chat completion: Unknown error');
    }
  }
}

/**
 * Create a new OpenAI-like API client
 */
export function createOpenAILikeApiClient(baseUrl: string, apiKey?: string) {
  return new OpenAILikeApiClient(baseUrl, apiKey);
}
