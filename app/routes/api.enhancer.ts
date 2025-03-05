import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { streamText } from '~/lib/.server/llm/stream-text';
import { stripIndents } from '~/utils/stripIndent';
import type { ProviderInfo } from '~/types/model';
import { getApiKeysFromCookie, getProviderSettingsFromCookie } from '~/lib/api/cookies';
import { createScopedLogger } from '~/utils/logger';
import { LLMManager } from '~/lib/modules/llm/manager';
import { createDataStream } from 'ai';

const encoder = new TextEncoder();

export async function action(args: ActionFunctionArgs) {
  return enhancerAction(args);
}

const systemPrompt = stripIndents`
  You are a prompt engineer. Your task is to enhance the user's prompt to get better results from the language model.
  You should maintain the original intent and meaning of the prompt while making it more detailed, specific, and effective.
  Consider adding relevant context, clarifying ambiguities, and structuring the prompt in a way that helps the model understand better.
  Return only the enhanced prompt without any explanations or meta-commentary.
`;

async function enhancerAction({ context, request }: ActionFunctionArgs) {
  const { message, model, provider } = await request.json<{
    message: string;
    model: string;
    provider: ProviderInfo;
  }>();

  const logger = createScopedLogger('enhancer');

  try {
    // Get API keys and provider settings from cookies
    const cookieHeader = request.headers.get('Cookie');
    const apiKeys = getApiKeysFromCookie(cookieHeader);
    const providerSettings = getProviderSettingsFromCookie(cookieHeader);

    // Get LLM instance
    const llmManager = LLMManager.getInstance(context.cloudflare?.env as any);
    const providerInstance = llmManager.getProvider(provider.name);

    if (!providerInstance) {
      throw new Error(`Provider ${provider.name} not found`);
    }

    const providerName = providerInstance.name;

    const dataStream = createDataStream({
      async execute(dataStream) {
        const result = await streamText({
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: stripIndents`
                [Model: ${model}]

                [Provider: ${providerName}]

                <original_prompt>
                ${message}
                </original_prompt>
              `,
            },
          ],
          env: context.cloudflare?.env as any,
          apiKeys,
          providerSettings,
          options: {
            system: systemPrompt,
          },
        });

        // Handle streaming errors
        (async () => {
          try {
            for await (const part of result.fullStream) {
              if (part.type === 'error') {
                logger.error('Streaming error:', part.error);
                throw part.error;
              }
            }
          } catch (error) {
            logger.error('Stream processing error:', error);
          }
        })();

        result.mergeIntoDataStream(dataStream);
      },
    }).pipeThrough(
      new TransformStream({
        transform(chunk, controller) {
          // Only process string chunks that contain actual content
          if (typeof chunk === 'string' && chunk.startsWith('0:"')) {
            try {
              // Extract the content from the JSON string
              const content = JSON.parse(chunk.slice(2));

              // Remove markdown code block markers and clean up
              const cleanContent = content
                .replace(/^```text\n/, '')
                .replace(/\n```$/, '')
                .replace(/\\n/g, '\n')
                .trim();

              if (cleanContent) {
                controller.enqueue(encoder.encode(cleanContent + '\n'));
              }
            } catch {
              // If parsing fails, just ignore this chunk
            }
          }

          // Ignore all other chunks (metadata, formatting, etc.)
        },
      }),
    );

    return new Response(dataStream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        Connection: 'keep-alive',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error: unknown) {
    logger.error('Enhancer error:', error);

    if (error instanceof Error) {
      if (error.message?.includes('API key')) {
        throw new Response('Invalid or missing API key', {
          status: 401,
          statusText: 'Unauthorized',
        });
      }

      if (error.message?.includes('baseUrl') || error.message?.includes('connection')) {
        throw new Response('Provider connection error', {
          status: 503,
          statusText: 'Service Unavailable',
        });
      }
    }

    throw new Response('Internal server error', {
      status: 500,
      statusText: 'Internal Server Error',
    });
  }
}
