/**
 * Converts AI SDK v4 messages to the v5+ `UIMessage` shape.
 *
 * This module deliberately declares its own types instead of importing from `ai`,
 * so it compiles unchanged both before and after the v7 bump. Nothing here should
 * ever reference the `ai` package.
 */

export type BoltToolState =
  | 'input-streaming'
  | 'input-available'
  | 'approval-requested'
  | 'approval-responded'
  | 'output-available'
  | 'output-error'
  | 'output-denied';

export interface BoltTextPart {
  type: 'text';
  text: string;
}

export interface BoltReasoningPart {
  type: 'reasoning';
  text: string;
  id?: string;
  state?: 'streaming' | 'done';
}

export interface BoltToolPart {
  type: `tool-${string}`;
  toolCallId: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  state?: BoltToolState;
  providerExecuted?: boolean;
}

export interface BoltSourcePart {
  type: 'source-url';
  sourceId: string;
  url: string;
  title?: string;
}

export interface BoltFilePart {
  type: 'file';
  mediaType: string;
  filename?: string;
  url: string;
}

export interface BoltStepStartPart {
  type: 'step-start';
}

export interface BoltDataPart {
  type: `data-${string}`;
  id?: string;
  data: unknown;
}

export type BoltPart =
  BoltTextPart | BoltReasoningPart | BoltToolPart | BoltSourcePart | BoltFilePart | BoltStepStartPart | BoltDataPart;

export interface BoltUIMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  parts: BoltPart[];
  metadata?: { flags?: string[] } & Record<string, unknown>;
  name?: string;
  function_call?: unknown;
  timestamp?: number;
}

export interface LegacyToolInvocation {
  toolCallId: string;
  toolName: string;
  args: unknown;
  result?: unknown;
  state: 'partial-call' | 'call' | 'result';
}

export interface LegacyAttachment {
  name?: string;
  contentType: string;
  url: string;
}

export interface LegacyV4Message {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'data';
  content?: string;
  reasoning?: string;
  parts?: unknown[];
  annotations?: unknown[];
  toolInvocations?: LegacyToolInvocation[];
  experimental_attachments?: LegacyAttachment[];
  data?: unknown;
  name?: string;
  function_call?: unknown;
  timestamp?: number;
}

const TOOL_STATE_MAP: Record<LegacyToolInvocation['state'], BoltToolState> = {
  'partial-call': 'input-streaming',
  call: 'input-available',
  result: 'output-available',
};

export function isLegacyV4Message(message: unknown): message is LegacyV4Message {
  if (!message || typeof message !== 'object') {
    return false;
  }

  const candidate = message as LegacyV4Message & { parts?: unknown[] };

  if (candidate.parts == null) {
    return true;
  }

  if (!Array.isArray(candidate.parts)) {
    return false;
  }

  return candidate.parts.some((part) => {
    if (!part || typeof part !== 'object') {
      return false;
    }

    const typed = part as Record<string, unknown>;

    if (typed.type === 'tool-invocation' || typed.type === 'reasoning' || typed.type === 'source') {
      return true;
    }

    if (typed.type === 'file') {
      return 'mimeType' in typed || 'data' in typed;
    }

    return 'args' in typed || 'result' in typed || 'toolInvocation' in typed;
  });
}

function toDataUrl(mediaType: string, data: string): string {
  if (data.startsWith('data:')) {
    return data;
  }

  return `data:${mediaType};base64,${data}`;
}

function convertToolInvocation(invocation: LegacyToolInvocation): BoltToolPart {
  const converted: BoltToolPart = {
    type: `tool-${invocation.toolName}`,
    toolCallId: invocation.toolCallId,
    state: TOOL_STATE_MAP[invocation.state],
  };

  if (invocation.args !== undefined) {
    converted.input = invocation.args;
  }

  if (invocation.state === 'result' && invocation.result !== undefined) {
    converted.output = invocation.result;
  }

  return converted;
}

