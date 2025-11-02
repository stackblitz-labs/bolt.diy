import { createOpenAI, type OpenAIProvider } from '@ai-sdk/openai';

export function createAzure(
  apiKey: string,
  resourceName: string,
): OpenAIProvider {
  return createOpenAI({
    apiKey,
    baseURL: `https://${resourceName}.openai.azure.com/`,
  });
}
