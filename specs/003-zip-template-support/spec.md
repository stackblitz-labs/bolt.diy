# Feature Specification: Zip File Template Support

**Feature Branch**: `003-zip-template-support`
**Created**: 2026-01-30
**Status**: Draft
**Input**: User description: "I want to change flow of we get code from template, we have 1 more option that we can get code from zip file in @templates. We will download template from zip file and extract"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Load Template from Local Zip File (Priority: P1)

As a developer or system, I want to load website templates from local zip files stored in the templates directory, so that I can use pre-packaged templates without depending on GitHub API availability or rate limits.

**Why this priority**: This is the core functionality of the feature. Without the ability to extract and load templates from zip files, no other functionality can work. It also provides offline capability and eliminates GitHub API rate limit concerns.

**Independent Test**: Can be fully tested by providing a zip file in the templates directory and verifying the system extracts and returns the correct file structure with proper content.

**Acceptance Scenarios**:

1. **Given** a valid zip file exists in the templates directory, **When** the system loads the template, **Then** all files are extracted with correct paths and content preserved.
2. **Given** a zip file with a root folder wrapper (e.g., `template-name-main/src/...`), **When** the system extracts the template, **Then** the root folder is stripped and files are normalized to start from the actual project root.
3. **Given** a zip file containing binary files (images, fonts), **When** the system extracts the template, **Then** binary files are marked appropriately and excluded from text processing.

---

### User Story 2 - Template Source Resolution (Priority: P2)

As a system, I want to check for local zip templates before falling back to GitHub, so that local templates are preferred when available and the system gracefully handles missing sources.

**Why this priority**: This enables the hybrid approach where local templates take precedence over GitHub, providing faster loading and offline capability while maintaining backward compatibility.

**Independent Test**: Can be tested by having both a local zip and GitHub repo reference for the same template, verifying the local zip is used first.

**Acceptance Scenarios**:

1. **Given** a template has both a local zip file and GitHub repo configured, **When** the template is requested, **Then** the local zip file is used.
2. **Given** a template has only a GitHub repo configured (no local zip), **When** the template is requested, **Then** the system fetches from GitHub as before.
3. **Given** a template has only a local zip file configured, **When** the local zip file is missing or corrupted, **Then** the system reports a clear error without attempting GitHub fallback.

---

### User Story 3 - Convention-Based Template Discovery (Priority: P3)

As a developer, I want zip files to be automatically discovered by naming convention, so I can add new templates by simply placing a correctly-named zip file in the templates directory.

**Why this priority**: Convention-based discovery simplifies template management. While essential for a complete solution, the core extraction logic (P1) can be tested independently with hardcoded paths.

**Independent Test**: Can be tested by placing a zip file named `{template-name}.zip` in the templates directory and verifying it is automatically used for that template.

**Acceptance Scenarios**:

1. **Given** a template named `indochine-luxe` exists in STARTER_TEMPLATES, **When** a file `templates/indochine-luxe.zip` is present, **Then** the system uses the zip file for that template.
2. **Given** a zip file exists but no matching template name in STARTER_TEMPLATES, **When** listing templates, **Then** the orphaned zip file is ignored (no error).
3. **Given** a new zip file is added matching an existing template name, **When** the template is requested, **Then** the zip file is used immediately without code changes.

---

### Edge Cases

- What happens when a zip file is corrupted or incomplete?
  - System reports a clear error message identifying the problematic file
- What happens when a zip file contains files larger than 100KB?
  - Large files are filtered out consistent with existing GitHub fetcher behavior
- What happens when a zip file has deeply nested folder structures?
  - System handles arbitrary nesting levels by normalizing paths
- How does the system handle zip files with special characters in filenames?
  - Filenames are preserved as-is; system uses UTF-8 encoding
- What happens if extraction runs out of memory with a very large zip?
  - System applies the same file size and count limits as GitHub fetcher

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST extract all files from a zip archive in the templates directory and return them as a list of file objects with path, content, and binary flag.
- **FR-002**: System MUST normalize zip file structure by removing common root folder wrappers (e.g., `repo-name-main/`, `template-v1/`) so files start from the actual project root.
- **FR-003**: System MUST detect and mark binary files (images, fonts, compiled assets) during extraction, excluding them from text content processing.
- **FR-004**: System MUST apply the same file filtering rules as the GitHub fetcher (exclude `.git/`, lock files, files over 100KB).
- **FR-005**: System MUST resolve zip files by convention: for a template with name `X`, check for `templates/X.zip` file.
- **FR-006**: System MUST check for local zip file availability before attempting GitHub fetch when both sources are configured for a template.
- **FR-007**: System MUST provide clear error messages when a zip file is missing, corrupted, or cannot be extracted.
- **FR-008**: System MUST return extracted files in the same format as the GitHub template fetcher (`{name, path, content}`) for compatibility with existing template priming code.
- **FR-009**: System MUST validate all extracted file paths to prevent path traversal attacks (zip slip), rejecting any paths containing `..` or absolute paths that would escape the project root.

### Key Entities

- **ZipTemplate**: A template stored as a zip archive file in the templates directory. Named by convention: `{template-name}.zip` matches the template's `name` property in STARTER_TEMPLATES.
- **TemplateFile**: A single file extracted from a template, containing path (relative to project root), content (string for text, undefined for binary), and metadata about file type.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Templates load from local zip files within 2 seconds for a typical 50-file template, compared to 5-10 seconds for GitHub API fetch.
- **SC-002**: System correctly extracts 100% of text files and preserves their content exactly as stored in the zip archive.
- **SC-003**: Template loading works offline when using local zip files (no network requests required).
- **SC-004**: Developers can add new templates by placing a zip file named `{template-name}.zip` in the templates directory, with the template available immediately without code or registry changes.
- **SC-005**: All existing GitHub-based templates continue to work unchanged (backward compatibility).

## Clarifications

### Session 2026-01-30

- Q: Where should zip extraction occur (server-side, client-side, or hybrid)? → A: Server-side only - zip files bundled with deployment, extracted in Remix loader/action
- Q: Should the extractor validate against path traversal (zip slip) and zip bomb attacks? → A: Path traversal only - validate all paths stay within project root, skip zip bomb checks (templates are trusted internal assets)
- Q: How should zip files be matched to templates? → A: Convention-based - zip filename must match template name (e.g., `indochine-luxe.zip` → `indochine-luxe`)

## Assumptions

- Zip extraction occurs server-side in Remix loaders/actions, consistent with the existing GitHub template fetcher pattern.
- Zip files in the templates directory are created using standard zip compression and are not password-protected.
- Template zip files follow a reasonable project structure (single root folder or direct project files, not multiple disconnected trees).
- The existing JSZip library (already used for GitHub zipball extraction) will be reused for local zip extraction.
- File size limits match the existing GitHub fetcher: individual files under 100KB, standard project-sized templates (typically under 5MB total).
- The templates directory is read-accessible at runtime (not blocked by filesystem permissions).
