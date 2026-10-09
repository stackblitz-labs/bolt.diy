import type { Message } from 'ai';
import JSZip from 'jszip';
import { generateId, shouldIncludeFile } from './fileUtils';
import { escapeBoltTags } from './projectCommands';

/**
 * Checks whether a Uint8Array looks like a binary file.
 * Mirrors the logic in isBinaryFile (fileUtils.ts) but works directly
 * with raw bytes instead of a browser File object.
 */
function isBinaryBuffer(buffer: Uint8Array): boolean {
  const checkLength = Math.min(buffer.length, 1024);

  for (let i = 0; i < checkLength; i++) {
    const byte = buffer[i];

    if (byte === 0 || (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13)) {
      return true;
    }
  }

  return false;
}

/**
 * Detects and returns a common root prefix that all file paths share
 * (e.g. "my-project/" when macOS Compress or GitHub wraps everything
 * in a top-level folder). Returns an empty string if there is no such
 * prefix, or if the prefix would consume all path segments.
 */
function detectRootPrefix(paths: string[]): string {
  if (paths.length === 0) {
    return '';
  }

  const firstSegment = paths[0].split('/')[0] + '/';
  const allSharePrefix = paths.every((p) => p.startsWith(firstSegment));

  // Make sure the prefix is not the entire path of every file
  const prefixIsWholeFile = paths.every((p) => p === firstSegment || p === firstSegment.slice(0, -1));

  if (allSharePrefix && !prefixIsWholeFile && firstSegment !== '/') {
    return firstSegment;
  }

  return '';
}

export interface ZipImportResult {
  messages: Message[];
  skippedBinary: number;
  skippedIgnored: number;
  totalFiles: number;
  hasPackageJson: boolean;
  hasExpoConfig: boolean;
}

/**
 * Reads a ZIP file and converts its contents into the same boltArtifact
 * chat-message structure that createChatFromFolder produces. This lets
 * bolt load the project correctly without writing directly to the
 * WebContainer filesystem (which can be wiped by navigation resets).
 */
export const createChatFromZip = async (zipFile: File): Promise<ZipImportResult> => {
  const zip = new JSZip();
  const contents = await zip.loadAsync(zipFile);

  // Collect all non-directory entries
  const allEntries = Object.entries(contents.files).filter(([, entry]) => !entry.dir);

  if (allEntries.length === 0) {
    throw new Error('The ZIP file contains no files.');
  }

  // Strip common root prefix (e.g. "my-project/" from macOS Compress)
  const rawPaths = allEntries.map(([path]) => path);
  const prefix = detectRootPrefix(rawPaths);

  // Process every entry: resolve path, filter, read bytes
  const fileArtifacts: Array<{ path: string; content: string }> = [];
  const binaryFilePaths: string[] = [];
  let skippedIgnored = 0;

  for (const [rawPath, zipEntry] of allEntries) {
    const relativePath = prefix ? rawPath.slice(prefix.length) : rawPath;

    // Skip empty paths that arise when stripping the prefix of the root dir entry itself
    if (!relativePath) {
      continue;
    }

    // Apply the same ignore rules as ImportFolderButton
    if (!shouldIncludeFile(relativePath)) {
      skippedIgnored++;
      continue;
    }

    const buffer = await zipEntry.async('uint8array');

    if (isBinaryBuffer(buffer)) {
      binaryFilePaths.push(relativePath);
      continue;
    }

    const content = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
    fileArtifacts.push({ path: relativePath, content });
  }

  if (fileArtifacts.length === 0) {
    throw new Error('No readable text files found in the ZIP (all files were binary or ignored).');
  }

  // Detect whether this is a Node project so we can craft the follow-up prompt
  const hasPackageJson = fileArtifacts.some((f) => f.path === 'package.json' || f.path.endsWith('/package.json'));

  /*
   * Detect Expo/React Native projects so we can suppress the "npm install
   * and start dev server" prompt — WebContainer can't run native mobile code.
   * We check for app.json / app.config.js (Expo-specific config files) or
   * an "expo" key in the package.json dependencies.
   */
  const hasExpoConfig =
    fileArtifacts.some((f) => f.path === 'app.json' || f.path === 'app.config.js' || f.path === 'app.config.ts') ||
    fileArtifacts.some((f) => {
      if (f.path !== 'package.json') {
        return false;
      }

      try {
        const pkg = JSON.parse(f.content);
        return !!(pkg.dependencies?.expo || pkg.devDependencies?.expo);
      } catch {
        return false;
      }
    });

  /*
   * For Expo projects, strip the scripts from package.json so bolt has
   * nothing to execute even if it tries. The user will run the project
   * locally with Expo CLI. We preserve the rest of package.json intact.
   */
  if (hasExpoConfig) {
    const pkgIndex = fileArtifacts.findIndex((f) => f.path === 'package.json');

    if (pkgIndex !== -1) {
      try {
        const pkg = JSON.parse(fileArtifacts[pkgIndex].content);
        pkg.scripts = {
          _note: 'Run this project locally: npx expo start',
        };
        fileArtifacts[pkgIndex] = {
          ...fileArtifacts[pkgIndex],
          content: JSON.stringify(pkg, null, 2),
        };
      } catch {
        /* If package.json is unparseable, leave it as-is */
      }
    }
  }

  const folderName = zipFile.name.replace(/\.zip$/i, '');

  const binaryFilesMessage =
    binaryFilePaths.length > 0
      ? `\n\nSkipped ${binaryFilePaths.length} binary file${binaryFilePaths.length === 1 ? '' : 's'}:\n${binaryFilePaths.map((f) => `- ${f}`).join('\n')}`
      : '';

  const filesMessage: Message = {
    role: 'assistant',
    content: `I've imported the contents of the "${folderName}" ZIP archive.${binaryFilesMessage}

<boltArtifact id="imported-files" title="Imported Files" type="bundled">
${fileArtifacts
  .map(
    (file) => `<boltAction type="file" filePath="${file.path}">
${escapeBoltTags(file.content)}
</boltAction>`,
  )
  .join('\n\n')}
</boltArtifact>`,
    id: generateId(),
    createdAt: new Date(),
  };

  const userMessage: Message = {
    role: 'user',
    id: generateId(),
    content: `Import the "${folderName}" project from ZIP`,
    createdAt: new Date(),
  };

  const messages: Message[] = [userMessage, filesMessage];

  return {
    messages,
    skippedBinary: binaryFilePaths.length,
    skippedIgnored,
    totalFiles: fileArtifacts.length + binaryFilePaths.length + skippedIgnored,
    hasPackageJson,
    hasExpoConfig,
  };
};
