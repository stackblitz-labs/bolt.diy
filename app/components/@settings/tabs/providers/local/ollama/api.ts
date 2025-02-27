import type { ModelInfo, ApiClient } from '~/components/@settings/tabs/providers/local/common/types';
import { formatBytes } from '~/utils/numbers';

const DEFAULT_TIMEOUT = 10000; // 10 seconds

interface OllamaError {
  error?: string;
  status?: number;
}

interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
  details: {
    format: string;
    family: string;
    parameter_size: string;
    quantization_level: string;
  };
}

interface OllamaModelList {
  models: OllamaModel[];
}

interface OllamaModelPull {
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
}

/**
 * Ollama API client for local model inference
 */
export class OllamaApiClient implements ApiClient {
  private _baseUrl: string;

  constructor(baseUrl: string) {
    this._baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
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
          ...options.headers,
        },
        signal: options.signal || controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      // Check for API-specific error format
      if (!response.ok) {
        const error = data as OllamaError;
        throw new Error(error.error || `HTTP error! status: ${response.status}`);
      }

      return data as T;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Request timed out or was aborted');
        }

        throw error;
      }

      throw new Error('An unknown error occurred');
    }
  }

  /**
   * Check if the Ollama server is running
   */
  async isServerRunning(): Promise<boolean> {
    try {
      // Use a shorter timeout for health check by creating a controller with shorter timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      try {
        await this._fetch<OllamaModelList>('/api/tags', {
          signal: controller.signal,
        });
        return true;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      console.error('Error checking Ollama server:', error);
      return false;
    }
  }

  /**
   * Get list of available models
   */
  async getModels(): Promise<ModelInfo[]> {
    try {
      const response = await this._fetch<OllamaModelList>('/api/tags');

      if (!Array.isArray(response.models)) {
        throw new Error('Invalid response format: models data is not an array');
      }

      return response.models.map((model) => ({
        name: model.name,
        desc: `${model.details.family} (${model.details.parameter_size}, ${model.details.quantization_level})`,
        size: formatBytes(model.size),
        installed: true,
      }));
    } catch (error) {
      console.error('Error getting Ollama models:', error);
      return [];
    }
  }

  /**
   * Pull a model from Ollama
   */
  async pullModel(modelName: string, onProgress?: (progress: number) => void): Promise<void> {
    try {
      const response = await fetch(`${this._baseUrl}/api/pull`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: modelName }),
      });

      if (!response.ok) {
        throw new Error(`Failed to pull model: ${response.statusText}`);
      }

      const reader = response.body?.getReader();

      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          try {
            const data = JSON.parse(line) as OllamaModelPull;

            if (data.total && data.completed && onProgress) {
              onProgress((data.completed / data.total) * 100);
            }
          } catch {
            // Ignore invalid JSON
          }
        }
      }
    } catch (error) {
      console.error('Error pulling model:', error);
      throw error;
    }
  }

  /**
   * Delete a model from Ollama
   */
  async deleteModel(modelName: string): Promise<void> {
    try {
      await this._fetch('/api/delete', {
        method: 'DELETE',
        body: JSON.stringify({ name: modelName }),
      });
    } catch (error) {
      console.error('Error deleting model:', error);
      throw error;
    }
  }
}

/**
 * Create a new Ollama API client
 */
export function createOllamaApiClient(baseUrl: string) {
  return new OllamaApiClient(baseUrl);
}
