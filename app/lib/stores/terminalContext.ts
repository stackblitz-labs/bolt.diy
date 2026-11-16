import { atom } from 'nanostores';

export type TerminalContextKind = 'selection' | 'last-lines' | 'session' | 'command' | 'error';

export interface TerminalCommandRecord {
  id: string;
  terminalName: string;
  command: string;
  output: string;
  exitCode: number;
  createdAt: number;
}

export interface TerminalContextAttachment {
  id: string;
  terminalName: string;
  kind: TerminalContextKind;
  text: string;
  lineCount: number;
  tokenEstimate: number;
  command?: string;
  exitCode?: number;
}

export const terminalContextAttachments = atom<TerminalContextAttachment[]>([]);
export const terminalCommandHistory = atom<TerminalCommandRecord[]>([]);

const MAX_CONTEXT_CHARS = 24_000;
const MAX_COMMAND_HISTORY = 20;

export function addTerminalContext(options: {
  terminalName: string;
  kind: TerminalContextKind;
  text: string;
  command?: string;
  exitCode?: number;
}) {
  const safeText = truncateTerminalContext(
    redactTerminalSecrets(options.text || (options.command ? '[no terminal output captured]' : '')),
  );

  if (!safeText.trim()) {
    return;
  }

  terminalContextAttachments.set([
    ...terminalContextAttachments.get(),
    {
      id: crypto.randomUUID(),
      terminalName: options.terminalName,
      kind: options.kind,
      text: safeText,
      lineCount: safeText.split('\n').length,
      tokenEstimate: Math.ceil(safeText.length / 4),
      command: options.command ? redactTerminalSecrets(options.command) : undefined,
      exitCode: options.exitCode,
    },
  ]);
}

export function removeTerminalContext(id: string) {
  terminalContextAttachments.set(terminalContextAttachments.get().filter((item) => item.id !== id));
}

export function clearTerminalContext() {
  terminalContextAttachments.set([]);
}

export function recordTerminalCommand(options: Omit<TerminalCommandRecord, 'id' | 'createdAt'>) {
  const record: TerminalCommandRecord = {
    ...options,
    command: redactTerminalSecrets(options.command),
    output: truncateTerminalContext(redactTerminalSecrets(options.output)),
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  };
  terminalCommandHistory.set([record, ...terminalCommandHistory.get()].slice(0, MAX_COMMAND_HISTORY));
}

export function redactTerminalSecrets(value: string) {
  return value
    .replace(
      /(\b[\w]*(?:KEY|SECRET|TOKEN|PASSWORD|PASSWD|CREDENTIAL|AUTH)[\w]*\s*[:=]\s*)(["'])(.*?)\2/gi,
      '$1[REDACTED]',
    )
    .replace(/(\b[\w]*(?:KEY|SECRET|TOKEN|PASSWORD|PASSWD|CREDENTIAL|AUTH)[\w]*\s*[:=]\s*)[^\s,;]+/gi, '$1[REDACTED]')
    .replace(/(\bBearer\s+)[A-Za-z0-9._~+=-]+/gi, '$1[REDACTED]')
    .replace(/(\b(?:DATABASE_URL|POSTGRES_URL|REDIS_URL|MONGODB_URI)\s*[:=]\s*)[^\s,;]+/gi, '$1[REDACTED]')
    .replace(/(\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^:/\s]+:)[^@/\s]+(@)/gi, '$1[REDACTED]$2')
    .replace(
      /\b(?:sk[-_][A-Za-z0-9_-]{12,}|rk_live_[A-Za-z0-9_-]{12,}|AIza[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,})\b/g,
      '[REDACTED]',
    );
}

export function truncateTerminalContext(value: string) {
  if (value.length <= MAX_CONTEXT_CHARS) {
    return value;
  }

  const startLength = Math.floor(MAX_CONTEXT_CHARS * 0.65);
  const endLength = MAX_CONTEXT_CHARS - startLength;
  const omittedChars = value.length - MAX_CONTEXT_CHARS;

  return `${value.slice(0, startLength)}\n\n[… ${omittedChars.toLocaleString()} characters omitted …]\n\n${value.slice(-endLength)}`;
}
