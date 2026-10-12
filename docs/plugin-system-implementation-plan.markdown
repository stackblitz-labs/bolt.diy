# Plugin system implementation plan

**Status:** Reviewed proposal for `plugin-system`. The first functional delivery is implemented locally on the branch and is undergoing final review; marketplace files are prepared in the named source repository checkout.

**Initial scope:** A functional plugin manager in Settings, using reviewed declarative packages from `bolt-marketplace`. Installed plugins expose tools through fixed host adapters. The first delivery targets the current local installation and browser profile. Shared hosting and independently executable plugin code require additional storage and runtime work described below.

## Goal and design reference

Use the attached mockup as the product direction for four related experiences:

1. **Marketplace:** search and filter a catalog, inspect publisher/category/version, and install a plugin.
2. **Installed plugins:** see installed versions and update availability; enable, disable, configure, update, or uninstall.
3. **Plugin details:** overview, settings, permissions, and activity/logs.
4. **Develop plugin:** a guided flow for identity and description, capabilities, configuration, and review.

The mockup puts **Plugins** under **Extensions** in the Settings navigation. The current Settings Control Panel already has a persistent grouped left rail with Preferences, Account, Workspace, AI Providers, and Integrations. Extend that rail with **Extensions > Plugins** and add the Plugins tile to the Control Panel landing page. Keep Marketplace, Installed, Updates, Details, and Develop as views inside this tab. This matches the requested Settings entry and avoids requiring a separate application navigation redesign.

Use the app's existing theme tokens, controls, and icon system to reproduce the mockup's card grid, installed rows, purple selection states, detail tabs, and four-step developer form. Include narrow-screen layouts, keyboard navigation, focus handling, descriptive toggle labels, and visible loading/error states. Plugin detail navigation should return to the previous list with its search/filter state preserved.

## What exists today

The Settings Control Panel uses a closed tab list, explicit component switch, and a grouped `NAV_GROUPS` rail: [types.ts](../app/components/@settings/core/types.ts), [constants.tsx](../app/components/@settings/core/constants.tsx), and [ControlPanel.tsx](../app/components/@settings/core/ControlPanel.tsx). Those files have no Plugins entry. Saved tile visibility/order is loaded in [settings.ts](../app/lib/stores/settings.ts) without merging newly added defaults, so a migration is needed to make the Plugins tile appear for existing profiles. Rail entries currently come from `NAV_GROUPS` independently of tile visibility; preserve that distinction. The project/history sidebar in [Menu.client.tsx](../app/components/sidebar/Menu.client.tsx) already opens this Control Panel.

Connectors are a static catalog of provider-specific screens in [ConnectorsTab.tsx](../app/components/@settings/tabs/connectors/ConnectorsTab.tsx). MCP is a configurable tool-server connection: [McpTab.tsx](../app/components/@settings/tabs/mcp/McpTab.tsx), [mcp.ts](../app/lib/stores/mcp.ts), and [mcpService.ts](../app/lib/services/mcpService.ts). It can expose tools to chat, and existing controls enable or disable connectors and individual tools. Chat also supports per-call tool approval.

The repository does not currently contain a plugin marketplace, plugin manifest, install/update lifecycle, plugin registry, plugin runtime, publisher identity/signatures, or plugin activity log. MCP servers and service connectors are useful integration points; they are not a plugin package or runtime.

## Marketplace source repository

