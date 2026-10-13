import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { assertValidProjectSource, getFileRevision } from './projectFileValidation';
import { PROJECT_TOOL_NAMES, projectToolDefinitions } from './projectMcp.shared';
export { PROJECT_TOOL_NAMES, projectToolDefinitions } from './projectMcp.shared';
import { searchWithRipgrep } from './ripgrepClient';
import { chatId } from '~/lib/persistence/useChatHistory';
import { workbenchStore } from '~/lib/stores/workbench';
import { webcontainer } from '~/lib/webcontainer';
import { WORK_DIR } from '~/utils/constants';
import { path } from '~/utils/path';

const MAX_TEXT_BYTES = 256_000;
const MAX_LIST_RESULTS = 500;
const MAX_OUTPUT_CHARS = 32_000;

interface ProcessRecord {
  command: string;
  purpose: 'run' | 'test' | 'install' | 'other';
  process: Awaited<ReturnType<Awaited<typeof webcontainer>['spawn']>>;
  output: string;
  exitCode?: number;
  done: Promise<void>;
  truncated: boolean;
  outputDone: boolean;
}

const processes = new Map<string, ProcessRecord>();
const MAX_PROCESSES = 50;

workbenchStore.projectGeneration.listen((current, previous) => {
  if (current === previous) {
    return;
  }

  for (const record of processes.values()) {
    if (record.exitCode === undefined) {
      try {
        record.process.kill();
      } catch {
        /* process may already have exited */
      }
    }
  }
  processes.clear();
});

chatId.listen(() => {
  workbenchStore.projectGeneration.set(workbenchStore.projectGeneration.get() + 1);
});

function queueMutation<T>(operation: () => Promise<T>): Promise<T> {
  return workbenchStore.queueProjectMutation(operation);
}

function projectPath(input: unknown, allowRoot = false): { relative: string; absolute: string } {
  if (typeof input !== 'string' || !input.trim() || input.includes('\0')) {
    throw new Error('A non-empty project-relative path is required.');
  }

  const normalized = path.normalize(input.trim().replace(/\\/g, '/'));

  if (
    (path.isAbsolute(normalized) && normalized !== WORK_DIR && !normalized.startsWith(`${WORK_DIR}/`)) ||
    normalized === '..' ||
    normalized.startsWith('../')
  ) {
    throw new Error(`Path must stay inside the project: ${input}`);
  }

  const relative = (path.isAbsolute(normalized) ? path.relative(WORK_DIR, normalized) : normalized)
    .replace(/^\.\//, '')
    .replace(/\/$/, '');

  if (allowRoot && (!relative || relative === '.')) {
    return { relative: '.', absolute: WORK_DIR };
  }

  if (!relative || relative.split('/').some((part) => part === '..' || part === '.')) {
    throw new Error(`Invalid project path: ${input}`);
  }

  return { relative, absolute: path.join(WORK_DIR, relative) };
}

function assertUnlocked(filePath: string, directory = false) {
  const locked = directory ? workbenchStore.isFolderLocked(filePath) : workbenchStore.isFileLocked(filePath);

  if ('locked' in locked && locked.locked) {
    throw new Error(`The path is locked${locked.lockedBy ? ` by ${locked.lockedBy}` : ''}: ${filePath}`);
  }

  if ('isLocked' in locked && locked.isLocked) {
    throw new Error(`The path is locked${locked.lockedBy ? ` by ${locked.lockedBy}` : ''}: ${filePath}`);
  }

  let parent = path.dirname(filePath);

  while (parent === WORK_DIR || parent.startsWith(`${WORK_DIR}/`)) {
    const parentLock = workbenchStore.isFolderLocked(parent);

    if (parentLock.isLocked) {
      throw new Error(`The path is locked${parentLock.lockedBy ? ` by ${parentLock.lockedBy}` : ''}: ${parent}`);
    }

    if (parent === WORK_DIR) {
      break;
    }

    const next = path.dirname(parent);

    if (next === parent) {
      break;
    }

    parent = next;
  }
}

async function readText(relative: string): Promise<string> {
  const wc = await webcontainer;
  const bytes = await wc.fs.readFile(relative);

  if (bytes.byteLength > MAX_TEXT_BYTES) {
    throw new Error(`File exceeds the ${MAX_TEXT_BYTES}-byte text limit.`);
  }

  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);

  return text;
}

