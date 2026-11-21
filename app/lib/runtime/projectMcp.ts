import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { numberProjectLines, replaceProjectLines, replaceProjectText } from './projectFilePatch';
import { getFileRevision, validateProjectSource } from './projectFileValidation';
import { MAX_LIST_RESULTS, PROJECT_TOOL_NAMES, projectToolDefinitions } from './projectMcp.shared';
export { PROJECT_TOOL_NAMES, projectToolDefinitions } from './projectMcp.shared';
import { searchWithRipgrep } from './ripgrepClient';
import { chatId } from '~/lib/persistence/useChatHistory';
import { workbenchStore } from '~/lib/stores/workbench';
import { webcontainer } from '~/lib/webcontainer';
import { WORK_DIR } from '~/utils/constants';
import { path } from '~/utils/path';
import type { ProjectCommands } from '~/utils/projectCommands';

const MAX_TEXT_BYTES = 256_000;
const MAX_OUTPUT_CHARS = 32_000;
const INSTALL_DEPENDENCY_WAIT_MS = 4_000;

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

const MAX_PROCESSES = 50;

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

const dependencyDiscoveryHint =
  'Project discovery skips generated node_modules files. Use package.json or the project lockfile for dependency information.';

function isDependencyPath(relative: string): boolean {
  return /(?:^|\/)node_modules(?:\/|$)/.test(relative);
}

function success(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data) }],
    structuredContent: data as Record<string, unknown>,
  };
}

function failure(error: unknown, details?: Record<string, unknown>) {
  const message =
    error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
      ? error.message
      : String(error);

  const text = message.slice(0, 4000);

  return {
    isError: true,
    content: [{ type: 'text' as const, text }],
    ...(details ? { structuredContent: { ...details, error: text } } : {}),
  };
}