Use [`dustinwloring1988/bolt-marketplace`](https://github.com/dustinwloring1988/bolt-marketplace) as the canonical home for public plugin packages and their catalog metadata. At plan review time, the GitHub repository was empty. Its initial catalog format, package layout, validator, CI workflow, and Text Utilities pilot have now been added in the local marketplace checkout. The repository is a content source; it does not own a user's installed state, configuration, permission grants, or secrets, and it does not provide the plugin runtime.

Proposed initial contract to establish in the marketplace repository:

```text
catalog/index.json
schemas/catalog-v1.json
schemas/plugin-v1.json
plugins/<publisher>/<slug>/<version>/manifest.json
plugins/<publisher>/<slug>/<version>/package.zip
plugins/<publisher>/<slug>/<version>/CHANGELOG.md
plugins/<publisher>/<slug>/<version>/assets/  # optional icon and screenshots
```

The catalog index carries `schemaVersion`, plugin summaries, and version entries with relative manifest/package paths and SHA-256 digests. Package digests belong in the index or detached integrity metadata, not in the manifest embedded inside that package, which would create a self-referential hash. Resolve the configured default branch to a Git commit SHA, then read its index, manifests, and ZIPs from that same commit. Store the commit and both digests with the installed version. Git tags and release assets alone are not immutable guarantees. A digest checks content integrity; trusting the source still depends on control and review of this repository. Publisher display names are metadata, not proof of publisher identity.

For version 1, ZIPs contain the manifest and allowed declarative configuration/assets. They cannot introduce JavaScript, binaries, shell commands, install scripts, or arbitrary MCP launch definitions. Validate the archive's manifest against the catalog manifest. Reject traversal paths, absolute paths, links, duplicate entries, forbidden file types, and packages exceeding entry/size/decompression limits before storing them. Installation does not run `npm install` or package lifecycle scripts.

Fetch public metadata without requiring a GitHub token. Limit requests to the configured repository and approved GitHub content hosts; recheck redirects, bound response sizes, validate schemas, and cache the last valid catalog snapshot with its SHA and fetch time. Show offline/stale/rate-limit states explicitly. An empty repository or invalid index is a setup/error state, not a successful empty search result. Installed plugins remain manageable when discovery is unavailable. A server fetch proxy, if needed by a deployment, only reads this fixed source and never accepts arbitrary fetch URLs.

Add repository validation for duplicate IDs, semantic versions, compatibility declarations, missing assets, incorrect digests, and supported contribution types. Publish new versions through reviewed repository changes and retain older versions for rollback. The repository supplies no live ratings, download statistics, payments, or installation API. Omit popularity/rating/download UI until real data and an agreed source exist; initially sort by name or release date.

For the first functional milestone, reviewed declarative packages activate a fixed adapter compiled into Bolt. The Text Utilities pilot has deterministic tools and no network, file, credential, or provider-credit dependency. The server advertises only fixed schemas; the browser executes a tool after rechecking that the package is still installed, enabled, supports the tool, and has not disabled that tool. This uses the browser-profile record as the local enforcement source and does not establish authorization for a shared server. An unknown adapter or unsupported package type is visibly incompatible. Later versions can add independent executable packages after selecting a supported isolation model and publisher verification/signing scheme. The marketplace repository contains public packages and metadata only.

## Recommended architecture

### Catalog and manifest

Separate public catalog metadata from a user's installed plugin records. A versioned manifest should define:

- Stable ID derived from publisher and slug; name; description; publisher; license; category; icon; semantic version.
- `schemaVersion` and `pluginApiVersion`, with optional app version requirements. Define plugin API version 1 explicitly rather than treating the app's current package version as a capability contract.
- Declared contribution types and an allowlisted host adapter ID. A host-rendered settings form uses a supported subset of configuration schema; it cannot contain custom UI code.
- Requested, typed capabilities and their scopes.
- Configuration schema and defaults, with secrets declared separately from ordinary settings.
- Runtime/contribution compatibility and declared resources; package digests and eventual signatures live in the catalog's detached integrity metadata.

Catalog records describe what can be installed. Installed records track the source SHA, manifest/package digests, version, desired enabled state, actual runtime status, approved grants, non-secret configuration, credential references, owned tool/resource IDs, install time, previous version, and pending operation. Use distinct runtime statuses such as disabled, needs configuration, ready, and failed; an enabled toggle must not imply that a failing plugin is usable. Version 1 supports independent plugins without automatic plugin dependency installation.

Introduce a plugin service boundary for catalog discovery and for install, uninstall, enable, configure, update, grants, and logs. Keep these operations out of UI components. Use a separate versioned IndexedDB database for verified packages, installed records, operation journals, and bounded activity events in the current browser profile; reuse persistence patterns without changing the chat history database. An in-memory store provides reactive UI state. Handle schema upgrades, corrupted records, storage unavailability, and synchronization across tabs. Browser storage scopes the local user experience; it is not an authorization boundary for a shared server.

### Capability adapters and runtime

Begin with **reviewed declarative plugins** backed by fixed host adapters. Use a proposed Text Utilities pilot with deterministic tools and no network, file, credential, or provider-credit dependency. This gives the first install a real observable outcome. Add a reviewed remote MCP adapter separately after the route/session prerequisites below; a declarative MCP definition can still trigger remote calls or process launch, so its format alone is not a security boundary.

Track plugin ownership of server IDs, tool IDs, and registrations; use unique tool namespaces compatible with the model provider's name limits. Existing `_registerTools` can overwrite tools from another MCP server, so resolve or reject collisions explicitly. Register only ready, enabled plugins for the active context. Plugin tools must be available through the same model tool flow in chat and build mode, including during iterative tool use. Enforce installed/enabled/granted status again at execution and when replaying pending tool calls. Disabling should block new calls immediately; cancel or drain in-flight work using the adapter's declared behavior and prevent late completion from re-enabling a plugin. Preserve existing connector toggles, per-tool controls, and approval behavior; package installation must not silently enable an existing connector.

Independent executable plugins need a runtime behind a capability broker that exposes only scoped APIs. A Web Worker or ordinary child process alone does not confine network, filesystem, or credential access. Choose and validate confinement separately for browser, Electron/Node, and Workers deployments; declare unsupported runtime targets incompatible. Enforce grants where operations happen rather than relying on a permission page or the model's instructions.

Replace broad permissions such as “Network Access,” “File System,” and “Storage” with specific grants, for example allowed network hosts and methods, project path prefixes and operations, or named plugin storage namespaces. A plugin should not receive provider keys or MCP authorization headers just because it needs network access. Keep per-call approval for sensitive actions and make consequential scopes disabled until explicitly granted.

### Persistence and lifecycle

The current MCP settings are saved in browser `localStorage`, including server configuration and headers. Keep new plugin secrets out of catalog responses, logs, normal installed records, and exports. The pilot needs no secrets. Before shipping a credential-bearing adapter, implement its credential boundary: browser-only sessions can require re-entry with memory-only keys, Electron can use OS-backed secret storage, and hosted deployments need an authenticated server secret store. A masked input or encryption with a hardcoded key does not establish secure storage. Reuse an existing connector credential only through an explicit scoped host adapter; never copy provider keys into packages.

Make install/update transactional through an operation journal: validate compatibility, verify source/artifact integrity, stage the package, review requested grants, validate configuration, register the adapter, then commit the installed record. Roll back registration and storage changes on failure. Install can finish as disabled or needs configuration; it must not perform an external action just to display the plugin. Serialise operations per plugin and recover interrupted operations after reload.

An update keeps the previous verified package, compatible configuration, and granted scopes available for rollback. Migrate settings on a copy using host-owned migration logic; restore the previous version on activation failure. Review changelog and added scopes before activation. Disable removes registrations while retaining settings. Uninstall revokes grants and removes only owned resources; deleting stored plugin data or shared credential references requires an explicit user choice. No automatic updates in the first release.

## Security prerequisite

The MCP adapter has concrete prerequisites in the current code. [api.mcp-update-config.ts](../app/routes/api.mcp-update-config.ts) casts the posted JSON and does not parse the top-level `mcpConfigSchema`. The service does validate individual server configurations before connecting, but this permits configured stdio commands and arbitrary server URLs; schema validation does not authorize those operations. Both MCP routes expose server records containing configuration; `updateConfig` also logs the full configuration at debug level. Replace these with redacted response DTOs and logs before passing new plugin credentials through this path.

[mcpService.ts](../app/lib/services/mcpService.ts) maintains process-wide clients/configuration, and updates close and rebuild every configured client. An ownership-aware plugin operation therefore cannot simply replace the global config. Introduce scoped client/session ownership and targeted registration/cleanup before connecting plugins to this service. Restrict catalog-controlled destinations, revalidate redirects/egress for remote connections, and prohibit marketplace-selected stdio commands in version 1.

The existing [withSecurity](../app/lib/security.ts) wrapper adds method/rate-limit/header/error handling; its `requireAuth` option is not implemented as an authentication check. Adding that wrapper alone would not create account isolation. For local server operations, define session ownership and same-origin/request protections. Shared hosting additionally requires real authentication/authorization, user-scoped durable records, credential storage, and isolated clients. These are prerequisites for the corresponding backend adapters, not blockers for building the Settings UI and local deterministic pilot.

## Phased delivery

### Phase 0 — catalog and host contracts

- Adopt the Settings tab location and local browser-profile scope described above.
- Define catalog/manifest schemas, plugin API version 1, ZIP contents/limits, fixed host adapter IDs, and credential-free capability contracts. Share schema fixtures between the app and marketplace repository to prevent drift.
- Establish the catalog index, pinned-commit/digest fetch path, and reviewed release policy in `bolt-marketplace`; add the Text Utilities pilot metadata/package and validation workflow.
- Define operation states, ownership keys, persistence schema, and the host tool registry contract. Record unsupported runtime/contribution types explicitly.

**Completion gate:** The app can validate the pilot's index, manifest, and package against the same contract used by the repository. No release depends on placeholder packages or statistics.

### Phase 1 — Settings navigation and marketplace

- Add `plugins` to the Settings tab type, both label maps, icons, descriptions, component switch, defaults, and `NAV_GROUPS` under Extensions. Merge missing tab defaults into saved tile configuration while preserving existing visibility/order preferences.
- Build Marketplace and Installed/Updates views with loading, empty, error, and incompatible-version states.
- Read a small, reviewed, read-only catalog from `bolt-marketplace`. Search, category/publisher filters, version and description can work before installation exists; provide clear loading, stale-cache, and repository-error states.
- Make plugin cards and details honest about what is available; do not label existing connectors as installed plugins without an adapter and lifecycle record.

**Completion gate:** Plugins is visible from Settings for both new and existing profiles; valid repository entries render with working filters and useful offline/error behavior.

### Phase 2 — functional pilot and enforced install lifecycle

- Add a versioned manifest validator and installed-plugin record model.
- Resolve catalog entries to immutable repository versions and verify package digests before staging an install.
- Implement install/uninstall, enable/disable, host-rendered settings, grant review/enforcement, compatibility checks, redacted activity events, and ownership-aware cleanup. Permission enforcement ships before plugin activation.
- Register the credential-free pilot's tools in the existing chat/build flow and enforce status/grants at invocation and replay. Handle tool collisions and disabled/failed plugins explicitly.
- Persist packages/records/journals in the separate plugin IndexedDB database and recover interrupted operations. Add version/schema migrations and synchronization across tabs.

**Completion gate:** A user can install the pilot, use its tool in chat and build mode, disable it, reload, re-enable it, and uninstall it; failed operations do not leave an enabled or partially registered plugin.

### Phase 3 — updates, detail views, and developer draft

- Complete Overview, Settings, Permissions, and Logs tabs; show configuration errors and actual runtime status. Bound retained logs and support clearing/exporting redacted events.
- Add Check for Updates, semantic-version comparison, Updates count, changelog/grant review, staged activation, and rollback. Cached installed packages remain available if the repository is temporarily unavailable.
- Implement the four-step Develop Plugin wizard as a local draft of a supported declarative package: basic information, fixed adapter/capabilities, supported configuration schema, and review. Validate and export a package for a reviewed repository contribution. The publisher field is descriptive; export does not confer publisher verification.
- Keep the screenshot's Install Plugin button useful through a validated local ZIP import using the same checks and supported adapter rules as catalog installs. Mark imported packages as local/unverified; automatic marketplace updates require a matching catalog source and identity.

**Completion gate:** Update failure restores the prior working version/settings, and the wizard/import flow cannot bypass contribution restrictions or grant enforcement.

### Phase 4 — additional adapters and executable extensions

- Add a reviewed remote MCP adapter only after scoped ownership, destination restrictions, configuration redaction, credential handling, and route/session protections are implemented. Do not promise confinement of what a remote MCP service does internally.
- For hosted use, implement authentication/authorization, durable user-scoped storage, and isolated runtime/client sessions before supporting multiple users.
- Before independent executable packages, implement supported deployment-specific confinement, capability broker APIs, publisher verification/signing, resource limits, revocation, and rollback. Browser, Electron/Node, and Workers support must be declared separately.
- Connect developer publishing to the repository's reviewed release process when that process is ready. A standalone marketplace service is not required by the chosen repository model.

**Completion gate:** Each additional adapter/runtime has demonstrated scope enforcement and isolation appropriate to its deployment. Unsupported packages remain unavailable.

## Mockup-to-app mapping

| Mockup | Proposed implementation |
|---|---|
| Marketplace with search, categories, publishers, cards | Settings > Extensions > Plugins; GitHub catalog in Phase 1; statistics omitted until backed by real data |
| Installed/Updates with status toggles | Browser-profile installed records, accurate runtime status, and update service in Phase 2–3 |
| Overview, Settings, Permissions, Logs detail tabs | Views within Plugins; host-rendered config, enforced grants, and redacted events |
| Develop Plugin: Basic Information → Capabilities → Configuration → Review | Supported declarative package draft/export in Phase 3; executable publishing in Phase 4 |
| Install Plugin button | Validated local ZIP import in Phase 3; source/verification status shown |

## First release acceptance criteria

- Plugins appears under Extensions in the Settings rail and opens directly to Marketplace.
- Existing saved user navigation/settings preferences do not hide the new entry after upgrade.
- Marketplace data cannot execute code, start processes, or request secrets merely by being displayed.
- Catalog entries resolve to schema-valid manifests and immutable package versions with verified digests before installation.
- Install, enable, disable, and uninstall affect only the current profile's plugin and its owned tools/configuration.
- The credential-free pilot contributes working tools in both chat and build mode; disable/uninstall prevents new invocations and pending replay.
- No plugin can access network, project files, storage, credentials, or side-effecting tools beyond its explicit enforced grants.
- Unsupported plugin types are visibly unavailable instead of appearing installed or enabled.
- Lifecycle operations survive reload, synchronize across tabs, and recover from package/storage/activation failures without altering unrelated connectors or chat data.
- Shared-deployment backend adapters are unavailable until their APIs are authenticated, schema-validated, user-isolated, and verified for install/update/revocation behavior.

## Verification during implementation

Use focused checks for schema/compatibility failures, digest mismatch, unsafe ZIP entries, catalog outages, storage migration/recovery, concurrent operations, tool collisions, grant revocation, pending-call replay, uninstall ownership, and failed update rollback. Test local imports against the same package validator used for marketplace installs.

Review the UI against the supplied image at desktop and narrow widths, including keyboard focus, list/detail back navigation, both themes, accurate status labels, and old saved Settings configuration. Exercise the real pilot lifecycle with mocked model/tool requests where appropriate. Paid OpenRouter/Browser Use requests remain deferred under the user's earlier instruction until account testing resumes; their availability is not required to validate this plugin manager. Use the repository's existing typecheck, lint, and relevant test tooling for implementation changes.

## Key code integration points

- Navigation/Settings: [ControlPanel.tsx](../app/components/@settings/core/ControlPanel.tsx), [types.ts](../app/components/@settings/core/types.ts), [constants.tsx](../app/components/@settings/core/constants.tsx), [Menu.client.tsx](../app/components/sidebar/Menu.client.tsx), [settings.ts](../app/lib/stores/settings.ts).
- Existing tools and connectors: [ConnectorsTab.tsx](../app/components/@settings/tabs/connectors/ConnectorsTab.tsx), [McpTab.tsx](../app/components/@settings/tabs/mcp/McpTab.tsx), [mcp.ts](../app/lib/stores/mcp.ts), [mcpService.ts](../app/lib/services/mcpService.ts), [projectMcp.shared.ts](../app/lib/runtime/projectMcp.shared.ts), and [api.chat.ts](../app/routes/api.chat.ts).
- Persistence patterns: [db.ts](../app/lib/persistence/db.ts); use a separate plugin database rather than modifying chat history storage.
- MCP routes and security boundary to review before plugin MCP adapters: [api.mcp-update-config.ts](../app/routes/api.mcp-update-config.ts), [api.mcp-check.ts](../app/routes/api.mcp-check.ts), and [security.ts](../app/lib/security.ts).
- Proposed new modules: `app/lib/plugins/` for schema/catalog/lifecycle/adapters/persistence; `app/lib/stores/plugins.ts` for reactive state; `app/components/@settings/tabs/plugins/` for the views. These paths are proposals, not existing implementations.
