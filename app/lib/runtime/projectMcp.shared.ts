const MAX_LIST_RESULTS = 500;

export const PROJECT_TOOL_NAMES = [
  'project_read_file',
  'project_write_file',
  'project_patch_file',
  'project_delete_path',
  'project_create_directory',
  'project_list_paths',
  'project_search_content',
  'project_find_related_files',
  'project_run_command',
  'project_get_process_output',
  'project_stop_process',
  'web_search',
  'web_fetch',
] as const;

export function getProjectToolNames(webSearchEnabled = true) {
  return PROJECT_TOOL_NAMES.filter((name) => webSearchEnabled || (name !== 'web_search' && name !== 'web_fetch'));
}

type ProjectToolName = (typeof PROJECT_TOOL_NAMES)[number];
type JsonSchema = Record<string, unknown>;

const objectSchema = (properties: JsonSchema, required: string[]): JsonSchema => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});

/** JSON Schema contracts shared by the server chat route and browser MCP bridge. */
export const projectToolDefinitions: Record<ProjectToolName, { description: string; inputSchema: JsonSchema }> = {
  project_read_file: {
    description:
      'Read a UTF-8 text file from the active project. Returns content and revision; copy revision into expectedRevision when patching.',
    inputSchema: objectSchema({ path: { type: 'string', minLength: 1 } }, ['path']),
  },
  project_write_file: {
    description:
      'Create a UTF-8 text file. For changes to existing files prefer project_patch_file. Replacing an existing file requires replacementReason explaining why a full replacement is necessary. Set overwrite to false to require a new path.',
    inputSchema: objectSchema(
      {
        path: { type: 'string', minLength: 1 },
        content: { type: 'string' },
        overwrite: { type: 'boolean' },
        replacementReason: { type: 'string', minLength: 1, maxLength: 500 },
      },
      ['path', 'content'],
    ),
  },
  project_patch_file: {
    description:
      'Replace one exact unique oldText in a file. Read the file first and copy its revision into expectedRevision; do not copy the whole file. On a conflict, read again before retrying. Preserve actual line breaks in newText. Invalid JS/TS syntax is rejected before saving.',
    inputSchema: objectSchema(
      {
        path: { type: 'string', minLength: 1 },
        expectedContent: { type: 'string' },
        expectedRevision: { type: 'string', pattern: '^[a-f0-9]{64}$' },
        oldText: { type: 'string', minLength: 1 },
        newText: { type: 'string' },
      },
      ['path', 'oldText', 'newText'],
    ),
  },
  project_delete_path: {
    description: 'Delete a file or an explicitly selected directory in the active project.',
    inputSchema: objectSchema({ path: { type: 'string', minLength: 1 }, recursive: { type: 'boolean' } }, ['path']),
  },
  project_create_directory: {
    description: 'Create a directory in the active project.',
    inputSchema: objectSchema({ path: { type: 'string', minLength: 1 } }, ['path']),
  },
  project_list_paths: {
    description:
      'List active project files and folders. Omit path or use "." for the project root; use "src" for a directory prefix. Paths may be relative to the project or absolute within /home/project.',
    inputSchema: objectSchema(
      { path: { type: 'string' }, limit: { type: 'integer', minimum: 1, maximum: MAX_LIST_RESULTS } },
      [],
    ),
  },
  project_search_content: {
    description: 'Search project file contents using ripgrep.',
    inputSchema: objectSchema(
      {
        query: { type: 'string', minLength: 1 },
        path: { type: 'string' },
        limit: { type: 'integer', minimum: 1, maximum: 200 },
      },
      ['query'],
    ),
  },
  project_find_related_files: {
    description: 'Find files related by shared directory or filename stem. Each result includes the matching evidence.',
    inputSchema: objectSchema(
      { path: { type: 'string', minLength: 1 }, limit: { type: 'integer', minimum: 1, maximum: 100 } },
      ['path'],
    ),
  },
  project_run_command: {
    description:
      'Run a shell command in the active WebContainer project and stream its output to Bolt Terminal. Set purpose to run, test, install, or other. A test passes only when it exits with code 0; poll project_get_process_output for running commands before dependent work. Returns process ID, command, purpose, output, exit status, and previewReady. Commands require user approval.',
    inputSchema: objectSchema(
      {
        command: { type: 'string', minLength: 1, maxLength: 4000 },
        purpose: { type: 'string', enum: ['run', 'test', 'install', 'other'] },
      },
      ['command', 'purpose'],
    ),
  },
  project_get_process_output: {
    description:
      'Get current or final combined output, exit status, and previewReady for a project command. Poll a running installation before starting dependent commands, and poll a dev server until previewReady is true.',
    inputSchema: objectSchema({ processId: { type: 'string', minLength: 1 } }, ['processId']),
  },
  project_stop_process: {
    description: 'Stop a running project command.',
    inputSchema: objectSchema({ processId: { type: 'string', minLength: 1 } }, ['processId']),
  },
  web_search: {
    description: 'Search the public web without an API key and return sourced result snippets.',
    inputSchema: objectSchema(
      { query: { type: 'string', minLength: 1, maxLength: 1000 }, limit: { type: 'integer', minimum: 1, maximum: 10 } },
      ['query'],
    ),
  },
  web_fetch: {
    description: 'Fetch and summarize the public content at a URL without an API key.',
    inputSchema: objectSchema({ url: { type: 'string', minLength: 1, maxLength: 2048 } }, ['url']),
  },
};
