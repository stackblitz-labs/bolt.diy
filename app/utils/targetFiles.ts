import { isFileTargeted as isFileTargetedInternal, getTargetedFiles } from '~/lib/persistence/targetedFiles';
import { createScopedLogger } from './logger';

const logger = createScopedLogger('TargetFiles');

export function getCurrentChatId(): string {
  try {
    if (typeof window !== 'undefined') {
      const match = window.location.pathname.match(/\/chat\/([^/]+)/);

      if (match && match[1]) {
        return match[1];
      }
    }

    return 'default';
  } catch (error) {
    logger.error('Failed to get current chat ID', error);
    return 'default';
  }
}

export function isFileTargeted(filePath: string, chatId?: string): boolean {
  try {
    const currentChatId = chatId || getCurrentChatId();
    return isFileTargetedInternal(currentChatId, filePath);
  } catch (error) {
    logger.error('Failed to check if file is targeted', error);
    return false;
  }
}

export function hasTargetedFiles(chatId?: string): boolean {
  try {
    const currentChatId = chatId || getCurrentChatId();
    const files = getTargetedFiles();

    return files.some((f) => f.chatId === currentChatId);
  } catch (error) {
    logger.error('Failed to check for targeted files', error);
    return false;
  }
}

export { addTargetedFile, removeTargetedFile } from '~/lib/persistence/targetedFiles';
