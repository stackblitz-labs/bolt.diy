# Implementation Plan: Zip File Template Support

**Branch**: `003-zip-template-support` | **Date**: 2026-01-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-zip-template-support/spec.md`

## Summary

Add an alternative template source that loads website templates from local zip files in the `templates/` directory instead of fetching from GitHub. The system uses convention-based discovery (`{template-name}.zip` maps to template `name` property) and prioritizes local zips over GitHub when both are available. This provides faster loading, offline capability, and eliminates GitHub API rate limit concerns.

**Technical Approach**: Create a new server-side `zip-template-fetcher.ts` module that mirrors the existing `github-template-fetcher.ts` interface. Modify the template fetching flow in `projectGenerationService.ts` and `selectStarterTemplate.ts` to check for local zip files first before falling back to GitHub.

## Technical Context

**Language/Version**: TypeScript 5.7.2 (strict mode)
**Primary Dependencies**: JSZip (already installed for GitHub zipball extraction), Remix 2.15.2, Node.js fs/promises
**Storage**: Local filesystem (`templates/*.zip`), no database changes
**Testing**: Vitest for unit/integration tests
**Target Platform**: Node.js server (Remix loaders/actions), Cloudflare Pages edge (with constraints)
**Project Type**: Web application (Remix)
**Performance Goals**: <2 seconds for 50-file template extraction (vs 5-10s GitHub fetch)
**Constraints**: Cloudflare Pages has no filesystem access; local dev and Electron have full fs access
**Scale/Scope**: ~25 templates in STARTER_TEMPLATES, typically 30-80 files per template

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution is a template placeholder. Applying general principles:

| Principle | Status | Notes |
|-----------|--------|-------|
| Code Quality | PASS | TypeScript strict mode, Zod schemas for validation |
| Testing Discipline | PASS | Will add unit tests for zip extraction |
| UX Consistency | N/A | No UI changes in this feature |
| Performance Budgets | PASS | Target <2s extraction aligns with spec SC-001 |

**No violations requiring justification.**

## Project Structure

### Documentation (this feature)

```text
specs/003-zip-template-support/
├── plan.md              # This file
├── research.md          # Phase 0: Design decisions
├── data-model.md        # Phase 1: Entity definitions
├── quickstart.md        # Phase 1: Implementation guidance
├── contracts/           # Phase 1: API contracts (if needed)
└── tasks.md             # Phase 2: Task breakdown (created by /speckit.tasks)
```

### Source Code (repository root)

```text
app/
├── lib/
│   └── .server/
│       └── templates/
│           ├── github-template-fetcher.ts    # Existing - no changes
│           ├── zip-template-fetcher.ts       # NEW: Local zip extraction
│           ├── template-resolver.ts          # NEW: Source resolution logic
│           ├── template-primer.ts            # Existing - no changes
│           └── index.ts                      # Update exports
├── routes/
│   └── api.github-template.ts                # Update to use resolver
├── services/
│   └── projectGenerationService.ts           # Update template fetch call
└── utils/
    └── selectStarterTemplate.ts              # Update getTemplates() function

templates/
├── registry.json                             # Existing (not used for zip resolution)
├── indochine-luxe.zip                        # Existing sample template
└── {template-name}.zip                       # Convention: name matches STARTER_TEMPLATES

tests/
└── unit/
    └── templates/
        └── zip-template-fetcher.test.ts      # NEW: Unit tests
```

**Structure Decision**: This feature extends the existing `.server/templates/` module with new files. No new directories or architectural changes needed. The pattern follows existing code organization.

## Complexity Tracking

No constitution violations to justify.

## Key Design Decisions

### 1. Cloudflare vs Local Environment

**Decision**: Zip template loading only works in Node.js environments (local dev, Electron). On Cloudflare Pages, fall back to GitHub fetch.

**Rationale**:
- Cloudflare Workers/Pages have no filesystem access (`fs` module unavailable)
- The existing `api.github-template.ts` already has environment detection via `isCloudflareEnvironment()`
- For production use, templates can be pre-fetched and cached in R2/KV (future enhancement)

### 2. Convention-Based Discovery

**Decision**: Check for `templates/{template-name}.zip` based on the `name` property in `STARTER_TEMPLATES`.

**Rationale**:
- Simplest approach - no registry updates needed
- Template name like `"Indochine Luxe"` maps to `indochine-luxe.zip` (kebab-case conversion)
- Matches existing template naming conventions

### 3. Path Normalization

**Decision**: Strip root folder wrapper from zip files (e.g., `indochine-luxe/src/...` → `src/...`)

**Rationale**:
- GitHub zipballs and manually created zips often have a root folder
- Existing `github-template-fetcher.ts` already does this (lines 114-136)
- Consistent file paths regardless of source

### 4. Binary File Handling

**Decision**: Use same binary detection as GitHub fetcher (extension-based)

**Rationale**:
- Consistent behavior across sources
- Reuse existing `binaryExtensions` list
- Binary files excluded from content (marked but not read as text)

### 5. Security: Path Traversal Protection

**Decision**: Validate all extracted paths contain no `..` segments and are relative

**Rationale**:
- Prevents zip slip attacks where malicious zips escape extraction directory
- Templates are trusted internal assets, but defense-in-depth is good practice
- Simple path validation is sufficient (no zip bomb protection needed per spec clarification)

## Integration Points

### 1. `fetchTemplateFromGitHub()` call sites

Current call sites that need to use the new resolver:

1. **`projectGenerationService.ts:398`** - `fetchTemplateFromGitHub(template.githubRepo, githubToken)`
2. **`selectStarterTemplate.ts:367`** - `getGitHubRepoContent(repoName)` via `/api/github-template`

### 2. Template Resolution Flow

```
User selects template (e.g., "Indochine Luxe")
    ↓
resolveTemplateSource(templateName)
    ↓
Check: Does templates/indochine-luxe.zip exist?
    ↓
├── YES → fetchTemplateFromZip('indochine-luxe.zip')
│           ↓
│         Return TemplateFile[]
│
└── NO → fetchTemplateFromGitHub(githubRepo, token)
           ↓
         Return TemplateFile[]
```

### 3. Return Type Compatibility

Both fetchers must return the same interface:
```typescript
interface TemplateFile {
  name: string;    // Filename only (e.g., "App.tsx")
  path: string;    // Relative path (e.g., "src/App.tsx")
  content: string; // File content
}
```

## Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `app/lib/.server/templates/zip-template-fetcher.ts` | Extract files from local zip |
| `app/lib/.server/templates/template-resolver.ts` | Unified resolution (zip → GitHub fallback) |
| `tests/unit/templates/zip-template-fetcher.test.ts` | Unit tests |

### Modified Files

| File | Change |
|------|--------|
| `app/lib/.server/templates/index.ts` | Export new functions |
| `app/lib/services/projectGenerationService.ts` | Use `resolveTemplate()` instead of direct GitHub fetch |
| `app/utils/selectStarterTemplate.ts` | Update `getTemplates()` to use resolver |
| `app/routes/api.github-template.ts` | Optionally add zip support (or keep GitHub-only) |

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Cloudflare fs not available | Certain | Low | Environment detection, graceful fallback to GitHub |
| Zip file corruption | Low | Medium | Clear error messages, validation |
| Path traversal attack | Low | High | Path validation before extraction |
| Performance regression | Low | Medium | Benchmarking, async extraction |
| Template format mismatch | Medium | Low | Same filtering/normalization as GitHub |

## Next Steps

1. **Phase 0**: Create `research.md` with detailed design decisions
2. **Phase 1**: Create `data-model.md`, `contracts/`, and `quickstart.md`
3. **Phase 2**: Generate `tasks.md` via `/speckit.tasks`
4. **Implementation**: Execute tasks in dependency order
