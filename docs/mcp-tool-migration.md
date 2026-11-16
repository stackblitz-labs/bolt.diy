# MCP Tool Migration

**Status:** Built-in project file, search, command, and web tools are implemented through an MCP bridge and server adapters. The implementation notes and remaining deployment limitations are summarized at the end of this document. The end-to-end browser/provider workflow still needs validation.

## Goal and scope

Move model-invoked project operations to real MCP calls with validated inputs, structured results, cancellation, and visible failures. Cover filesystem read/write/patch/delete, file/folder/content search, related-file discovery, web search/fetch, and WebContainer commands/process output.

Workbench controls should share the same adapters where they perform the same operation. Provider requests, authentication, deployment APIs, filesystem watchers, and terminal boot remain ordinary application plumbing. MCP adapters still call the underlying WebContainer and HTTP APIs.

MCP alone does not guarantee reliability. The improvement comes from shared validation, execution ordering, bounded results, explicit errors, and correct retry/project-switch behavior.

## User constraints

- Use genuine ripgrep (`rg`) for local project search.
- Web search/fetch must require no API key, paid subscription, or user secret.
- Preserve access to the active browser WebContainer and project state.

## Current architecture

| Capability | Current path | Runtime |
| --- | --- | --- |
| External MCP tools | `MCPService` → `/api/chat`; approved calls execute on a later chat request | Server |
| Built-in model project tools | `/api/chat` tool schemas/approval → browser MCP bridge → project runtime | Server and browser/WebContainer |
| Legacy action tags and saved history | `<boltAction>` → parser → `ActionRunner` | Browser/WebContainer |
| File state/changes | `FilesStore`, `ActionRunner` → `webcontainer.fs` | Browser/WebContainer |
| Workbench content search | `Search.tsx` → shared ripgrep WASM runner | Browser worker/WebContainer |
| Web search/fetch | Project MCP tools → `/api/web-search` → DuckDuckGo/public page fetch | Server; no API key |
| Command output/errors | WebContainer streams → terminal/action state | Browser/WebContainer |

The web route supports both DuckDuckGo search and URL fetch without a key. Fetching is streamed with byte/character bounds, timeouts, content-type checks, and redirect revalidation. The portable fetch implementation cannot inspect or pin DNS answers, so deployments that can resolve caller-controlled hostnames to private networks still need public-only egress controls.

## Execution architecture

Use a browser-hosted project MCP server connected to a browser MCP client through the installed SDK's paired `InMemoryTransport`. This supplies actual MCP `tools/list` and `tools/call` behavior beside the live WebContainer. No backend request needs to wait for browser execution or retain a pending promise across worker instances.

Define canonical schemas/metadata in a shared module imported by browser and server. The chat route exposes matching schema-only model tools. The browser executes approved project calls through its MCP client and reports actual results through `addToolOutput`, allowing the existing chat continuation to provide them to the model.

Keep external MCP tools on their server execution path. For built-in web tools, use a server-hosted MCP adapter around the no-key web service, with a local SDK transport where supported. The composer fetch route should use that same service. Scope connections and state to the appropriate project or request/session; do not add browser project state to the server-global MCPService singleton.

Use provider-safe model aliases such as `project_read_file` and `web_fetch`, mapped explicitly to MCP server/tool identity. Dotted names are not assumed compatible with every model provider. Reject collisions with configured tools rather than silently overriding them.

## Tool contract

| Capability | Initial model-facing tools | Required behavior |
| --- | --- | --- |
| Filesystem | `project_read_file`, `project_write_file`, `project_patch_file`, `project_delete_path`, `project_create_directory` | Root-confined paths, locks, text/binary policy, explicit overwrite/recursive options |
| Search/discovery | `project_list_paths`, `project_search_content`, `project_find_related_files` | Ripgrep file/content search, file/folder filters, bounded results and match evidence |
| Commands | `project_run_command`, `project_get_process_output`, `project_stop_process` | Process IDs, live output, bounded retrieval, exit status and cancellation |
| Web | `web_search`, `web_fetch` | No-key source, source URLs, bounded content and explicit unavailable/rate-limit errors |

Validate at both the model boundary and MCP server. Return MCP content blocks plus structured results; mark execution failures with `isError` and preserve useful bounded details. Carry call ID, project generation, truncation status, and operation-specific data where applicable.

Patches must check expected content/revision and fail on ambiguous matches. Serialize mutations and preserve action ordering; independent reads may run concurrently. Reuse store/terminal primitives after auditing them: existing helpers do not uniformly enforce confinement or locks. Avoid a cycle where a store calls a tool whose handler calls that same public store method.

## Ripgrep runtime and remaining gate

WebContainers support JavaScript and WebAssembly; ordinary native ripgrep binaries cannot be assumed to run. The app now bundles a ripgrep WebAssembly build and invokes it through the browser runtime. The workbench search and project MCP content search share this runner. The package is app infrastructure rather than a dependency installed into each generated project.

Use argument arrays, not shell interpolation of queries. Use `rg --json` for content matches and `rg --files` for file discovery. Exit code 1 means no matches; exit code 2 means an error. Bound results/output/time and support cancellation. Derive folder results from file paths and directory metadata. Related-file results should explain their evidence; do not claim semantic search without an implementation.