function isNotFoundError(error: unknown): boolean {
  return (
    (typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 'ENOENT') ||
    (error instanceof Error && error.message.includes('ENOENT'))
  );
}

function success(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data) }],
    structuredContent: data as Record<string, unknown>,
  };
}

function failure(error: unknown) {
  const message =
    error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
      ? error.message
      : String(error);
  return { isError: true, content: [{ type: 'text' as const, text: message.slice(0, 4000) }] };
}

function processResult(processId: string, record: ProcessRecord, reused = false) {
  const failed = record.exitCode !== undefined && record.exitCode !== 0;

  const data = {
    processId,
    command: record.command,
    purpose: record.purpose,
    output: record.output,
    status: record.exitCode === undefined ? 'running' : 'exited',
    exitCode: record.exitCode,
    outputStream: 'combined',
    truncated: record.truncated,
    previewReady: workbenchStore.previews.get().some((preview) => preview.ready),
    ...(reused ? { reused: true } : {}),
    ...(failed ? { isError: true, error: `Command exited with code ${record.exitCode}.` } : {}),
  };

  return { ...success(data), ...(failed ? { isError: true } : {}) };
}

async function waitForProcess(record: ProcessRecord, timeoutMs: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    await Promise.race([
      record.process.exit
        .then((exitCode) => {
          record.exitCode = exitCode;
          return record.done;
        })
        .catch(() => record.done),
      new Promise((resolve) => {
        timer = setTimeout(resolve, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function assertNotAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException('Tool call was cancelled before it started.', 'AbortError');
  }
}

const OUTPUT_TRUNCATION_MARKER = '[earlier output truncated]\n';

function appendOutput(record: ProcessRecord, chunk: string) {
  const previous = record.output.startsWith(OUTPUT_TRUNCATION_MARKER)
    ? record.output.slice(OUTPUT_TRUNCATION_MARKER.length)
    : record.output;

  const joined = previous + chunk;
  record.truncated ||= joined.length > MAX_OUTPUT_CHARS;
  record.output = record.truncated
    ? `${OUTPUT_TRUNCATION_MARKER}${joined.slice(-(MAX_OUTPUT_CHARS - OUTPUT_TRUNCATION_MARKER.length))}`
    : joined;
}

/** Build a genuine local MCP client/server pair for active project operations. */
export async function createProjectMcpBridge() {
  const bridgeProjectGeneration = workbenchStore.projectGeneration.get();
  const bridgeChatId = chatId.get();

  const assertProjectCurrent = () => {
    if (workbenchStore.projectGeneration.get() !== bridgeProjectGeneration || chatId.get() !== bridgeChatId) {
      throw new Error('The active project changed before this tool could finish.');
    }
  };

  const server = new McpServer({ name: 'bolt-project', version: '1.0.0' });

  server.registerTool(
    'project_read_file',
    { description: projectToolDefinitions.project_read_file.description, inputSchema: { path: z.string().min(1) } },
    async ({ path: input }) => {
      try {
        const target = projectPath(input);
        await workbenchStore.waitForExecutionQueue();
        assertProjectCurrent();

        const content = await readText(target.relative);
        assertProjectCurrent();

        return success({ path: target.relative, content, revision: await getFileRevision(content), truncated: false });
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    'project_write_file',
    {
      description: projectToolDefinitions.project_write_file.description,
      inputSchema: {
        path: z.string().min(1),
        content: z.string(),
        overwrite: z.boolean().optional(),
        replacementReason: z.string().trim().min(1).max(500).optional(),
      },
    },
    async ({ path: input, content, overwrite, replacementReason }, extra) => {
      try {
        if (new TextEncoder().encode(content).byteLength > MAX_TEXT_BYTES) {
          throw new Error('Content exceeds the text file size limit.');
        }

        const target = projectPath(input);

        let created = false;
        let changed = false;
        await queueMutation(async () => {
          assertNotAborted(extra.signal);
          assertProjectCurrent();

          const current = workbenchStore.files.get()[target.absolute];
          created = current?.type !== 'file';

          if (!current) {
            try {
              const wc = await webcontainer;
              await wc.fs.readFile(target.relative);
              throw new Error('File exists on disk but is not tracked by the workbench.');
            } catch (error) {
              if (!isNotFoundError(error)) {
                throw error;
              }
            }
          }

          assertNotAborted(extra.signal);

          if (current && current.type !== 'file') {
            throw new Error('The target path is a directory.');
          }

          if (current && overwrite === false) {
            throw new Error('File already exists. Set overwrite to true to replace it.');
          }

          assertUnlocked(target.absolute);
          changed = current?.type !== 'file' || current.content !== content;

          if (!changed) {
            return;
          }

          if (current?.type === 'file' && !replacementReason) {
            throw new Error(
              'Cannot overwrite existing file without replacementReason. Either: (1) Use project_patch_file to make targeted edits by reading the file first and using expectedRevision, OR (2) Provide a replacementReason parameter explaining why a full file replacement is necessary (e.g., "Complete restructure", "Generated from scratch", "Fundamental architecture change").',
            );
          }

          await assertValidProjectSource(target.relative, content);
          assertNotAborted(extra.signal);
          assertProjectCurrent();

          if (current?.type === 'file') {
            await workbenchStore.saveFileContent(target.absolute, content);
          } else {
            await workbenchStore.createFile(target.absolute, content);
          }
        });

        return success({ path: target.relative, written: true, created, changed, generation: bridgeProjectGeneration });
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    'project_patch_file',
    {
      description: projectToolDefinitions.project_patch_file.description,
      inputSchema: {
        path: z.string().min(1),
        expectedContent: z.string().optional(),
        expectedRevision: z
          .string()
          .regex(/^[a-f0-9]{64}$/)
          .optional(),
        oldText: z.string().min(1),
        newText: z.string(),
      },
    },
    async ({ path: input, expectedContent, expectedRevision, oldText, newText }, extra) => {
      try {
        const target = projectPath(input);

        return await queueMutation(async () => {
          assertNotAborted(extra.signal);
          assertUnlocked(target.absolute);

          const content = await readText(target.relative);
          assertNotAborted(extra.signal);
          assertProjectCurrent();

          if (expectedContent === undefined && expectedRevision === undefined) {
            throw new Error('Read the file first, then supply its revision as expectedRevision.');
          }

          if (
            (expectedRevision !== undefined && (await getFileRevision(content)) !== expectedRevision) ||
            (expectedContent !== undefined && content !== expectedContent)
          ) {
            throw new Error(
              'Patch conflict: the file changed or expectedContent was copied incorrectly. Read the file again and use its revision as expectedRevision; do not repeat the stale patch.',
            );
          }

          const first = content.indexOf(oldText);

          if (first < 0) {
            throw new Error('Patch conflict: oldText was not found.');
          }

          if (content.indexOf(oldText, first + oldText.length) >= 0) {
            throw new Error('Patch conflict: oldText is ambiguous; it must match exactly once.');
          }

          const updated = content.slice(0, first) + newText + content.slice(first + oldText.length);

          if (new TextEncoder().encode(updated).byteLength > MAX_TEXT_BYTES) {
            throw new Error('Patched file exceeds the text file size limit.');
          }

          assertProjectCurrent();

          const changed = updated !== content;

          if (changed) {
            await assertValidProjectSource(target.relative, updated);
            assertNotAborted(extra.signal);
            assertProjectCurrent();
            await workbenchStore.saveFileContent(target.absolute, updated);
          }

          return success({ path: target.relative, patched: true, changed, generation: bridgeProjectGeneration });
        });
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    'project_create_directory',
    {
      description: projectToolDefinitions.project_create_directory.description,
      inputSchema: { path: z.string().min(1) },
    },
    async ({ path: input }, extra) => {
      try {
        const target = projectPath(input);
        await queueMutation(() => {
          assertNotAborted(extra.signal);
          assertProjectCurrent();
          assertUnlocked(target.absolute, true);

          return workbenchStore.createFolder(target.absolute);
        });

        return success({ path: target.relative, created: true, generation: bridgeProjectGeneration });
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    'project_delete_path',
    {
      description: projectToolDefinitions.project_delete_path.description,
      inputSchema: { path: z.string().min(1), recursive: z.boolean().optional() },
    },
    async ({ path: input, recursive }, extra) => {
      try {
        const target = projectPath(input);
        await queueMutation(async () => {
          assertNotAborted(extra.signal);
          assertProjectCurrent();

          const current = workbenchStore.files.get()[target.absolute];

          if (!current) {
            throw new Error(`Path does not exist: ${target.relative}`);
          }

          assertUnlocked(target.absolute, current.type === 'folder');

          if (current.type === 'folder') {
            if (!recursive) {
              throw new Error('Deleting a directory requires recursive: true.');
            }

            const entries = Object.entries(workbenchStore.files.get());

            for (const [entryPath] of entries) {
              if (entryPath === target.absolute || entryPath.startsWith(`${target.absolute}/`)) {
                assertUnlocked(entryPath, workbenchStore.files.get()[entryPath]?.type === 'folder');
              }
            }
          }

          assertNotAborted(extra.signal);

          if (current.type === 'folder') {
            await workbenchStore.deleteFolder(target.absolute);
          } else {
            await workbenchStore.deleteFile(target.absolute);
          }
        });

        return success({ path: target.relative, deleted: true, generation: bridgeProjectGeneration });
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    'project_list_paths',
    {
      description: projectToolDefinitions.project_list_paths.description,
      inputSchema: { path: z.string().optional(), limit: z.number().int().min(1).max(MAX_LIST_RESULTS).optional() },
    },
    async ({ path: prefix = '', limit = MAX_LIST_RESULTS }) => {
      try {
        const relative = prefix ? projectPath(prefix, true).relative : '.';
        const safePrefix = relative === '.' ? '' : relative;
        await workbenchStore.waitForExecutionQueue();
        assertProjectCurrent();

        const entries = Object.entries(workbenchStore.files.get())
          .filter(
            ([entryPath, entry]) =>
              entry && (!safePrefix || entryPath.slice(`${WORK_DIR}/`.length).startsWith(safePrefix)),
          )
          .slice(0, limit)
          .map(([entryPath, entry]) => ({ path: entryPath.slice(`${WORK_DIR}/`.length), type: entry!.type }));

        return success({ entries, truncated: entries.length === limit });
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    'project_search_content',
    {
      description: projectToolDefinitions.project_search_content.description,
      inputSchema: {
        query: z.string().min(1),
        path: z.string().optional(),
        limit: z.number().int().min(1).max(200).optional(),
      },
    },
    async ({ query, path: input = '.', limit = 50 }, extra) => {
      try {
        const safePath = projectPath(input, true).relative;
        await workbenchStore.waitForExecutionQueue();
        assertProjectCurrent();

        const result = await searchWithRipgrep(
          {
            query,
            path: safePath,
            limit,
            files: workbenchStore.files.get(),
            projectRoot: WORK_DIR,
          },
          extra.signal,
        );
        assertProjectCurrent();

        return success(result);
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    'project_find_related_files',
    {
      description: projectToolDefinitions.project_find_related_files.description,
      inputSchema: { path: z.string().min(1), limit: z.number().int().min(1).max(100).optional() },
    },
    async ({ path: input, limit = 20 }) => {
      try {
        const target = projectPath(input);
        assertProjectCurrent();
        await workbenchStore.waitForExecutionQueue();
        assertProjectCurrent();

        const source = workbenchStore.files.get()[target.absolute];

        if (!source || source.type !== 'file') {
          throw new Error(`File does not exist: ${target.relative}`);
        }

        const parent = path.dirname(target.relative);
        const sourceName = path.basename(target.relative);
        const sourceStem = sourceName.slice(0, sourceName.length - path.extname(sourceName).length);

        const related = Object.entries(workbenchStore.files.get())
          .filter(([candidatePath, candidate]) => candidate?.type === 'file' && candidatePath !== target.absolute)
          .map(([candidatePath]) => {
            const relative = candidatePath.slice(`${WORK_DIR}/`.length);
            const reasons: string[] = [];

            if (path.dirname(relative) === parent) {
              reasons.push('same directory');
            }

            const candidateName = path.basename(relative);
            const candidateStem = candidateName.slice(0, candidateName.length - path.extname(candidateName).length);

            if (sourceStem && candidateStem.toLowerCase() === sourceStem.toLowerCase()) {
              reasons.push('same filename stem');
            }

            return {
              path: relative,
              reasons,
              score: (reasons.includes('same filename stem') ? 2 : 0) + (reasons.includes('same directory') ? 1 : 0),
            };
          })
          .filter((entry) => entry.score > 0)
          .sort((left, right) => right.score - left.score || left.path.localeCompare(right.path))
          .slice(0, limit)
          .map(({ path: relatedPath, reasons }) => ({ path: relatedPath, reasons }));

        return success({ source: target.relative, related, truncated: related.length === limit });
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    'project_run_command',
    {
      description: projectToolDefinitions.project_run_command.description,
      inputSchema: {
        command: z.string().min(1).max(4000),
        purpose: z.enum(['run', 'test', 'install', 'other']).optional(),
      },
    },
    async ({ command, purpose = 'other' }, extra) => {
      try {
        let reused = false;

        const processId = await queueMutation(async () => {
          assertNotAborted(extra.signal);
          assertProjectCurrent();

          if (purpose === 'run') {
            const normalizeCommand = (value: string) =>
              value.trim().replace(/^cd\s+(?:\/home\/project|['"]\/home\/project['"])\s*&&\s*/, '');
            const existing = [...processes].find(
              ([, record]) =>
                record.purpose === 'run' &&
                record.exitCode === undefined &&
                normalizeCommand(record.command) === normalizeCommand(command),
            );

            if (existing) {
              reused = true;
              return existing[0];
            }
          }

          while (processes.size >= MAX_PROCESSES) {
            const completed = [...processes].find(([, record]) => record.exitCode !== undefined && record.outputDone);

            if (!completed) {
              throw new Error('Too many project processes are active. Stop one and retry.');
            }

            processes.delete(completed[0]);
          }

          const wc = await webcontainer;
          assertNotAborted(extra.signal);
          assertProjectCurrent();

          /*
           * spawn's cwd is relative to the WebContainer project root. Passing
           * wc.workdir as an absolute cwd fails with ENOENT; the default is the project.
           */
          const process = await wc.spawn('/bin/jsh', ['-c', command]);

          try {
            assertNotAborted(extra.signal);
            assertProjectCurrent();
          } catch (error) {
            process.kill();
            throw error;
          }

          const processId = crypto.randomUUID();
          workbenchStore.toggleTerminal(true);
          workbenchStore.writeToBoltTerminal(`\r\n$ ${command}\r\n`);

          const record: ProcessRecord = {
            command,
            purpose,
            process,
            output: '',
            done: Promise.resolve(),
            truncated: false,
            outputDone: false,
          };
          record.done = process.output
            .pipeTo(
              new WritableStream({
                write(chunk) {
                  appendOutput(record, chunk);

                  if (
                    workbenchStore.projectGeneration.get() === bridgeProjectGeneration &&
                    chatId.get() === bridgeChatId
                  ) {
                    workbenchStore.writeToBoltTerminal(chunk);
                  }
                },
              }),
            )
            .catch((error) => {
              appendOutput(record, `\n[output stream error: ${String(error)}]`);
            })
            .finally(() => {
              record.outputDone = true;
            });
          processes.set(processId, record);
          void process.exit
            .then(async (exitCode) => {
              record.exitCode = exitCode;
              await record.done;

              if (workbenchStore.projectGeneration.get() === bridgeProjectGeneration && chatId.get() === bridgeChatId) {
                workbenchStore.writeToBoltTerminal(`\r\n[Command exited with code ${exitCode}]\r\n`);
              }
            })
            .catch(() => {
              record.exitCode = -1;
            });

          return processId;
        });

        const record = processes.get(processId)!;
        await waitForProcess(record, 250);
        assertProjectCurrent();

        return processResult(processId, record, reused);
      } catch (error) {
        const result = failure(error);

        if (workbenchStore.projectGeneration.get() === bridgeProjectGeneration && chatId.get() === bridgeChatId) {
          workbenchStore.writeToBoltTerminal(`\r\n[Command failed: ${result.content[0].text}]\r\n`);
        }

        return result;
      }
    },
  );

  server.registerTool(
    'project_get_process_output',
    {
      description: projectToolDefinitions.project_get_process_output.description,
      inputSchema: { processId: z.string().min(1) },
    },
    async ({ processId }) => {
      const record = processes.get(processId);

      if (!record) {
        return failure(new Error(`Unknown process: ${processId}`));
      }

      await waitForProcess(record, 1000);
      assertProjectCurrent();

      return processResult(processId, record);
    },
  );

  server.registerTool(
    'project_stop_process',
    {
      description: projectToolDefinitions.project_stop_process.description,
      inputSchema: { processId: z.string().min(1) },
    },
    async ({ processId }) => {
      const record = processes.get(processId);

      if (!record) {
        return failure(new Error(`Unknown process: ${processId}`));
      }

      if (record.exitCode === undefined) {
        try {
          record.process.kill();
        } catch {
          /* process may exit between the status check and kill */
        }
      }

      await Promise.race([
        record.process.exit.then(() => record.done).catch(() => record.done),
        new Promise((resolve) => setTimeout(resolve, 1500)),
      ]);

      return success({ processId, stopped: true, command: record.command, purpose: record.purpose });
    },
  );

  server.registerTool(
    'web_search',
    {
      description: projectToolDefinitions.web_search.description,
      inputSchema: { query: z.string().min(1).max(1000), limit: z.number().int().min(1).max(10).optional() },
    },
    async ({ query, limit = 5 }, extra) => {
      try {
        const response = await fetch('/api/web-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operation: 'search', query, limit }),
          signal: extra.signal,
        });

        const body = (await response.json()) as { success?: boolean; data?: unknown; error?: string };

        if (!response.ok || !body.success) {
          throw new Error(body.error || `Web search failed (${response.status}).`);
        }

        return success(body.data);
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    'web_fetch',
    {
      description: projectToolDefinitions.web_fetch.description,
      inputSchema: { url: z.string().min(1).max(2048) },
    },
    async ({ url }, extra) => {
      try {
        const response = await fetch('/api/web-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
          signal: extra.signal,
        });

        const body = (await response.json()) as { success?: boolean; data?: unknown; error?: string };

        if (!response.ok || !body.success) {
          throw new Error(body.error || `Web fetch failed (${response.status}).`);
        }

        return success(body.data);
      } catch (error) {
        return failure(error);
      }
    },
  );

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'bolt-project-client', version: '1.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  let closed = false;

  return {
    generation: () => bridgeProjectGeneration,
    async callTool(
      name: string,
      args: Record<string, unknown>,
      options?: { signal?: AbortSignal; generation?: number; chatId?: string },
    ) {
      if (closed) {
        throw new Error('Project MCP bridge is closed.');
      }

      if (!PROJECT_TOOL_NAMES.includes(name as (typeof PROJECT_TOOL_NAMES)[number])) {
        throw new Error(`Unknown project tool: ${name}`);
      }

      if (options?.generation !== undefined && options.generation !== bridgeProjectGeneration) {
        throw new Error('The active project changed before this tool could start.');
      }

      if (options?.chatId !== undefined && options.chatId !== bridgeChatId) {
        throw new Error('The active chat changed before this tool could start.');
      }

      assertProjectCurrent();

      const result = await client.callTool({ name, arguments: args }, undefined, { signal: options?.signal });
      assertProjectCurrent();

      return result;
    },
    async close() {
      closed = true;

      for (const record of processes.values()) {
        if (record.exitCode === undefined) {
          try {
            record.process.kill();
          } catch {
            /* process may already have exited */
          }
        }
      }
      await client.close();
      await server.close();
    },
  };
}

let sharedBridge: Awaited<ReturnType<typeof createProjectMcpBridge>> | undefined;
let sharedBridgePromise: Promise<Awaited<ReturnType<typeof createProjectMcpBridge>>> | undefined;
let sharedBridgeGeneration = -1;

export async function callProjectMcpTool(
  name: string,
  args: Record<string, unknown>,
  options?: { signal?: AbortSignal; generation?: number; chatId?: string },
) {
  const currentGeneration = workbenchStore.projectGeneration.get();

  if (options?.generation !== undefined && options.generation !== currentGeneration) {
    throw new Error('The active project changed before this tool could start.');
  }

  if (options?.chatId !== undefined && options.chatId !== chatId.get()) {
    throw new Error('The active chat changed before this tool could start.');
  }

  if (sharedBridgeGeneration !== currentGeneration) {
    await closeProjectMcpBridge();
    sharedBridgeGeneration = currentGeneration;
    sharedBridgePromise = createProjectMcpBridge();
  }

  if (!sharedBridgePromise) {
    sharedBridgePromise = createProjectMcpBridge();
  }

  sharedBridge = await sharedBridgePromise;

  return sharedBridge.callTool(name, args, options);
}

export async function closeProjectMcpBridge() {
  const bridge = sharedBridge ?? (sharedBridgePromise ? await sharedBridgePromise.catch(() => undefined) : undefined);
  sharedBridge = undefined;
  sharedBridgePromise = undefined;
  sharedBridgeGeneration = -1;
  await bridge?.close();
}
