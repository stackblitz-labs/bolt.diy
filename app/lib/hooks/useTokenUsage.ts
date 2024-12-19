import { useMemo } from 'react';
import type { Message } from 'ai';
import type { ModelUsage, TokenUsage } from '~/types/token-usage';

export function useTokenUsage(messages: Message[]) {
  return useMemo(() => {
    const modelUsages = new Map<string, ModelUsage>();

    // Process all messages to gather model usage statistics
    messages.forEach((message, index) => {
      if (message.role === 'user') {
        const content = Array.isArray(message.content)
          ? message.content.find((c) => c.type === 'text')?.text
          : message.content;

        if (typeof content === 'string') {
          const modelMatch = content.match(/\[Model: (.*?)\]/);
          const providerMatch = content.match(/\[Provider: (.*?)\]/);
          const model = modelMatch?.[1];
          const provider = providerMatch?.[1];

          if (model && provider) {
            const assistantMessage = messages[index + 1];
            const usageAnnotation = assistantMessage?.annotations?.find((a) => {
              const annotation = a as { type?: string; value?: TokenUsage };
              return annotation?.type === 'usage' && annotation?.value !== undefined;
            }) as { value: TokenUsage } | undefined;

            const key = `${provider}:${model}`;
            const existing = modelUsages.get(key) || {
              model,
              provider,
              completionTokens: 0,
              promptTokens: 0,
              totalTokens: 0,
              count: 0,
            };

            if (usageAnnotation?.value) {
              const { value } = usageAnnotation;
              existing.completionTokens += value.completionTokens || 0;
              existing.promptTokens += value.promptTokens || 0;
              existing.totalTokens += value.totalTokens || 0;
            }

            existing.count += 1;
            modelUsages.set(key, existing);
          }
        }
      }
    });

    // Calculate total token usage
    const totalUsage = Array.from(modelUsages.values()).reduce(
      (acc, usage) => ({
        completionTokens: acc.completionTokens + usage.completionTokens,
        promptTokens: acc.promptTokens + usage.promptTokens,
        totalTokens: acc.totalTokens + usage.totalTokens,
      }),
      { completionTokens: 0, promptTokens: 0, totalTokens: 0 } as TokenUsage,
    );

    const promptPercentage = ((totalUsage.promptTokens / totalUsage.totalTokens) * 100).toFixed(1);
    const completionPercentage = ((totalUsage.completionTokens / totalUsage.totalTokens) * 100).toFixed(1);

    return {
      modelUsages,
      totalUsage,
      promptPercentage,
      completionPercentage,
    };
  }, [messages]);
}
