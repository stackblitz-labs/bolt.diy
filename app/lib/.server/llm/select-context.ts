import type { CoreTool, GenerateTextResult, Message } from 'ai';
import ignore from 'ignore';
import { IGNORE_PATTERNS, type FileMap } from './constants';
import { createScopedLogger } from '~/utils/logger';
import { getContextFiles, grepForSpecificText } from './context';

// Common patterns to ignore, similar to .gitignore

const ig = ignore().add(IGNORE_PATTERNS);
const logger = createScopedLogger('select-context');

export async function selectContext(props: {
  messages: Message[];
  files: FileMap;
  summary: string;
  recentlyEdited?: string[];
  onFinish?: (resp: GenerateTextResult<Record<string, CoreTool<any, any>>, never>) => void;
}) {
  const startTime = performance.now();
  const { messages, files, recentlyEdited = [], onFinish } = props;

  // Get all file paths and filter ignored patterns
  let filePaths = getFilePaths(files || {});
  filePaths = filePaths.filter((x) => {
    const relPath = x.replace('/home/project/', '');
    return !ig.ignores(relPath);
  });

  // Extract text content from message (handles both string and array content)
  const extractTextContent = (message: Message) =>
    Array.isArray(message.content)
      ? (message.content.find((item) => item.type === 'text')?.text as string) || ''
      : message.content;

  // Get last user message for keyword matching
  const lastUserMessage = messages.filter((x) => x.role == 'user').pop();

  if (!lastUserMessage) {
    throw new Error('No user message found');
  }

  const userQuery = extractTextContent(lastUserMessage);

  // Extract chat history for chat mention boost
  const chatHistory = messages.filter((m) => m.role === 'user').map((m) => extractTextContent(m));

  // Use local context selection function instead of LLM call
  const selectedFiles = getContextFiles(userQuery, filePaths, {
    recentlyEdited,
    chatHistory,
  });

  // Use grep fallback to find files containing specific text (prices, hex colors, quoted strings)
  const grepMatches = grepForSpecificText(userQuery, files);

  // Merge keyword-selected files with grep matches (unique paths)
  const allSelectedFiles = [...new Set([...selectedFiles, ...grepMatches])];

  // Build filtered FileMap from selected paths
  const filteredFiles: FileMap = {};

  for (const path of allSelectedFiles) {
    // Handle both relative and absolute paths
    let fullPath = path;
    let relativePath = path;

    if (path.startsWith('/home/project/')) {
      relativePath = path.replace('/home/project/', '');
    } else {
      fullPath = `/home/project/${path}`;
    }

    // Try to find the file in the files map
    if (files[fullPath]) {
      filteredFiles[relativePath] = files[fullPath];
    } else if (files[path]) {
      filteredFiles[relativePath] = files[path];
    }
  }

  // Call onFinish with mock response for backward compatibility
  if (onFinish) {
    const mockResponse = {
      text: `Selected ${allSelectedFiles.length} files using local context selection (${selectedFiles.length} keyword, ${grepMatches.length} grep)`,
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      },
      finishReason: 'stop' as const,
      response: {
        id: 'local-context-selection',
        timestamp: new Date(),
        modelId: 'local',
      },
      rawResponse: undefined,
      warnings: [],
      logprobs: undefined,
      toolCalls: [],
      toolResults: [],
      request: {},
      experimental_providerMetadata: undefined,
      providerMetadata: undefined,
      roundtrips: [],
      steps: [],
      responseMessages: [],
    } as unknown as GenerateTextResult<Record<string, CoreTool<any, any>>, never>;
    onFinish(mockResponse);
  }

  const duration = performance.now() - startTime;
  const totalFiles = Object.keys(filteredFiles).length;
  logger.info(`Context selection completed: ${totalFiles} files in ${duration.toFixed(2)}ms`);

  if (totalFiles === 0) {
    throw new Error(`Context selection failed to find relevant files`);
  }

  return filteredFiles;
}

export function getFilePaths(files: FileMap) {
  let filePaths = Object.keys(files);
  filePaths = filePaths.filter((x) => {
    const relPath = x.replace('/home/project/', '');
    return !ig.ignores(relPath);
  });

  return filePaths;
}
