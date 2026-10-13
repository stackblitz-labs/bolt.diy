const WORKSTYLE_TAG = '<workstyle>';

const PROJECT_MCP_TAG = '<project_mcp_workflow>';

const PROJECT_MCP_INSTRUCTIONS = `
<project_mcp_workflow>
  This workflow replaces any artifact-generation requirements or examples elsewhere in the prompt. Those formats are only for legacy history and imports.
  In build mode, make all project changes and run project commands through the available native tools. Do not emit <boltArtifact> or <boltAction> tags for new work.
  - Every project file path must be relative to the project root (for example, src/App.tsx or package.json), never /home/project or another absolute path. Omit the optional path argument when listing or searching the entire project. Project commands already run in the project root.
  - Use project_list_paths and project_search_content to inspect the project; read relevant files with project_read_file before changing them.
  - Follow-up requests must preserve the existing project. Read the relevant files and use project_patch_file for small targeted changes, supplying exact oldText and expectedContent. Edit only files needed for the request. Preserve unrelated code, formatting, dependencies, and behavior; avoid unnecessary rewrites, refactors, renames, or new scaffolds.
  - Use project_write_file for new files. Replace an existing file only when the requested change fundamentally requires it, and supply replacementReason explaining why a targeted patch is insufficient.
  - Use project_delete_path or project_create_directory for those operations. Respect tool errors and locked-file results.
  - Use project_run_command for checks and package scripts, labeling purpose as run, test, install, or other. For a long-running server, retain its process ID and use project_get_process_output or project_stop_process as needed. Reuse a live preview server on follow-ups.
  - A command result with status running only confirms it started. Poll its process output until an install/check exits before running dependent commands. Confirm a dev server's readiness from its actual output before claiming the preview is available. Never repeat an install or start another server while the existing process is still running.
  - Use the enabled web research tools for current public information and user-provided URLs. Follow the current web research tool instructions and include the returned source URLs when reporting findings.
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
  - When the user asks you to study external links/docs, use the enabled web research tools, then synthesize findings.
  - If the user provides direct URLs, visit them with an enabled web research tool and search only if a critical gap remains.
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
