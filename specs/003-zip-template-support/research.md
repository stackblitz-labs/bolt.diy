# Research: Zip File Template Support

**Feature**: 003-zip-template-support
**Date**: 2026-01-30
**Purpose**: Document design decisions, alternatives considered, and research findings

## 1. Environment Detection Strategy

### Decision
Use environment detection to determine whether to use local zip files or GitHub fetch.

### Rationale
- **Cloudflare Pages**: No `fs` module access. Workers run in V8 isolates without Node.js APIs.
- **Local Development**: Full Node.js runtime with `fs/promises` available.
- **Electron**: Full Node.js runtime (main process).

### Implementation
The existing pattern in `api.github-template.ts` provides a reference:

```typescript
function isCloudflareEnvironment(context: any): boolean {
  const isProduction = process.env.NODE_ENV === 'production';
  const hasCfPagesVars = !!(
    context?.cloudflare?.env?.CF_PAGES ||
    context?.cloudflare?.env?.CF_PAGES_URL ||
    context?.cloudflare?.env?.CF_PAGES_COMMIT_SHA
  );
  return isProduction && hasCfPagesVars;
}
```

For the template resolver, we'll add a simpler check:

```typescript
function canAccessFileSystem(): boolean {
  try {
    // Check if fs module is available (will fail in Cloudflare)
    require('fs');
    return true;
  } catch {
    return false;
  }
}
```

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| Always use GitHub in production | Defeats purpose of zip templates for offline/speed |
| Bundle zips as base64 in code | Bloats JS bundle, increases cold start |
| Use Cloudflare R2 for templates | Adds complexity, still requires network |
| Dynamic import of fs | Same restrictions apply |

## 2. Template Name to Zip Filename Mapping

### Decision
Convert template `name` to kebab-case for zip filename lookup.

### Rationale
- Template names in `STARTER_TEMPLATES` use mixed formats: `"Indochine Luxe"`, `"Vite React"`, `"Bold Feast v2"`
- Zip filenames should be lowercase kebab-case for consistency
- Existing zip: `indochine-luxe.zip` matches pattern

### Implementation

```typescript
function templateNameToZipFilename(templateName: string): string {
  return templateName
    .toLowerCase()
    .replace(/\s+/g, '-')      // Replace spaces with hyphens
    .replace(/[^a-z0-9-]/g, '') // Remove special chars except hyphens
    + '.zip';
}

// Examples:
// "Indochine Luxe" → "indochine-luxe.zip"
// "Bold Feast v2" → "bold-feast-v2.zip"
// "Artisan Hearth v3" → "artisan-hearth-v3.zip"
```

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| Exact name match | Would require `"Indochine Luxe.zip"` with spaces - filesystem issues |
| Use `restaurantThemeId` | Only available for restaurant templates, not generic ones |
| Registry lookup | Adds complexity; spec says convention-based |

## 3. Zip Structure Normalization

### Decision
Detect and strip single root folder wrapper from zip contents.

### Rationale
- GitHub zipballs have format: `{owner}-{repo}-{commit}/...`
- User-created zips often have: `{folder-name}/...`
- Sample zip `indochine-luxe.zip` has: `indochine-luxe/src/App.tsx`
- MacOS zip creates `__MACOSX/` metadata folders to filter out

### Implementation

```typescript
function findRootFolder(zip: JSZip): string | null {
  const entries = Object.keys(zip.files);

  // Filter out __MACOSX entries
  const validEntries = entries.filter(e => !e.startsWith('__MACOSX'));

  // Check if all entries share a common root folder
  const folders = new Set<string>();
  for (const entry of validEntries) {
    const parts = entry.split('/');
    if (parts.length > 1) {
      folders.add(parts[0]);
    }
  }

  // If exactly one folder at root, it's a wrapper
  if (folders.size === 1) {
    return folders.values().next().value;
  }

  return null;
}
```

### Filtering Patterns

Filter out (consistent with GitHub fetcher):
- `__MACOSX/` - MacOS metadata
- `.git/` - Git directory
- `.DS_Store` - MacOS file
- Lock files: `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`
- Files > 100KB

## 4. Path Traversal Protection

### Decision
Validate all extracted paths before use; reject paths with `..` or absolute paths.

### Rationale
- Zip slip vulnerability: malicious zip with paths like `../../../etc/passwd`
- Even trusted internal templates should be validated (defense-in-depth)
- Simple validation is sufficient; no complex sandboxing needed