function convertPart(part: unknown): BoltPart | null {
  if (!part || typeof part !== 'object') {
    return null;
  }

  const typed = part as Record<string, any>;

  switch (typed.type) {
    case 'text':
      return { type: 'text', text: typed.text ?? '' };

    case 'reasoning': {
      const text = typed.text ?? typed.reasoning ?? '';

      return text ? { type: 'reasoning', text } : null;
    }

    case 'tool-invocation':
      return typed.toolInvocation ? convertToolInvocation(typed.toolInvocation) : null;

    case 'source': {
      const source = typed.source ?? {};

      if (!source.url) {
        return null;
      }

      return {
        type: 'source-url',
        sourceId: source.id ?? source.url,
        url: source.url,
        title: source.title,
      };
    }

    case 'file': {
      const mediaType = typed.mediaType ?? typed.mimeType;

      if (!mediaType || (!typed.url && !typed.data)) {
        return null;
      }

      return {
        type: 'file',
        mediaType,
        filename: typed.filename,
        url: toDataUrl(mediaType, typed.url ?? typed.data),
      };
    }

    case 'step-start':
      return { type: 'step-start' };

    default:
      if (typeof typed.toolName === 'string' && typed.toolCallId) {
        return {
          type: `tool-${typed.toolName}`,
          toolCallId: typed.toolCallId,
          input: typed.input ?? typed.args,
          output: typed.output ?? typed.result,
          state: typed.state,
        };
      }

      if (typeof typed.text === 'string') {
        return { type: 'text', text: typed.text };
      }

      return null;
  }
}

function convertAnnotation(annotation: unknown): BoltDataPart | null {
  if (!annotation || typeof annotation !== 'object' || Array.isArray(annotation)) {
    return null;
  }

  const typed = annotation as Record<string, unknown>;
  const name = typed.type;

  if (typeof name !== 'string' || !name) {
    return null;
  }

  const { type: _type, ...data } = typed;

  return { type: `data-${name}`, data };
}

function convertAttachment(attachment: LegacyAttachment): BoltFilePart | null {
  if (!attachment?.url) {
    return null;
  }

  return {
    type: 'file',
    mediaType: attachment.contentType,
    filename: attachment.name,
    url: attachment.url,
  };
}

export function migrateLegacyMessage(message: LegacyV4Message): BoltUIMessage {
  const flags: string[] = [];
  const dataParts: BoltDataPart[] = [];

  for (const annotation of message.annotations ?? []) {
    if (typeof annotation === 'string') {
      flags.push(annotation);
      continue;
    }

    const converted = convertAnnotation(annotation);

    if (converted) {
      dataParts.push(converted);
    }
  }

  const parts: BoltPart[] = [];

  if (message.parts?.length) {
    for (const part of message.parts) {
      const converted = convertPart(part);

      if (converted) {
        parts.push(converted);
      }
    }
  } else {
    if (message.reasoning) {
      parts.push({ type: 'reasoning', text: message.reasoning });
    }

    for (const invocation of message.toolInvocations ?? []) {
      parts.push(convertToolInvocation(invocation));
    }
  }

  const hasTextPart = parts.some((part) => part.type === 'text');

  if (!hasTextPart && typeof message.content === 'string') {
    if (message.content.length > 0) {
      parts.push({ type: 'text', text: message.content });
    }
  }

  for (const attachment of message.experimental_attachments ?? []) {
    const converted = convertAttachment(attachment);

    if (converted) {
      parts.push(converted);
    }
  }

  parts.push(...dataParts);

  const converted: BoltUIMessage = {
    id: message.id,
    role: message.role === 'data' ? 'assistant' : message.role,
    parts,
  };

  if (message.role === 'data' && message.data !== undefined) {
    parts.push({ type: 'data-message', data: message.data });
  }

  if (flags.length > 0) {
    converted.metadata = { ...converted.metadata, flags };
  }

  if (message.name !== undefined) {
    converted.name = message.name;
  }

  if (message.function_call !== undefined) {
    converted.function_call = message.function_call;
  }

  if (message.timestamp !== undefined) {
    converted.timestamp = message.timestamp;
  }

  return converted;
}

export function migrateLegacyMessages(messages: unknown): BoltUIMessage[] {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages.map((message) =>
    isLegacyV4Message(message) ? migrateLegacyMessage(message) : (message as BoltUIMessage),
  );
}

export function getMessageText(message: Pick<BoltUIMessage, 'parts'>): string {
  return message.parts
    .filter((part): part is BoltTextPart => part.type === 'text')
    .map((part) => part.text)
    .join('');
}
