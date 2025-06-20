import type { ProviderConfig, StatusCheckResult, ApiResponse } from './types';

export abstract class BaseProviderChecker {
  protected config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  protected async checkApiEndpoint(
    url: string,
    headers?: Record<string, string>,
    testModel?: string,
  ): Promise<{ ok: boolean; status: number | string; message?: string; responseTime: number }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const startTime = performance.now();

      // Add common headers
      const processedHeaders = {
        'Content-Type': 'application/json',
        ...headers,
      };

      const response = await fetch(url, {
        method: 'GET',
        headers: processedHeaders,
        signal: controller.signal,
      });

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      clearTimeout(timeoutId);

      const data = (await response.json()) as ApiResponse;

      if (!response.ok) {
        let errorMessage = `API returned status: ${response.status}`;

        if (data.error?.message) {
          errorMessage = data.error.message;
        } else if (data.message) {
          errorMessage = data.message;
        }

        return {
          ok: false,
          status: response.status,
          message: errorMessage,
          responseTime,
        };
      }

      // Different providers have different model list formats
      let models: string[] = [];

      if (Array.isArray(data)) {
        models = data.map((model: { id?: string; name?: string }) => model.id || model.name || '');
      } else if (data.data && Array.isArray(data.data)) {
        models = data.data.map((model) => model.id || model.name || '');
      } else if (data.models && Array.isArray(data.models)) {
        models = data.models.map((model) => model.id || model.name || '');
      } else if (data.model) {
        models = [data.model];
      }

      if (!testModel || models.length > 0) {
        return {
          ok: true,
          status: response.status,
          responseTime,
          message: 'API key is valid',
        };
      }

      if (testModel && !models.includes(testModel)) {
        return {
          ok: true,
          status: 'model_not_found',
          message: `API key is valid (test model ${testModel} not found in ${models.length} available models)`,
          responseTime,
        };
      }

      return {
        ok: true,
        status: response.status,
        message: 'API key is valid',
        responseTime,
      };
    } catch (error) {
      console.error(`Error checking API endpoint ${url}:`, error);
      return {
        ok: false,
        status: error instanceof Error ? error.message : 'Unknown error',
        message: error instanceof Error ? `Connection failed: ${error.message}` : 'Connection failed',
        responseTime: 0,
      };
    }
  }

  protected async checkEndpoint(url: string): Promise<'reachable' | 'unreachable'> {
    try {
      const response = await fetch(url, {
        mode: 'no-cors',
        headers: {
          Accept: 'text/html',
        },
      });
      return response.type === 'opaque' ? 'reachable' : 'unreachable';
    } catch (error) {
      console.error(`Error checking ${url}:`, error);
      return 'unreachable';
    }
  }

  abstract checkStatus(): Promise<StatusCheckResult>;
}
