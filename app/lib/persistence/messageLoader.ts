/**
 * Message Loader Module
 *
 * Paginated message fetching from server API with exponential backoff for rate limiting.
 * From specs/001-load-project-messages/plan.md and tasks.md (T006-T009)
 */

import type { Message } from 'ai';
import { createScopedLogger } from '~/utils/logger';
import type { ProjectMessage } from '~/types/project';
import type { MessageLoaderOptions, MessageLoadResult, MessageLoadProgress } from '~/types/message-loading';
import { defaultLoaderOptions } from '~/types/message-loading';
import { calculateBackoff, isRetryableStatus, sleep } from '~/lib/utils/backoff';
import { validateMessages } from './messageValidation';

const logger = createScopedLogger('MessageLoader');

/**
 * API response format for a single page of messages.
 */
interface MessagePageResponse {
  messages: ProjectMessage[];
  total: number;
}

type MessageOrder = 'asc' | 'desc';

/**
 * Fetch a single page of messages from the server.
 *
 * @param projectId - The project ID to fetch messages for
 * @param offset - Number of messages to skip (pagination offset)
 * @param limit - Maximum number of messages to return
 * @param order - Sort order by sequence number
 * @returns Promise resolving to the page response
 * @throws Error if the request fails (except 404 which returns empty)
 */
export async function fetchMessagePage(
  projectId: string,
  offset: number,
  limit: number,
  order: MessageOrder = 'asc',
): Promise<MessagePageResponse> {
  logger.debug('Fetching message page', { projectId, offset, limit, order });

  const response = await fetch(
    `/api/projects/${projectId}/messages?limit=${limit}&offset=${offset}&order=${order}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );

  // Handle 404 - no messages found
  if (response.status === 404) {
    logger.info('No messages found for project', { projectId });
    return { messages: [], total: 0 };
  }

  // Handle non-2xx responses
  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(errorData.message || `Failed to fetch messages: HTTP ${response.status}`);
  }

  const data = (await response.json()) as MessagePageResponse;
  logger.debug('Message page fetched successfully', {
    projectId,
    count: data.messages.length,
    total: data.total,
  });

  return data;
}

/**
 * Load all messages for a project using pagination.
 *
 * This function fetches all pages of messages from the server, handling:
 * - Pagination loop: continues fetching until offset >= total
 * - Rate limiting (429): exponential backoff with max retries
 * - Progress reporting: calls onProgress callback with current status
 * - Partial results: returns loaded messages if max retries exceeded
 *
 * @param projectId - The project ID to load messages for
 * @param options - Loader configuration options
 * @returns Promise resolving to the load result with messages and metadata
 *
 * @example
 * ```ts
 * const result = await loadAllMessages('project-123', {
 *   pageSize: 100,
 *   maxRetries: 3,
 *   onProgress: (progress) => {
 *     console.log(`Loaded ${progress.loaded} of ${progress.total}`);
 *   }
 * });
 *
 * console.log(`Loaded ${result.messages.length} messages`);
 * if (result.isPartial) {
 *   console.warn('Some messages could not be loaded due to rate limiting');
 * }
 * ```
 */
export async function loadAllMessages(
  projectId: string,
  options: Partial<MessageLoaderOptions> = {},
): Promise<MessageLoadResult> {
  const config = { ...defaultLoaderOptions, ...options };

  logger.info('Starting paginated message load', {
    projectId,
    pageSize: config.pageSize,
    maxRetries: config.maxRetries,
  });

  const allMessages: Message[] = [];
  let offset = 0;
  let total = Infinity;
  let retryCount = 0;
  let isPartial = false;
  const startTime = Date.now();

  while (offset < total) {
    try {
      // Fetch a page of messages
      const response = await fetchMessagePage(projectId, offset, config.pageSize, 'asc');

      // Update total from first response
      total = response.total;

      // Convert API messages to AI SDK Message format
      const messages = convertToAISDKMessages(response.messages);

      // Validate and add to collection
      const validMessages = validateMessages(messages);
      allMessages.push(...validMessages);

      // Move to next page
      offset += config.pageSize;

      // Reset retry count on success
      retryCount = 0;

      // Emit progress callback
      config.onProgress?.({
        loaded: allMessages.length,
        total,
        page: Math.ceil(offset / config.pageSize),
        isComplete: offset >= total,
        isRateLimited: false,
      });

      logger.debug('Page loaded successfully', {
        projectId,
        offset,
        loaded: allMessages.length,
        total,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const isRetryable = extractHttpStatus(err) ? isRetryableStatus(extractHttpStatus(err)!) : false;

      // Handle rate limiting (429) and server errors (5xx)
      if (isRetryable && retryCount < config.maxRetries) {
        const delay = calculateBackoff(retryCount, {
          baseDelay: config.baseDelay,
          maxDelay: config.maxDelay,
          jitterFactor: 0.1,
        });

        logger.warn('Rate limited or server error, retrying with backoff', {
          projectId,
          attempt: retryCount + 1,
          maxRetries: config.maxRetries,
          delay,
          error: err.message,
        });

        // Emit progress with rate limit flag
        config.onProgress?.({
          loaded: allMessages.length,
          total,
          page: Math.ceil(offset / config.pageSize),
          isComplete: false,
          isRateLimited: true,
        });

        await sleep(delay);
        retryCount++;
        continue;
      }

      // Max retries exceeded - return partial results
      if (isRetryable && retryCount >= config.maxRetries) {
        logger.warn('Max retries exceeded, returning partial results', {
          projectId,
          loaded: allMessages.length,
          total,
        });

        isPartial = true;
        break;
      }

      // Non-retryable error - throw
      logger.error('Failed to load messages', {
        projectId,
        error: err.message,
      });

      throw err;
    }
  }

  const duration = Date.now() - startTime;

  logger.info('Message loading complete', {
    projectId,
    loaded: allMessages.length,
    total,
    isPartial,
    duration: `${duration}ms`,
  });

  return {
    messages: allMessages,
    total,
    source: 'server',
    isPartial,
    loadedFromServer: allMessages.length,
    loadedFromLocal: 0,
  };
}

/**
 * Load a single recent page of messages (most recent first).
 */
export async function loadRecentMessages(projectId: string, limit: number): Promise<MessagePageResponse> {
  return fetchMessagePage(projectId, 0, limit, 'desc');
}

/**
 * Load an older page of messages using ascending order for stable pagination.
 */
export async function loadOlderMessagesPage(
  projectId: string,
  offset: number,
  limit: number,
): Promise<MessagePageResponse> {
  return fetchMessagePage(projectId, offset, limit, 'asc');
}

/**
 * Convert ProjectMessage API format to AI SDK Message format.
 *
 * @param projectMessages - Messages from the API
 * @returns Messages in AI SDK format
 */
function convertToAISDKMessages(projectMessages: ProjectMessage[]): Message[] {
  return projectMessages.map((msg) => ({
    id: msg.message_id,
    role: msg.role,
    content: msg.content as Message['content'], // API returns content matching AI SDK format
    createdAt: new Date(msg.created_at),
    annotations: msg.annotations as Message['annotations'], // Preserve annotations for hidden messages
  }));
}

/**
 * Extract HTTP status code from an error message.
 *
 * @param error - The error to extract status from
 * @returns HTTP status code or undefined
 */
function extractHttpStatus(error: Error): number | undefined {
  const match = error.message.match(/HTTP (\d{3})/);
  return match ? parseInt(match[1], 10) : undefined;
}

// Re-export types for convenience
export type { MessageLoaderOptions, MessageLoadResult, MessageLoadProgress };