### Implementation

```typescript
function isPathSafe(filePath: string): boolean {
  // Reject absolute paths
  if (filePath.startsWith('/') || filePath.startsWith('\\')) {
    return false;
  }

  // Reject path traversal attempts
  const normalized = path.normalize(filePath);
  if (normalized.includes('..')) {
    return false;
  }

  // Reject Windows-style paths that might escape
  if (filePath.includes(':')) {
    return false;
  }

  return true;
}
```

## 5. Binary File Detection

### Decision
Use extension-based detection, matching existing GitHub fetcher.

### Rationale
- Consistent behavior between sources
- Extension list already defined in `github-template-fetcher.ts`
- Binary files are excluded from `content` (not base64 encoded)

### Implementation

```typescript
const BINARY_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.mp3', '.mp4', '.webm', '.wav',
  '.pdf', '.zip', '.tar', '.gz',
];

function isBinaryFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return BINARY_EXTENSIONS.includes(ext);
}
```

## 6. Error Handling Strategy

### Decision
Provide clear, actionable error messages for common failure modes.

### Error Cases

| Error | User-Facing Message |
|-------|---------------------|
| Zip file not found | `Template zip file not found: templates/{name}.zip` |
| Zip corrupted | `Failed to extract template: invalid or corrupted zip file` |
| Empty zip | `Template zip file is empty: templates/{name}.zip` |
| Path traversal detected | `Invalid file path in template zip: {path}` |
| Read error | `Failed to read template zip: {system error}` |

### Implementation

```typescript
export class ZipTemplateError extends Error {
  constructor(
    message: string,
    public readonly code: 'NOT_FOUND' | 'CORRUPTED' | 'EMPTY' | 'INVALID_PATH' | 'READ_ERROR',
    public readonly zipPath?: string
  ) {
    super(message);
    this.name = 'ZipTemplateError';
  }
}
```

## 7. Integration Approach

### Decision
Create a unified `resolveTemplate()` function that abstracts the source.

### Rationale
- Minimal changes to existing code
- Single point of modification for future enhancements
- Consistent return type regardless of source

### Implementation

```typescript
// template-resolver.ts
export async function resolveTemplate(
  templateName: string,
  options: {
    githubRepo: string;
    githubToken?: string;
  }
): Promise<TemplateFile[]> {
  // Try local zip first (if fs available)
  if (canAccessFileSystem()) {
    const zipPath = getZipPath(templateName);
    if (await zipExists(zipPath)) {
      logger.info(`Loading template from zip: ${zipPath}`);
      return fetchTemplateFromZip(zipPath);
    }
  }

  // Fall back to GitHub
  logger.info(`Loading template from GitHub: ${options.githubRepo}`);
  return fetchTemplateFromGitHub(options.githubRepo, options.githubToken);
}
```

## 8. Testing Strategy

### Unit Tests

| Test Case | Description |
|-----------|-------------|
| `extracts files from valid zip` | Happy path with sample template |
| `strips root folder wrapper` | Tests normalization |
| `filters binary files` | Verifies extension-based detection |
| `filters oversized files` | Files > 100KB excluded |
| `rejects path traversal` | `../` paths rejected |
| `handles empty zip` | Returns error, not empty array |
| `handles corrupted zip` | Returns meaningful error |
| `applies ignore patterns` | `.git/`, `__MACOSX/` filtered |

### Integration Tests

| Test Case | Description |
|-----------|-------------|
| `resolver uses zip when available` | Priority check |
| `resolver falls back to GitHub` | When zip missing |
| `template priming works with zip source` | End-to-end flow |

## 9. Performance Considerations

### Expected Performance

| Metric | Zip (Local) | GitHub (API) |
|--------|-------------|--------------|
| Latency | ~50-200ms | ~2-10s |
| Network | None | 2 API calls |
| Rate Limits | None | GitHub rate limits |
| Offline | Works | Fails |

### Optimization Notes

- Use streaming extraction where possible
- Extract files in parallel (Promise.all)
- Cache extracted templates in memory (short TTL) for repeated access

## 10. Future Enhancements (Out of Scope)

Documented for future reference, not part of current implementation:

1. **Cloudflare R2 Support**: Store zips in R2, stream extract
2. **Template Versioning**: Include version in zip filename
3. **Auto-discovery**: Scan templates/ for available zips without registry
4. **Template Validation**: Verify required files present (package.json, etc.)
5. **Incremental Updates**: Only update changed files in WebContainer
