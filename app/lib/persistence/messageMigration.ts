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

/**
 * Any message shape this codebase can hand to an accessor: a v5+ message with
 * `parts`, or a v4 message still carrying `content` / `annotations` /
 * `experimental_attachments`. Every accessor below accepts both, so call sites
 * can move off v4 one file at a time while the app is still on ai@4.
 */
export type AnyMessage = {
  id?: string;
  role?: string;
  parts?: unknown;
  content?: unknown;
  annotations?: unknown;
  metadata?: unknown;
  experimental_attachments?: unknown;
  toolInvocations?: unknown;
  reasoning?: unknown;
};

function partsOf(message: AnyMessage): Record<string, any>[] {
  return Array.isArray(message.parts) ? (message.parts as Record<string, any>[]) : [];
}

/**
 * Concatenated text of a message. Joins every text part rather than taking the
 * first, so a message split across parts renders as one string. Falls back to
 * v4 `content` when `parts` is absent.
 */
export function getMessageText(message: AnyMessage): string {
  const parts = partsOf(message);

  if (parts.length > 0) {
    return parts
      .filter((part) => part?.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text)
      .join('');
  }

  if (Array.isArray(message.content)) {
    return (message.content as Record<string, any>[])
      .filter((item) => item?.type === 'text' && typeof item.text === 'string')
      .map((item) => item.text)
      .join('');
  }

  return typeof message.content === 'string' ? message.content : '';
}

/*
 * First text segment only, not the whole thing. llm/utils.ts scans this for the
 * [Model: ...] marker while stripping that marker from every text part, so
 * joining instead of taking the first would change which text the anchored
 * MODEL_REGEX sees.
 */
export function getFirstTextPart(message: AnyMessage): string {
  const parts = partsOf(message);

  if (parts.length > 0) {
    const first = parts.find((part) => part?.type === 'text' && typeof part.text === 'string');

    return (first?.text as string) ?? '';
  }

  if (Array.isArray(message.content)) {
    const first = (message.content as Record<string, any>[]).find(
      (item) => item?.type === 'text' && typeof item.text === 'string',
    );

    return (first?.text as string) ?? '';
  }

  return typeof message.content === 'string' ? message.content : '';
}

/**
 * The message's part array, whether v5 `parts` or a v4 `content`-as-array.
 * Returns `undefined` for the v4 string-content shape, which has no parts.
 */
export function getMessageParts(message: AnyMessage): Record<string, any>[] | undefined {
  const parts = partsOf(message);

  if (parts.length > 0) {
    return parts;
  }

  if (Array.isArray(message.content)) {
    return message.content as Record<string, any>[];
  }

  return undefined;
}

export function isToolPart(part: unknown): boolean {
  if (!part || typeof part !== 'object') {
    return false;
  }

  const typed = part as Record<string, unknown>;

  return typed.type === 'tool-invocation' || (typeof typed.type === 'string' && typed.type.startsWith('tool-'));
}

export function isFilePart(part: unknown): boolean {
  return Boolean(part) && typeof part === 'object' && (part as Record<string, unknown>).type === 'file';
}

/**
 * Tool name from either a flat v5 `tool-${name}` part or a nested v4
 * `toolInvocation.toolName`.
 */
export function getToolName(part: unknown): string | undefined {
  if (!part || typeof part !== 'object') {
    return undefined;
  }

  const typed = part as Record<string, any>;

  if (typed.toolInvocation?.toolName) {
    return typed.toolInvocation.toolName;
  }

  /*
   * 'tool-invocation' is the v4 discriminant and also starts with 'tool-', so
   * it has to be excluded before the v5 prefix can be sliced. Without this the
   * v4 name comes back as the literal string 'invocation'.
   */
  if (typeof typed.type === 'string' && typed.type !== 'tool-invocation' && typed.type.startsWith('tool-')) {
    return typed.type.slice('tool-'.length);
  }

  return typed.toolName;
}

export function getToolCallId(part: unknown): string | undefined {
  if (!part || typeof part !== 'object') {
    return undefined;
  }

  const typed = part as Record<string, any>;

  return typed.toolCallId ?? typed.toolInvocation?.toolCallId;
}

