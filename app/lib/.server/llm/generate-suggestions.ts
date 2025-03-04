import { generateText, type CoreTool, type GenerateTextResult, type Message } from 'ai';
import type { IProviderSetting } from '~/types/model';
import { DEFAULT_MODEL, DEFAULT_PROVIDER, PROVIDER_LIST } from '~/utils/constants';
import { extractPropertiesFromMessage } from './utils';
import { createScopedLogger } from '~/utils/logger';
import { LLMManager } from '~/lib/modules/llm/manager';

// Common patterns to ignore, similar to .gitignore
const logger = createScopedLogger('generate-suggestions');

export async function generateResponses(props: {
  messages: Message[];
  assistantResponse: string;
  env?: Env;
  apiKeys?: Record<string, string>;
  providerSettings?: Record<string, IProviderSetting>;
  promptId?: string;
  contextOptimization?: boolean;
  summary: string;
  onFinish?: (resp: GenerateTextResult<Record<string, CoreTool<any, any>>, never>) => void;
}) {
  const { messages, env: serverEnv, apiKeys, providerSettings, summary, onFinish, assistantResponse } = props;
  let currentModel = DEFAULT_MODEL;
  let currentProvider = DEFAULT_PROVIDER.name;

  messages.map((message) => {
    if (message.role === 'user') {
      const { model, provider, content } = extractPropertiesFromMessage(message);
      currentModel = model;
      currentProvider = provider;

      return { ...message, content };
    }

    return message;
  });

  const provider = PROVIDER_LIST.find((p) => p.name === currentProvider) || DEFAULT_PROVIDER;
  const staticModels = LLMManager.getInstance().getStaticModelListFromProvider(provider);
  let modelDetails = staticModels.find((m) => m.name === currentModel);

  if (!modelDetails) {
    const modelsList = [
      ...(provider.staticModels || []),
      ...(await LLMManager.getInstance().getModelListFromProvider(provider, {
        apiKeys,
        providerSettings,
        serverEnv: serverEnv as any,
      })),
    ];

    if (!modelsList.length) {
      throw new Error(`No models found for provider ${provider.name}`);
    }

    modelDetails = modelsList.find((m) => m.name === currentModel);

    if (!modelDetails) {
      // Fallback to first model
      logger.warn(
        `MODEL [${currentModel}] not found in provider [${provider.name}]. Falling back to first model. ${modelsList[0].name}`,
      );
      modelDetails = modelsList[0];
    }
  }

  const resp = await generateText({
    system: `
Now, you are given a task. give the user options for next pending task.

Below is the project details in a summary:
<projectSummary>
${summary}
</projectSummary>

RESPONSE FORMAT:
your response should be in following example format:
---
<taskSuggestions>
    <task>{task_1}</task>
    <task>{task_2}</task>
</taskSuggestions>
---
* Your should start with <taskSuggestions> and end with </taskSuggestions>.
* You can include multiple <task> tags in the response.
* You should not include any other text in the response.
* If no changes are needed, you can leave the response empty taskSuggestions tag.
* Only suggest relavent and immidiate task that should be addressed and in the plan
        `,
    prompt: `
        Your last response: 
        ---
        ${assistantResponse}
        ---

       Suggest what are the immidiate task that user should can ask you to do
        `,
    model: provider.getModelInstance({
      model: currentModel,
      serverEnv,
      apiKeys,
      providerSettings,
    }),
  });

  const response = resp.text;
  const suggestions = response.match(/<taskSuggestions>([\s\S]*?)<\/taskSuggestions>/);

  if (!suggestions) {
    throw new Error('Invalid response. Please follow the response format');
  }

  const tasks =
    suggestions[1].match(/<task>(.*?)<\/task>/gm)?.map((x) => x.replace('<task>', '').replace('</task>', '')) || [];

  if (onFinish) {
    onFinish(resp);
  }

  return tasks;

  // generateText({
}
