import {
  ConsoleStdout,
  Directory,
  File,
  OpenFile,
  PreopenDirectory,
  WASI,
  WASIProcExit,
} from '@bjorn3/browser_wasi_shim';
import type { FileMap } from '~/lib/stores/files';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const MAX_PROJECT_BYTES = 64 * 1024 * 1024;
const MAX_RESULT_BYTES = 1_000_000;
const MAX_FILE_BYTES = 512 * 1024;

let compiledWasm: Promise<WebAssembly.Module> | undefined;

function utf8ByteOffsetToUtf16Index(text: string, byteOffset: number): number {
  let bytes = 0;
  let utf16Index = 0;

  for (const character of text) {
    if (bytes >= byteOffset) {
      break;
    }

    const codePoint = character.codePointAt(0) ?? 0;
    bytes += codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
    utf16Index += character.length;
  }

  return utf16Index;
}

async function getRipgrepModule() {
  compiledWasm ??= fetch('/rg.wasm')
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Ripgrep WASM could not be loaded (${response.status}).`);
      }

      return WebAssembly.compile(await response.arrayBuffer());
    })
    .catch((error) => {
      compiledWasm = undefined;
      throw error;
    });
  return compiledWasm;
}

function buildFilesystem(files: FileMap, projectRoot: string) {
  const root = new Directory([]);

  let totalBytes = 0;

  for (const [absolutePath, entry] of Object.entries(files)) {
    if (entry?.type !== 'file' || entry.isBinary) {
      continue;
    }

    const relative = absolutePath.slice(projectRoot.length).replace(/^\//, '');

    if (!relative || relative.startsWith('../') || relative.includes('\0')) {
      continue;
    }

    const parts = relative.split('/');

    let directory = root;

    for (const part of parts.slice(0, -1)) {
      const existing = directory.contents.get(part);

      if (existing instanceof Directory) {
        directory = existing;
      } else {
        const child = new Directory([]);
        directory.contents.set(part, child);
        directory = child;
      }
    }

    const bytes = encoder.encode(entry.content);
    totalBytes += bytes.byteLength;

    if (totalBytes > MAX_PROJECT_BYTES) {
      throw new Error(`Ripgrep indexing stopped at the ${MAX_PROJECT_BYTES}-byte project limit.`);
    }

    directory.contents.set(parts[parts.length - 1], new File(bytes, { readonly: true }));
  }

  /*
   * Ripgrep only applies .gitignore when it finds a repository boundary. The
   * project filesystem may not have Git initialized, so provide an empty marker
   * directory while retaining all project ignore files in the mirrored tree.
   */
  root.contents.set('.git', new Directory([]));

  return new PreopenDirectory('project', root.contents);
}

export interface RipgrepOptions {
  query: string;
  path?: string;
  limit?: number;
  files: FileMap;
  projectRoot: string;
  signal?: AbortSignal;
  caseInsensitive?: boolean;
}

export async function searchWithRipgrep({
  query,
  path = '.',
  limit = 50,
  files,
  projectRoot,
  signal,
  caseInsensitive = false,
}: RipgrepOptions) {
  if (signal?.aborted) {
    throw new DOMException('Search was cancelled.', 'AbortError');
  }

  const stdout: string[] = [];

  let outputBytes = 0;
  let truncated = false;
  let resultCount = 0;

  const stop = (reason: 'limit' | 'output') => {
    throw new Error(`RIPGREP_STOP:${reason}`);
  };
  const output = (bytes: Uint8Array) => {
    if (signal?.aborted) {
      throw new DOMException('Search was cancelled.', 'AbortError');
    }

    outputBytes += bytes.byteLength;

    if (outputBytes > MAX_RESULT_BYTES) {
      truncated = true;
      stop('output');
    }

    const text = decoder.decode(bytes);
    stdout.push(text);

    for (const line of text.split('\n')) {
      if (line.startsWith('{') && line.includes('"type":"match"') && ++resultCount >= limit) {
        truncated = true;
        stop('limit');
      }
    }
  };

  const filesystem = buildFilesystem(files, projectRoot);

  const wasi = new WASI(
    [
      'rg',
      '--json',
      '--fixed-strings',
      '--glob',
      '!**/node_modules/**',
      '--glob',
      '!**/package-lock.json',
      '--glob',
      '!**/dist/**',
      '--glob',
      '!**/*.lock',
      '--max-columns',
      '400',
      '--max-columns-preview',
      '--max-filesize',
      `${MAX_FILE_BYTES}`,
      ...(caseInsensitive ? ['--ignore-case'] : []),
      '--',
      query,
      `project/${path === '.' ? '' : path}`,
    ],
    [],
    [new OpenFile(new File([])), new ConsoleStdout(output), new ConsoleStdout(output), filesystem],
  );

  const module = await getRipgrepModule();
  const instance = await WebAssembly.instantiate(module, { wasi_snapshot_preview1: wasi.wasiImport });

  try {
    wasi.start(instance as unknown as { exports: { memory: WebAssembly.Memory; _start: () => unknown } });
  } catch (error) {
    if (error instanceof WASIProcExit) {
      if (error.code > 1) {
        throw new Error(`Ripgrep failed with exit code ${error.code}.`);
      }
    } else if (!(error instanceof Error) || !error.message.startsWith('RIPGREP_STOP:')) {
      throw error;
    }
  }

  const allMatches = stdout
    .join('')
    .split('\n')
    .filter(Boolean)
    .flatMap((line) => {
      try {
        const item = JSON.parse(line) as {
          type?: string;
          data?: {
            path?: { text?: string };
            lines?: { text?: string };
            line_number?: number;
            submatches?: Array<{ start?: number; end?: number; match?: { text?: string } }>;
          };
        };

        if (item.type !== 'match' || !item.data?.path?.text) {
          return [];
        }

        const lineText = item.data.lines?.text ?? '';
        const firstSubmatch = item.data.submatches?.[0];

        return [
          {
            path: item.data.path.text.replace(/^project\//, '').replace(/^\.\//, ''),
            line: item.data.line_number,
            text: lineText.slice(0, 1000),
            matchCharStart: utf8ByteOffsetToUtf16Index(lineText, firstSubmatch?.start ?? 0),
            matchCharEnd: utf8ByteOffsetToUtf16Index(lineText, firstSubmatch?.end ?? 0),
            matches: (item.data.submatches ?? []).map((submatch) => submatch.match?.text).filter(Boolean),
          },
        ];
      } catch {
        return [];
      }
    });

  truncated ||= allMatches.length > limit;

  const matches = allMatches.slice(0, limit);

  return { matches, truncated, resultCount: matches.length, exitCode: matches.length > 0 ? 0 : 1 };
}