Keep runtime, file-access, ignore, and output-bound behavior covered when updating the bundled binary or launcher. The current project search is genuine ripgrep; do not silently replace it with a different search engine.

## Web constraints

The current no-key search adapter uses DuckDuckGo HTML. Public HTML endpoints can throttle, change markup, or return challenges; report those as failures instead of empty successful results. Keep the source adapter replaceable. A self-hosted option may be configurable, but the default must not quietly require another service the user has to provision.

Use bounded streamed reads, timeouts, content-type checks, and a redirect limit. Validate every redirect and reject private/loopback/link-local IPv4 and IPv6 targets, embedded credentials, and DNS resolutions to blocked addresses. Where DNS checks are unavailable, use runtime-appropriate egress protection and document limitations before enabling arbitrary fetch. Preserve requested/final URLs, snippets, and truncation metadata. Never fall back to a keyed provider.

## Original implementation checklist

The steps below preserve the design and rollout checklist. Use the implementation status at the end of this document for current completion and known gaps.

1. **Resolve feasibility.** Demonstrate ripgrep in WebContainer and browser MCP client/server bundling. Select/document the no-key search source. Check browser, Electron, and Cloudflare/server deployment compatibility.
2. **Define shared contracts.** Add schemas, model aliases, MCP results, capability metadata, execution location, and project-generation/cancellation rules. Reject tool-name collisions.
3. **Complete one file operation through MCP.** Add browser MCP lifecycle and read/write handlers. Connect model call → approval → browser MCP execution → actual `addToolOutput` result → model continuation. Execute browser approvals before reporting results; never send an approval marker to the model as the operation's outcome. Retain the external MCP approval path.
4. **Complete filesystem parity.** Add patch/delete/directory operations, root/lock enforcement, conflict checks, mutation ordering, and FilesStore bookkeeping. Deduplicate replayed side effects and reject calls for an old project generation.
5. **Complete process parity.** Add run/output/stop and a process registry. Preserve shell/build/start behavior, terminal output, readiness, exit failures, aborts, and preview errors. Return handles for long-lived servers. Verify separate stdout/stderr support in the installed API; label combined output accurately where applicable.
6. **Complete ripgrep search.** Implement file/folder/content and related-file discovery through the proven runtime. Share it with workbench search, cancel obsolete queries, and prevent stale results from replacing newer ones.
7. **Complete no-key web tools.** Expose search/fetch through the web MCP adapter, reuse the service in the URL-fetch route, and add bounds, redirect/egress checks, challenge/rate-limit errors, and source attribution.
8. **Switch model instructions/UI.** Provide built-in tools in build mode with zero external MCP servers configured. Update every selectable build prompt, preserve commentary and action progress, and prevent absent legacy tags from triggering duplicate setup/start commands. Define behavior for providers without tool support before enabling this mode for them.
9. **Preserve history/imports.** Retain parsers for stored chats, templates, ZIP/folder imports, and restoration. Replay must not repeat destructive tools/commands. Route active legacy operations through shared lower-level adapters where appropriate; disable new model-generated tags once parity is established.
10. **Validate and roll out.** Run focused contract/integration tests, relevant MCP/parser/action-runner suites, type checking, and browser workflows. Enable only after the criteria below pass, then remove duplicated active execution paths. Track remaining history compatibility separately.

## Completion criteria

- With no external MCP servers configured, a build chat can read/write/patch/delete/search, run a command, observe output/failure, start/stop a dev server, and continue from actual MCP results.
- Local search uses genuine ripgrep, respects expected ignore rules, and cancels superseded work.
- Web search/fetch works without a key; unavailable sources and blocked/oversized responses return visible errors.
- Approvals, denials, retries, duplicate call IDs, concurrent mutations, aborts, project changes, and teardown behave predictably. Cancellation never claims to undo completed mutations.
- Paths stay within the project root, locks are enforced, patches detect conflicts, and command failures never report success.
- FilesStore, editor, terminal, preview, imports, and saved chats stay consistent with the active project.
- Browser/Electron/server builds and representative tool-capable providers support the selected transport and continuation flow.

## References and status

[WebContainer runtime limitations](https://webcontainers.io/guides/troubleshooting) require JavaScript/WebAssembly-compatible dependencies. The installed MCP SDK includes paired transports at `@modelcontextprotocol/sdk/inMemory.js`; verify browser bundling in phase 1.

## Implementation status

The current implementation includes a browser MCP bridge for project file operations and WebContainer commands, ripgrep WASM for project/workbench search, and no-key DuckDuckGo search plus public URL fetch. Approved project tool calls return results to the model through the chat continuation; configured external MCP tools keep their server-side execution path. The implementation is in the repository source and the MCP project bridge has focused unit coverage.

The existing shell/artifact parser remains for saved chats and imports. An end-to-end browser session with a live WebContainer and provider is not established by the focused unit coverage. The web fetch layer cannot inspect or pin DNS resolution with portable `fetch`; deployments need public-only egress controls for caller-provided hostnames. DuckDuckGo HTML availability and markup remain subject to challenge, throttling, and change.
