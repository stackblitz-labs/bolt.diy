import type { ProviderName, ProviderConfig, StatusCheckResult } from './types';
import { BaseProviderChecker } from './base-provider';

import { AmazonBedrockStatusChecker } from './providers/amazon-bedrock';
import { CohereStatusChecker } from './providers/cohere';
import { DeepseekStatusChecker } from './providers/deepseek';
import { GoogleStatusChecker } from './providers/google';
import { GroqStatusChecker } from './providers/groq';
import { HuggingFaceStatusChecker } from './providers/huggingface';
import { HyperbolicStatusChecker } from './providers/hyperbolic';
import { MistralStatusChecker } from './providers/mistral';
import { OpenRouterStatusChecker } from './providers/openrouter';
import { PerplexityStatusChecker } from './providers/perplexity';
import { TogetherStatusChecker } from './providers/together';
import { XAIStatusChecker } from './providers/xai';

export class ProviderStatusCheckerFactory {
  private static _providerConfigs: Record<ProviderName, ProviderConfig> = {
    AmazonBedrock: {
      statusUrl: 'https://health.aws.amazon.com/health/status',
      apiUrl: 'https://bedrock.us-east-1.amazonaws.com/models',
      headers: {},
      testModel: 'anthropic.claude-3-sonnet-20240229-v1:0',
    },
    Cohere: {
      statusUrl: 'https://status.cohere.com/',
      apiUrl: 'https://api.cohere.ai/v1/models',
      headers: {},
      testModel: 'command',
    },
    Deepseek: {
      statusUrl: 'https://status.deepseek.com/',
      apiUrl: 'https://api.deepseek.com/v1/models',
      headers: {},
      testModel: 'deepseek-chat',
    },
    Google: {
      statusUrl: 'https://status.cloud.google.com/',
      apiUrl: 'https://generativelanguage.googleapis.com/v1/models',
      headers: {},
      testModel: 'gemini-pro',
    },
    Groq: {
      statusUrl: 'https://groqstatus.com/',
      apiUrl: 'https://api.groq.com/v1/models',
      headers: {},
      testModel: 'mixtral-8x7b-32768',
    },
    HuggingFace: {
      statusUrl: 'https://status.huggingface.co/',
      apiUrl: 'https://api-inference.huggingface.co/models',
      headers: {},
      testModel: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
    },
    Hyperbolic: {
      statusUrl: 'https://status.hyperbolic.ai/',
      apiUrl: 'https://api.hyperbolic.ai/v1/models',
      headers: {},
      testModel: 'hyperbolic-1',
    },
    Mistral: {
      statusUrl: 'https://status.mistral.ai/',
      apiUrl: 'https://api.mistral.ai/v1/models',
      headers: {},
      testModel: 'mistral-tiny',
    },
    OpenRouter: {
      statusUrl: 'https://status.openrouter.ai/',
      apiUrl: 'https://openrouter.ai/api/v1/models',
      headers: {},
      testModel: 'anthropic/claude-3-sonnet',
    },
    Perplexity: {
      statusUrl: 'https://status.perplexity.com/',
      apiUrl: 'https://api.perplexity.ai/v1/models',
      headers: {},
      testModel: 'pplx-7b-chat',
    },
    Together: {
      statusUrl: 'https://status.together.ai/',
      apiUrl: 'https://api.together.xyz/v1/models',
      headers: {},
      testModel: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
    },
    XAI: {
      statusUrl: 'https://status.x.ai/',
      apiUrl: 'https://api.x.ai/v1/models',
      headers: {},
      testModel: 'grok-1',
    },
  };

  static getChecker(provider: ProviderName): BaseProviderChecker {
    const config = this._providerConfigs[provider];

    if (!config) {
      throw new Error(`No configuration found for provider: ${provider}`);
    }

    switch (provider) {
      case 'AmazonBedrock':
        return new AmazonBedrockStatusChecker(config);
      case 'Cohere':
        return new CohereStatusChecker(config);
      case 'Deepseek':
        return new DeepseekStatusChecker(config);
      case 'Google':
        return new GoogleStatusChecker(config);
      case 'Groq':
        return new GroqStatusChecker(config);
      case 'HuggingFace':
        return new HuggingFaceStatusChecker(config);
      case 'Hyperbolic':
        return new HyperbolicStatusChecker(config);
      case 'Mistral':
        return new MistralStatusChecker(config);
      case 'OpenRouter':
        return new OpenRouterStatusChecker(config);
      case 'Perplexity':
        return new PerplexityStatusChecker(config);
      case 'Together':
        return new TogetherStatusChecker(config);
      case 'XAI':
        return new XAIStatusChecker(config);
      default:
        return new (class extends BaseProviderChecker {
          async checkStatus(): Promise<StatusCheckResult> {
            const endpointStatus = await this.checkEndpoint(this.config.statusUrl);
            const apiStatus = await this.checkEndpoint(this.config.apiUrl);

            return {
              status: endpointStatus === 'reachable' && apiStatus === 'reachable' ? 'operational' : 'degraded',
              message: `Status page: ${endpointStatus}, API: ${apiStatus}`,
              incidents: ['Note: Limited status information due to CORS restrictions'],
            };
          }
        })(config);
    }
  }

  static getProviderNames(): ProviderName[] {
    return Object.keys(this._providerConfigs) as ProviderName[];
  }

  static getProviderConfig(provider: ProviderName): ProviderConfig {
    const config = this._providerConfigs[provider];

    if (!config) {
      throw new Error(`Unknown provider: ${provider}`);
    }

    return config;
  }
}
