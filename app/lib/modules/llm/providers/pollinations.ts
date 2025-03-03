import { BaseProvider } from "~/lib/modules/llm/base-provider";
import type { ModelInfo } from "~/lib/modules/llm/types";
import type { IProviderSetting } from "~/types/model";
import type { LanguageModelV1 } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

/**
 * Pollinations AI provider implementation
 * This provider uses OpenAI-compatible API endpoints and offers free access to various models
 * Note: API key is set to "dummy-key" by default and doesn't need to be changed
 *
 * Features:
 * - No API key required
 * - Free to use
 * - OpenAI-compatible endpoints
 * - Multiple model options including GPT and Gemini variants
 */
export default class PollinationsProvider extends BaseProvider {
  name = "Pollinations";
  getApiKeyLink = "https://text.pollinations.ai/";

  config = {
    apiTokenKey: "POLLINATIONS_API_KEY",
  };

  /**
   * Available models in Pollinations AI
   * Each model serves different purposes:
   * - pollinations-large: Equivalent to GPT-4o, best for complex tasks
   * - pollinations-base: Equivalent to GPT-4o-mini, good for general use
   * - pollinations-reasoning: Equivalent to o1-mini, optimized for reasoning tasks
   * - gemini: Gemini 2.0 Flash, fast and efficient
   * - gemini-thinking: Gemini 2.0 Flash with enhanced reasoning capabilities
   */
  staticModels: ModelInfo[] = [
    {
      name: "pollinations-large",
      label: "OpenAI GPT-4o",
      provider: "Pollinations",
      maxTokenAllowed: 8000,
    },
    {
      name: "pollinations-base",
      label: "OpenAI GPT-4o-mini",
      provider: "Pollinations",
      maxTokenAllowed: 8000,
    },
    {
      name: "pollinations-reasoning",
      label: "OpenAI o1-mini",
      provider: "Pollinations",
      maxTokenAllowed: 8000,
    },
    {
      name: "gemini",
      label: "Gemini 2.0 Flash",
      provider: "Pollinations",
      maxTokenAllowed: 8000,
    },
    {
      name: "gemini-thinking",
      label: "Gemini 2.0 Flash Thinking",
      provider: "Pollinations",
      maxTokenAllowed: 8000,
    },
  ];

  getModelInstance(options: {
    model: string,
    serverEnv: Env,
    apiKeys?: Record<string, string>,
    providerSettings?: Record<string, IProviderSetting>,
  }): LanguageModelV1 {
    const { model } = options;

    const apiKey = "dummy-key";

    const openai = createOpenAI({
      apiKey,
      baseURL: "https://text.pollinations.ai/openai",
    });

    return openai(model);
  }
}