function processResult(processId: string, record: ProcessRecord, reused = false) {
  const failed = record.exitCode !== undefined && record.exitCode !== 0;

  const missingCommand =
    record.exitCode === 127 ? /command not found:\s*([\w./@-]+)/i.exec(record.output)?.[1] : undefined;

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
    ...(failed
      ? {
          isError: true,
          error: missingCommand
            ? `Command not found: ${missingCommand} (exit code 127). If it is a project dependency, finish installing dependencies and retry ${record.command}.`
            : `Command exited with code ${record.exitCode}.`,
        }
      : {}),
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
  const processes = new Map<string, ProcessRecord>();

  const unknownProcess = (processId: string) =>
    failure(new Error(`Unknown process: ${processId}. Copy the exact processId from the project_run_command result.`));

  const stopProcesses = () => {
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
  };

  const assertProjectCurrent = () => {
    if (workbenchStore.projectGeneration.get() !== bridgeProjectGeneration || chatId.get() !== bridgeChatId) {
      throw new Error('The active project changed before this tool could finish.');
    }
  };

  const server = new McpServer({ name: 'bolt-project', version: '1.0.0' });
  const fileRevisionsReadByModel = new Map<string, string>();

  server.registerTool(
    'project_read_file',
    projectToolDefinitions.project_read_file,
    async ({ path: input, numbered }) => {
      try {
        const target = projectPath(input);
        await workbenchStore.waitForExecutionQueue();
        assertProjectCurrent();

        const content = await readText(target.relative).catch((error) => {
          if (isNotFoundError(error) && /(?:^|\/)node_modules\/\.package-lock\.json$/.test(target.relative)) {
            throw new Error(
              'npm’s generated install metadata is absent. Read the project package.json or its root package-lock.json for dependency information.',
            );
          }

          throw error;
        });
        assertProjectCurrent();

        const revision = await getFileRevision(content);
        fileRevisionsReadByModel.set(target.relative, revision);

        const numberedLines = numbered ? numberProjectLines(content) : undefined;

        return success({
          path: target.relative,
          revision,
          ...(numberedLines ? { lineCount: numberedLines.length, content: numberedLines.join('\n') } : { content }),
          truncated: false,
        });
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    'project_write_file',
    projectToolDefinitions.project_write_file,
    async ({ path: input, content, overwrite }, extra) => {
      try {
        if (new TextEncoder().encode(content).byteLength > MAX_TEXT_BYTES) {
          throw new Error('Content exceeds the text file size limit.');
        }

        const target = projectPath(input);

        let created = false;
        let changed = false;
        let sourceRepair: string | undefined;

        const rejectedWrite = await queueMutation(async () => {
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

          if (current?.type === 'file' && current.content === content) {
            return null;
          }

          let prepared;

          try {
            prepared = await validateProjectSource(target.relative, content, { repairJsxMap: true });
          } catch (error) {
            if (!created) {
              throw error;
            }

            return failure(error, { retryCreatePath: target.relative });
          }
          sourceRepair = prepared.sourceRepair;

          if (sourceRepair && new TextEncoder().encode(prepared.content).byteLength > MAX_TEXT_BYTES) {
            throw new Error('Content exceeds the text file size limit after the JSX syntax correction.');
          }

          assertNotAborted(extra.signal);
          assertProjectCurrent();

          changed = current?.type !== 'file' || current.content !== prepared.content;

          if (!changed) {
            return null;
          }

          if (current?.type === 'file') {
            await workbenchStore.saveFileContent(target.absolute, prepared.content);
          } else {
            await workbenchStore.createFile(target.absolute, prepared.content);
          }

          return null;
        });

        if (rejectedWrite) {
          return rejectedWrite;
        }

        if (changed) {
          fileRevisionsReadByModel.delete(target.relative);
        }

        return success({
          path: target.relative,
          written: true,
          created,
          changed,
          generation: bridgeProjectGeneration,
          ...(sourceRepair ? { sourceRepair } : {}),
        });
      } catch (error) {
        return failure(error);
      }
    },
  );

  const patchFile = async (
    {
      path: input,
      expectedContent,
      expectedRevision,
      oldText,
      lineRange,
      newText,
    }: ReturnType<typeof projectToolDefinitions.project_patch_file.inputSchema.parse>,
    signal: AbortSignal,
  ) => {
    try {
      const target = projectPath(input);

      return await queueMutation(async () => {
        assertNotAborted(signal);
        assertUnlocked(target.absolute);

        const content = await readText(target.relative);
        assertNotAborted(signal);
        assertProjectCurrent();

        const revisionToCheck = expectedRevision ?? fileRevisionsReadByModel.get(target.relative);

        if (expectedContent === undefined && revisionToCheck === undefined) {
          throw new Error('Read the file first, then supply its revision as expectedRevision.');
        }

        if (
          (revisionToCheck !== undefined && (await getFileRevision(content)) !== revisionToCheck) ||
          (expectedContent !== undefined && content !== expectedContent)
        ) {
          throw new Error(
            'Patch conflict: the file changed or expectedContent was copied incorrectly. Read the file again and use its revision as expectedRevision; do not repeat the stale patch.',
          );
        }

        // The input schema requires oldText when lineRange is omitted.
        const updated = lineRange
          ? replaceProjectLines(content, lineRange, newText)
          : replaceProjectText(content, oldText!, newText);

        if (new TextEncoder().encode(updated).byteLength > MAX_TEXT_BYTES) {
          throw new Error('Patched file exceeds the text file size limit.');
        }

        assertProjectCurrent();

        const changed = updated !== content;

        if (changed) {
          await validateProjectSource(target.relative, updated);
          assertNotAborted(signal);
          assertProjectCurrent();
          await workbenchStore.saveFileContent(target.absolute, updated);
          fileRevisionsReadByModel.delete(target.relative);
        }

        return success({ path: target.relative, patched: true, changed, generation: bridgeProjectGeneration });
      });
    } catch (error) {
      if (isNotFoundError(error)) {
        return failure(
          new Error(
            'The target file does not exist. Create it with project_write_file and supply the complete file as content.',
          ),
        );
      }

      return failure(error);
    }
  };

  server.registerTool('project_patch_file', projectToolDefinitions.project_patch_file, (input, { signal }) =>
    patchFile(input, signal),
  );

  server.registerTool(
    'project_replace_lines',
    projectToolDefinitions.project_replace_lines,
    ({ path, startLine, endLine, expectedRevision, newText }, { signal }) =>
      patchFile({ path, lineRange: { start: startLine, end: endLine }, expectedRevision, newText }, signal),
  );

  server.registerTool(
    'project_create_directory',
    projectToolDefinitions.project_create_directory,
    async ({ path: input }, extra) => {
      try {
        const target = projectPath(input);

        if (isDependencyPath(target.relative)) {
          return failure(
            new Error(
              'The package manager creates node_modules. Install project dependencies with project_run_command and purpose "install".',
            ),
          );
        }

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
    projectToolDefinitions.project_delete_path,
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
    projectToolDefinitions.project_list_paths,
    async ({ path: prefix = '', limit = MAX_LIST_RESULTS }) => {
      try {
        const relative = prefix ? projectPath(prefix, true).relative : '.';
        const safePrefix = relative === '.' ? '' : relative;

        if (isDependencyPath(relative)) {
          return success({ entries: [], truncated: false, note: dependencyDiscoveryHint });
        }

        await workbenchStore.waitForExecutionQueue();
        assertProjectCurrent();

        const entries = Object.entries(workbenchStore.files.get()).flatMap(([entryPath, entry]) => {
          if (!entry || !entryPath.startsWith(`${WORK_DIR}/`)) {
            return [];
          }

          const entryRelative = entryPath.slice(`${WORK_DIR}/`.length);

          return entryRelative.startsWith(safePrefix) && !isDependencyPath(entryRelative)
            ? [{ path: entryRelative, type: entry.type }]
            : [];
        });

        return success({ entries: entries.slice(0, limit), truncated: entries.length > limit });
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    'project_search_content',
    projectToolDefinitions.project_search_content,
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
    projectToolDefinitions.project_find_related_files,
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
          .filter(
            ([candidatePath, candidate]) =>
              candidate?.type === 'file' &&
              candidatePath !== target.absolute &&
              candidatePath.startsWith(`${WORK_DIR}/`) &&
              !isDependencyPath(candidatePath.slice(`${WORK_DIR}/`.length)),
          )
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
    projectToolDefinitions.project_run_command,
    async ({ command, purpose = 'other' }, extra) => {
      try {
        let reused = false;

        const installWaitUntil = Date.now() + INSTALL_DEPENDENCY_WAIT_MS;

        const launch = await queueMutation(async () => {
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

          if (purpose === 'run' || purpose === 'test') {
            const activeInstalls = [...processes].filter(
              ([, record]) => record.purpose === 'install' && record.exitCode === undefined,
            );

            for (const [installProcessId, install] of activeInstalls) {
              await waitForProcess(install, Math.max(0, installWaitUntil - Date.now()));
              assertNotAborted(extra.signal);
              assertProjectCurrent();

              if (install.exitCode === undefined) {
                return success({
                  command,
                  purpose,
                  status: 'waiting-for-install',
                  installProcessId,
                  note: 'This command has not started. Poll installProcessId with project_get_process_output, then retry this command after the install exits with code 0.',
                });
              }

              if (install.exitCode !== 0) {
                return failure(
                  new Error(
                    'Dependency installation failed before this command could start. Inspect the install output and fix it before retrying.',
                  ),
                  { command, purpose, installProcessId },
                );
              }
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

          // Use short opaque handles to make them easier to copy between tool calls.
          let processId = `p-${crypto.randomUUID().slice(0, 8)}`;

          while (processes.has(processId)) {
            processId = `p-${crypto.randomUUID().slice(0, 8)}`;
          }

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

        if (typeof launch !== 'string') {
          return launch;
        }

        const record = processes.get(launch)!;
        await waitForProcess(record, 250);
        assertProjectCurrent();

        return processResult(launch, record, reused);
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
    projectToolDefinitions.project_get_process_output,
    async ({ processId }) => {
      const record = processes.get(processId);

      if (!record) {
        return unknownProcess(processId);
      }

      await waitForProcess(record, 1000);
      assertProjectCurrent();

      return processResult(processId, record);
    },
  );

  server.registerTool('project_stop_process', projectToolDefinitions.project_stop_process, async ({ processId }) => {
    const record = processes.get(processId);

    if (!record) {
      return unknownProcess(processId);
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
  });

  server.registerTool('web_search', projectToolDefinitions.web_search, async ({ query, limit = 5 }, extra) => {
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
  });

  server.registerTool('web_fetch', projectToolDefinitions.web_fetch, async ({ url }, extra) => {
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
  });

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'bolt-project-client', version: '1.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  const unsubscribe = workbenchStore.projectGeneration.listen(stopProcesses);

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
      unsubscribe();
      stopProcesses();
      await client.close();
      await server.close();
    },
  };
}

let sharedBridge: { generation: number; promise: ReturnType<typeof createProjectMcpBridge> } | undefined;

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

  if (sharedBridge?.generation !== currentGeneration) {
    const previous = sharedBridge;

    const promise = (async () => {
      const oldBridge = await previous?.promise.catch(() => undefined);
      await oldBridge?.close();

      if (workbenchStore.projectGeneration.get() !== currentGeneration) {
        throw new Error('The active project changed before this tool could start.');
      }

      return createProjectMcpBridge();
    })();
    sharedBridge = { generation: currentGeneration, promise };
  }

  const connection = sharedBridge;

  const bridge = await connection.promise.catch((error) => {
    if (sharedBridge === connection) {
      sharedBridge = undefined;
    }

    throw error;
  });

  return bridge.callTool(name, args, { ...options, generation: currentGeneration });
}

/** Start a restored project with the same command lifecycle as a live build. */
export async function startRestoredProject(
  { setupCommand, startCommand }: ProjectCommands,
  context: { generation: number; chatId: string },
) {
  const runTool = async (name: string, args: Record<string, unknown>) => {
    const result = await callProjectMcpTool(name, args, context);
    const details = result.structuredContent as Record<string, unknown> | undefined;

    if (result.isError) {
      const error = details?.error;
      throw new Error(typeof error === 'string' ? error : 'Project setup command failed.');
    }

    return details;
  };

  if (setupCommand) {
    let install = await runTool('project_run_command', { command: setupCommand, purpose: 'install' });

    const processId = install?.processId;

    while (install?.status === 'running' && typeof processId === 'string') {
      install = await runTool('project_get_process_output', { processId });
    }

    if (install?.exitCode !== 0) {
      throw new Error('Project setup did not confirm a successful dependency install.');
    }
  }

  if (startCommand) {
    await runTool('project_run_command', { command: startCommand, purpose: 'run' });
  }
}

export async function closeProjectMcpBridge() {
  const connection = sharedBridge;
  sharedBridge = undefined;

  const bridge = await connection?.promise.catch(() => undefined);
  await bridge?.close();
}