/**
 * Normalised tool state. v4 nested states map onto their v5 equivalents so
 * callers compare against one vocabulary.
 */
export function getToolState(part: unknown): BoltToolState | undefined {
  if (!part || typeof part !== 'object') {
    return undefined;
  }

  const typed = part as Record<string, any>;
  const state = typed.state ?? typed.toolInvocation?.state;

  if (typeof state !== 'string') {
    return undefined;
  }

  if (state in TOOL_STATE_MAP) {
    return TOOL_STATE_MAP[state as LegacyToolInvocation['state']];
  }

  return state as BoltToolState;
}

export function getToolInput(part: unknown): unknown {
  if (!part || typeof part !== 'object') {
    return undefined;
  }

  const typed = part as Record<string, any>;

  return typed.input ?? typed.toolInvocation?.args;
}

export function getToolOutput(part: unknown): unknown {
  if (!part || typeof part !== 'object') {
    return undefined;
  }

  const typed = part as Record<string, any>;

  return typed.output ?? typed.toolInvocation?.result;
}

export function isToolCallPart(part: unknown): boolean {
  const state = getToolState(part);

  return state === 'input-available' || state === 'input-streaming';
}

export function isToolResultPart(part: unknown): boolean {
  const state = getToolState(part);

  return state === 'output-available' || state === 'output-error' || state === 'output-denied';
}

/**
 * Full data URL for a file part. v4 `FileUIPart` stored bare base64 in `data`,
 * while v5 stores a complete data URL in `url`; v5 consumers call `new URL()`
 * on this, so bare base64 has to be rebuilt here rather than passed through.
 */
export function getFileUrl(part: unknown): string | undefined {
  if (!isFilePart(part)) {
    return undefined;
  }

  const typed = part as Record<string, any>;
  const mediaType = typed.mediaType ?? typed.mimeType;
  const raw = typed.url ?? typed.data;

  if (typeof raw !== 'string') {
    return undefined;
  }

  if (raw.startsWith('data:') || !mediaType) {
    return raw;
  }

  return `data:${mediaType};base64,${raw}`;
}

export function getFileMediaType(part: unknown): string | undefined {
  if (!isFilePart(part)) {
    return undefined;
  }

  const typed = part as Record<string, any>;

  return typed.mediaType ?? typed.mimeType;
}

/**
 * Bolt's per-message string sentinels. v4 kept `'no-store'` and `'hidden'` as
 * string entries in `annotations`; v5 removed `annotations`, so they move to
 * `metadata.flags`.
 */
export function getMessageFlags(message: AnyMessage): string[] {
  const metadata = message.metadata;

  if (metadata && typeof metadata === 'object') {
    const flags = (metadata as Record<string, unknown>).flags;

    if (Array.isArray(flags)) {
      return flags.filter((flag): flag is string => typeof flag === 'string');
    }
  }

  if (Array.isArray(message.annotations)) {
    return message.annotations.filter((flag): flag is string => typeof flag === 'string');
  }

  return [];
}

export function hasMessageFlag(message: AnyMessage, flag: string): boolean {
  return getMessageFlags(message).includes(flag);
}

/**
 * Bolt's annotation objects, read from v5 `data-${name}` parts or v4 object
 * entries in `annotations`. Returned as `{ type, ...payload }` so callers can
 * keep matching on `.type` regardless of which shape is on disk.
 */
export function getMessageAnnotations(message: AnyMessage): { type: string; value?: unknown; [key: string]: any }[] {
  const dataParts = partsOf(message).filter((part) => typeof part?.type === 'string' && part.type.startsWith('data-'));

  if (dataParts.length > 0) {
    return dataParts.map((part) => {
      const data = part.data;

      return data && typeof data === 'object' && !Array.isArray(data)
        ? { type: part.type.slice('data-'.length), ...(data as Record<string, unknown>) }
        : { type: part.type.slice('data-'.length), value: data };
    });
  }

  if (!Array.isArray(message.annotations)) {
    return [];
  }

  return message.annotations
    .filter((annotation) => annotation && typeof annotation === 'object' && !Array.isArray(annotation))
    .filter((annotation) => typeof (annotation as Record<string, unknown>).type === 'string')
    .map((annotation) => annotation as Record<string, any> & { type: string });
}
