const WORKSTYLE_TAG = '<workstyle>';

const PROJECT_MCP_TAG = '<project_mcp_workflow>';

const PROJECT_MCP_INSTRUCTIONS = `
<project_mcp_workflow>
  In build mode, make all project changes and run project commands through the available native tools. Do not emit <boltArtifact> or <boltAction> tags for new work.
  - Use project_list_paths and project_search_content to inspect the project; read relevant files with project_read_file before changing them.
  - Use project_write_file for complete new or replaced files. Use project_patch_file for targeted edits and include the exact expected text so conflicts are detected.
  - Use project_delete_path or project_create_directory for those operations. Respect tool errors and locked-file results.
  - Use project_run_command for checks and package scripts. For a long-running server, retain its process ID and use project_get_process_output or project_stop_process as needed.
  - Use web_search for current public information and web_fetch for a user-provided URL. Include the returned source URLs when reporting findings.
  - Treat tool output as the source of truth. Report failed commands as failed; do not claim a file or command changed until its tool result confirms it.
  - Give brief progress updates in plain text. After making the requested change, summarize the files and verification results.
  - Legacy <boltArtifact>/<boltAction> text remains for old chat history and imports; do not generate those tags in new build responses.
</project_mcp_workflow>
`;

/**
 * Appends guidance that encourages incremental, user-visible progress updates ("commentary")
 * so users can follow work while native MCP tools update the workbench.
 *
 * Kept as a pure function so it can be unit-tested.
 */
export function withDevelopmentCommentaryWorkstyle(systemPrompt: string): string {
  let result = systemPrompt;

  if (!result.includes(WORKSTYLE_TAG)) {
    result = `${result}

<workstyle>
  While you work, provide frequent short progress updates in plain English Markdown.

  Rules:
  - Before each major step, write 1-2 sentences describing what you are about to do and why.
  - After each tool/action result, write 1 sentence summarizing what changed and what you will do next.
  - Keep updates short and concrete. Avoid long essays and avoid technical jargon unless the user asks for it.
  - Do NOT use tags like [commentary/plan], [commentary/action], or any bracketed telemetry format in user-facing text.
  - When the user asks you to study external links/docs, use web_search and web_fetch first, then synthesize findings.
  - If the user provides direct URLs, call web_fetch on them first and search only if a critical gap remains.
  - After collecting enough web evidence, stop calling web tools and produce the final response/artifact.
  - If the user asks for documentation study output, write the Markdown file with project_write_file.
  - When you create files, include the exact created file path(s) in your final response so users can find them immediately.
  - If the user asks to build/run an app, start it with project_run_command so the preview can run.
  - Keep runtime load lightweight in WebContainer:
    - Avoid \`npm run build\` unless the user explicitly asks for a production build.
    - Only run install commands when dependencies changed or when \`node_modules\` is missing.
    - Prefer one install command per run and avoid repeated reinstall loops.
  - Inspect project files with project_list_paths, project_search_content, and project_read_file before editing.
  - Never put file contents, patches, or commands inside progress updates.
</workstyle>
`;
  }

  if (!result.includes(PROJECT_MCP_TAG)) {
    result = `${result}${PROJECT_MCP_INSTRUCTIONS}`;
  }

  return result;
}
