import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';

interface RuncrateModelEntry {
  id: string;
  name?: string;
  context_length?: number;
  supported_features?: string[];
  output_modalities?: string[];
}

export default class RuncrateProvider extends BaseProvider {
  name = 'Runcrate';
  getApiKeyLink = 'https://www.runcrate.ai/dashboard/api-keys';

  config = {
    apiTokenKey: 'RUNCRATE_API_KEY',
  };

  staticModels: ModelInfo[] = [
    {
      name: 'deepseek-ai/DeepSeek-V4.1-Flash',
      label: 'DeepSeek V4.1 Flash',
      provider: 'Runcrate',
      maxTokenAllowed: 1048576,
    },
    {
      name: 'Qwen/Qwen3-Coder-480B-A35B-Instruct-Turbo',
      label: 'Qwen3-Coder 480B (Best for Coding)',
      provider: 'Runcrate',
      maxTokenAllowed: 262144,
    },
    { name: 'moonshotai/Kimi-K3', label: 'Kimi K3', provider: 'Runcrate', maxTokenAllowed: 1048576 },
    { name: 'zai-org/GLM-5.3', label: 'GLM 5.3', provider: 'Runcrate', maxTokenAllowed: 1048576 },
    { name: 'openai/gpt-oss-120b', label: 'gpt-oss 120B', provider: 'Runcrate', maxTokenAllowed: 131072 },
  ];

  async getDynamicModels(
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    serverEnv?: Record<string, string>,
  ): Promise<ModelInfo[]> {
    const { apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: settings,
      serverEnv,
      defaultBaseUrlKey: '',
      defaultApiTokenKey: 'RUNCRATE_API_KEY',
    });

    if (!apiKey) {
      return [];
    }

    try {
      const response = await fetch('https://api.runcrate.ai/v1/models', {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        signal: this.createTimeoutSignal(5000),
      });

      if (!response.ok) {
        console.error(`Runcrate API error: ${response.statusText}`);
        return [];
      }

      const data = (await response.json()) as { data?: RuncrateModelEntry[] };
      const staticModelIds = this.staticModels.map((m) => m.name);

      // Keep text models that support tool calls, and skip the ones already in staticModels
      const dynamicModels: ModelInfo[] = (data.data ?? [])
        .filter(
          (model) =>
            !staticModelIds.includes(model.id) &&
            model.supported_features?.includes('tools') &&
            model.output_modalities?.includes('text') &&
            (model.context_length ?? 0) > 0,
        )
        .map((m) => ({
          name: m.id,
          label: `${m.name || m.id} (Dynamic)`,
          provider: this.name,
          maxTokenAllowed: m.context_length ?? 0,
        }));

      return dynamicModels;
    } catch (error) {
      console.error(`Failed to fetch Runcrate models:`, error);
      return [];
    }
  }

  getModelInstance(options: {
    model: string;
    serverEnv: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModel {
    const { model, serverEnv, apiKeys, providerSettings } = options;

    const { apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: providerSettings?.[this.name],
      serverEnv: serverEnv as unknown as Record<string, string>,
      defaultBaseUrlKey: '',
      defaultApiTokenKey: 'RUNCRATE_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const openai = createOpenAI({
      baseURL: 'https://api.runcrate.ai/v1',
      apiKey,
    });

    return openai.chat(model);
  }
}
