import { z } from 'zod';

export const MAX_LIST_RESULTS = 500;

const projectPath = z.string().min(1).describe('Path relative to the active project root.');
const optionalSearchPath = z.string().describe('Project-relative path. Omit it or use "." for the root.').optional();
const processId = z.string().min(1).describe('Use the processId returned by project_run_command.');
const revision = z.string().regex(/^[a-f0-9]{64}$/);
const lineNumber = z.number().int().min(1);

export const projectToolDefinitions = {
  project_read_file: {
    description: 'Read a UTF-8 project file. Returns content and revision for a subsequent patch.',
    inputSchema: z.strictObject({
      path: projectPath,
      numbered: z
        .boolean()
        .describe('Set true before editing to return 1-based line numbers and the last valid line number as lineCount.')
        .optional(),
    }),
  },
  project_write_file: {
    description: 'Create or fully replace a UTF-8 text file. Use project_replace_lines for targeted edits.',
    inputSchema: z.strictObject({
      path: projectPath,
      content: z
        .string()
        .describe(
          'Complete file contents in one call. Use real line breaks between source statements. For large features, write smaller complete modules as separate files.',
        ),
      overwrite: z.boolean().describe('Set false to require a new path.').optional(),
      replacementReason: z.string().trim().max(500).describe('Optional reason for a full-file replacement.').optional(),
    }),
  },
  project_replace_lines: {
    description: 'Edit an existing file using line numbers and revision from project_read_file with numbered: true.',
    inputSchema: z.strictObject({
      path: projectPath,
      startLine: lineNumber.describe('First line to replace, inclusive.'),
      endLine: lineNumber.describe('Last line to replace, inclusive and no greater than lineCount from the read.'),
      expectedRevision: revision.describe('Copy the revision from the numbered read.'),
      newText: z
        .string()
        .describe(
          'Complete replacement lines without number prefixes. Use an empty string to delete the selected lines.',
        ),
    }),
  },
  project_patch_file: {
    description: 'Fallback for an exact unique text replacement. Prefer project_replace_lines for numbered edits.',
    inputSchema: z
      .strictObject({
        path: projectPath,
        expectedContent: z
          .string()
          .describe('Legacy full-file concurrency check. Omit this field in normal use.')
          .optional(),
        expectedRevision: revision
          .describe(
            'Exact revision returned by project_read_file. Required with lineRange. Text matches can use the latest read revision.',
          )
          .optional(),
        lineRange: z
          .strictObject({ start: lineNumber, end: lineNumber })
          .describe('Optional legacy range, as an object like {"start": 3, "end": 5}. Prefer project_replace_lines.')
          .optional(),
        oldText: z
          .string()
          .min(1)
          .describe('Fallback exact unique match from a raw read. Omit when using lineRange.')
          .optional(),
        newText: z
          .string()
          .describe(
            'Replacement source without line number prefixes. Use an empty string to delete the match or range.',
          ),
      })
      .refine(({ oldText, lineRange }) => (oldText === undefined) !== (lineRange === undefined), {
        message: 'Supply exactly one of oldText or lineRange.',
      })
      .refine(({ expectedRevision, lineRange }) => !lineRange || expectedRevision !== undefined, {
        path: ['expectedRevision'],
        message: 'Copy the revision from the numbered read when using lineRange.',
      }),
  },
  project_delete_path: {
    description: 'Delete a file or an explicitly selected directory in the active project.',
    inputSchema: z.strictObject({
      path: projectPath,
      recursive: z.boolean().describe('Set true to delete a directory and its contents.').optional(),
    }),
  },
  project_create_directory: {
    description: 'Create a directory in the active project.',
    inputSchema: z.strictObject({ path: projectPath }),
  },
  project_list_paths: {
    description:
      'List active project files and folders. Generated node_modules files are excluded. Example directory prefix: src.',
    inputSchema: z.strictObject({
      path: optionalSearchPath,
      limit: z.number().int().min(1).max(MAX_LIST_RESULTS).optional(),
    }),
  },
  project_search_content: {
    description: 'Search project file contents using ripgrep.',
    inputSchema: z.strictObject({
      query: z.string().min(1),
      path: optionalSearchPath,
      limit: z.number().int().min(1).max(200).optional(),
    }),
  },
  project_find_related_files: {
    description: 'Find files related by shared directory or filename stem. Each result includes the matching evidence.',
    inputSchema: z.strictObject({ path: projectPath, limit: z.number().int().min(1).max(100).optional() }),
  },
  project_run_command: {
    description:
      'Run a shell command in the project and stream its output to Bolt Terminal. Run dependency installs separately and poll them to exit code 0 before starting the app or checks. Commands require approval.',
    inputSchema: z.strictObject({
      command: z.string().min(1).max(4000),
      purpose: z
        .enum(['run', 'test', 'install', 'other'])
        .describe('Use run for dev servers, test for checks, and install for dependencies. Defaults to other.')
        .optional(),
    }),
  },
  project_get_process_output: {
    description:
      'Get combined output, exit status, and previewReady for a project command. Check running installs before dependent commands and check dev servers for readiness.',
    inputSchema: z.strictObject({ processId }),
  },
  project_stop_process: {
    description: 'Stop a running project command.',
    inputSchema: z.strictObject({ processId }),
  },
  web_search: {
    description: 'Search the public web and return sourced result snippets.',
    inputSchema: z.strictObject({
      query: z.string().min(1).max(1000),
      limit: z.number().int().min(1).max(10).optional(),
    }),
  },
  web_fetch: {
    description: 'Fetch readable public content at a URL.',
    inputSchema: z.strictObject({ url: z.string().min(1).max(2048) }),
  },
};

type ProjectToolName = keyof typeof projectToolDefinitions;

export const PROJECT_TOOL_NAMES = Object.keys(projectToolDefinitions) as ProjectToolName[];

export function getProjectToolNames(webSearchEnabled = true) {
  return PROJECT_TOOL_NAMES.filter((name) => webSearchEnabled || (name !== 'web_search' && name !== 'web_fetch'));
}
