import ignore from 'ignore';
import { IGNORE_PATTERNS, type FileMap } from './constants';
import {
  type AnyMessage,
  getFirstTextPart,
  getMessageAnnotations,
  getMessageParts,
} from '~/lib/persistence/messageMigration';
import type { ContextAnnotation } from '~/types/context';
import { DEFAULT_MODEL, DEFAULT_PROVIDER, MODEL_REGEX, PROVIDER_REGEX } from '~/utils/constants';

export function extractPropertiesFromMessage(message: AnyMessage): {
  model: string;
  provider: string;
  content: string;
  parts?: Record<string, unknown>[];
} {
  /*
   * Only the first text segment drives the markers. MODEL_REGEX is ^-anchored,
   * so scanning the joined text would look at the same place anyway, but
   * PROVIDER_REGEX is unanchored and would start matching markers in later parts.
   */
  const textContent = getFirstTextPart(message);

  const modelMatch = textContent.match(MODEL_REGEX);
  const providerMatch = textContent.match(PROVIDER_REGEX);

  const model = modelMatch ? modelMatch[1] : DEFAULT_MODEL;
  const provider = providerMatch ? providerMatch[1] : DEFAULT_PROVIDER.name;

  const strip = (value: string) => value.replace(MODEL_REGEX, '').replace(PROVIDER_REGEX, '');

  const parts = getMessageParts(message);

  if (parts) {
    const cleaned = parts.map((part) =>
      part?.type === 'text' && typeof part.text === 'string' ? { ...part, text: strip(part.text) } : part,
    );

    /*
     * `content` stays a string so callers can hand it to sanitizeText and the
     * template interpolation in create-summary/select-context. It previously
     * returned the array here while claiming to return a string, which made
     * stream-text.ts:94 call .replace() on an array. `parts` carries the
     * cleaned part list so non-text parts such as images survive.
     */
    return {
      model,
      provider,
      content: cleaned
        .filter((part) => part?.type === 'text' && typeof part.text === 'string')
        .map((part) => part.text as string)
        .join(''),
      parts: cleaned,
    };
  }

  return { model, provider, content: strip(textContent) };
}

export function simplifyBoltActions(input: string): string {
  // Using regex to match boltAction tags that have type="file"
  const regex = /(<boltAction[^>]*type="file"[^>]*>)([\s\S]*?)(<\/boltAction>)/g;

  // Replace each matching occurrence
  return input.replace(regex, (_0, openingTag, _2, closingTag) => {
    return `${openingTag}\n          ...\n        ${closingTag}`;
  });
}

export function createFilesContext(files: FileMap, useRelativePath?: boolean) {
  const ig = ignore().add(IGNORE_PATTERNS);

  let filePaths = Object.keys(files);
  filePaths = filePaths.filter((x) => {
    const relPath = x.replace('/home/project/', '');
    return !ig.ignores(relPath);
  });

  const fileContexts = filePaths
    .filter((x) => files[x] && files[x].type == 'file')
    .map((path) => {
      const dirent = files[path];

      if (!dirent || dirent.type == 'folder') {
        return '';
      }

      const codeWithLinesNumbers = dirent.content
        .split('\n')
        // .map((v, i) => `${i + 1}|${v}`)
        .join('\n');

      let filePath = path;

      if (useRelativePath) {
        filePath = path.replace('/home/project/', '');
      }

      return `<boltAction type="file" filePath="${filePath}">${codeWithLinesNumbers}</boltAction>`;
    });

  return `<boltArtifact id="code-content" title="Code Content" >\n${fileContexts.join('\n')}\n</boltArtifact>`;
}

export function extractCurrentContext(
  messages: { role?: string; parts?: unknown; content?: unknown; annotations?: unknown }[],
) {
  const lastAssistantMessage = messages.filter((x) => x.role == 'assistant').slice(-1)[0];

  if (!lastAssistantMessage) {
    return { summary: undefined, codeContext: undefined };
  }

  let summary: ContextAnnotation | undefined;
  let codeContext: ContextAnnotation | undefined;

  for (const annotation of getMessageAnnotations(lastAssistantMessage)) {
    if (annotation.type === 'codeContext') {
      codeContext = annotation as ContextAnnotation;
      break;
    } else if (annotation.type === 'chatSummary') {
      summary = annotation as ContextAnnotation;
      break;
    }
  }

  return { summary, codeContext };
}
