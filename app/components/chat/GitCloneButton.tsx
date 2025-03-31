import ignore from 'ignore';
import { useGit } from '~/lib/hooks/useGit';
import type { Message } from 'ai';
import { detectProjectCommands, createCommandsMessage, escapeBoltTags } from '~/utils/projectCommands';
import { generateId } from '~/utils/fileUtils';
import { useState } from 'react';
import { toast } from 'react-toastify';
import { LoadingOverlay } from '~/components/ui/LoadingOverlay';
import { RepositorySelectionDialog } from '~/components/@settings/tabs/connections/components/RepositorySelectionDialog';
import { classNames } from '~/utils/classNames';
import { Button } from '~/components/ui/Button';
import type { IChatMetadata } from '~/lib/persistence/db';

const IGNORE_PATTERNS = [
  'node_modules/**',
  '.git/**',
  '.github/**',
  '.vscode/**',
  'dist/**',
  'build/**',
  '.next/**',
  'coverage/**',
  '.cache/**',
  '.idea/**',
  '**/*.log',
  '**/.DS_Store',
  '**/npm-debug.log*',
  '**/yarn-debug.log*',
  '**/yarn-error.log*',
  '**/*lock.json',
  '**/*lock.yaml',
];

const ig = ignore().add(IGNORE_PATTERNS);

const MAX_FILE_SIZE = 500 * 1024; // 500KB limit per file (increased from 100KB)
const MAX_TOTAL_SIZE = 2 * 1024 * 1024; // 2MB total limit (increased from 500KB)

// Binary file extensions that should be skipped
const BINARY_EXTENSIONS = [
  // Images
  'png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff', 'webp', 'ico', 'heic', 'avif',
  // Audio/Video
  'mp3', 'wav', 'ogg', 'mp4', 'avi', 'mov', 'webm', 'flac', 'aac', 'mkv',
  // Archives
  'zip', 'rar', 'tar', 'gz', '7z', 'bz2', 'xz',
  // Documents
  'pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx',
  // Executables
  'exe', 'dll', 'so', 'dylib', 'bin', 'apk', 'dmg', 'iso',
  // Other known binary formats
  'ttf', 'otf', 'woff', 'woff2', 'eot', 'class', 'o', 'pyc', 'pyd'
];

// Function to check if a file is likely binary based on extension
const isBinaryFileByExtension = (filePath: string): boolean => {
  const extension = filePath.split('.').pop()?.toLowerCase();
  return extension ? BINARY_EXTENSIONS.includes(extension) : false;
};

// Function to check if data is likely binary content
const isBinaryContent = (data: Uint8Array): boolean => {
  // Check a sample of the file for null bytes or other binary indicators
  const sampleSize = Math.min(1000, data.length);
  for (let i = 0; i < sampleSize; i++) {
    // Check for null bytes and other control characters (except common ones like newline, tab)
    const byte = data[i];
    if (byte === 0 || (byte < 9 && byte !== 0) || (byte > 13 && byte < 32)) {
      return true;
    }
  }
  return false;
};

interface GitCloneButtonProps {
  className?: string;
  importChat?: (description: string, messages: Message[], metadata?: IChatMetadata) => Promise<void>;
}

export default function GitCloneButton({ importChat, className }: GitCloneButtonProps) {
  const { ready, gitClone } = useGit();
  const [loading, setLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleClone = async (repoUrl: string) => {
    if (!ready) {
      return;
    }

    setLoading(true);

    try {
      const { workdir, data } = await gitClone(repoUrl);

      if (importChat) {
        const filePaths = Object.keys(data).filter((filePath) => !ig.ignores(filePath));
        const textDecoder = new TextDecoder('utf-8');

        let totalSize = 0;
        const skippedFiles: string[] = [];
        const fileContents = [];

        for (const filePath of filePaths) {
          const { data: content, encoding } = data[filePath];

          // Skip files that are likely binary based on extension
          if (isBinaryFileByExtension(filePath)) {
            skippedFiles.push(`${filePath} (binary file type)`);
            continue;
          }

          try {
            // For Uint8Array content, check if it's actually binary
            if (content instanceof Uint8Array) {
              if (isBinaryContent(content)) {
                skippedFiles.push(`${filePath} (binary content detected)`);
                continue;
              }
            }

            const textContent =
              encoding === 'utf8' ? content : content instanceof Uint8Array ? textDecoder.decode(content) : '';

            if (!textContent) {
              skippedFiles.push(`${filePath} (empty or unreadable)`);
              continue;
            }

            // Check file size
            const fileSize = new TextEncoder().encode(textContent).length;

            if (fileSize > MAX_FILE_SIZE) {
              skippedFiles.push(`${filePath} (too large: ${Math.round(fileSize / 1024)}KB)`);
              continue;
            }

            // Check total size
            if (totalSize + fileSize > MAX_TOTAL_SIZE) {
              skippedFiles.push(`${filePath} (would exceed total size limit)`);
              continue;
            }

            totalSize += fileSize;
            fileContents.push({
              path: filePath,
              content: textContent,
            });
          } catch (e: any) {
            skippedFiles.push(`${filePath} (error: ${e.message})`);
          }
        }

        const commands = await detectProjectCommands(fileContents);
        const commandsMessage = createCommandsMessage(commands);

        const filesMessage: Message = {
          role: 'assistant',
          content: `Cloning the repo ${repoUrl} into ${workdir}
${
  skippedFiles.length > 0
    ? `\nSkipped files (${skippedFiles.length}):
${skippedFiles.map((f) => `- ${f}`).join('\n')}`
    : ''
}

<boltArtifact id="imported-files" title="Git Cloned Files" type="bundled">
${fileContents
  .map(
    (file) =>
      `<boltAction type="file" filePath="${file.path}">
${escapeBoltTags(file.content)}
</boltAction>`,
  )
  .join('\n')}
</boltArtifact>`,
          id: generateId(),
          createdAt: new Date(),
        };

        const messages = [filesMessage];

        if (commandsMessage) {
          messages.push(commandsMessage);
        }

        await importChat(`Git Project:${repoUrl.split('/').slice(-1)[0]}`, messages);
      }
    } catch (error) {
      console.error('Error during import:', error);
      toast.error('Failed to import repository');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => setIsDialogOpen(true)}
        title="Clone a Git Repo"
        variant="outline"
        size="lg"
        className={classNames(
          'gap-2 bg-bolt-elements-background-depth-1',
          'text-bolt-elements-textPrimary',
          'hover:bg-bolt-elements-background-depth-2',
          'border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.08)]',
          'h-10 px-4 py-2 min-w-[120px] justify-center',
          'transition-all duration-200 ease-in-out',
          className,
        )}
        disabled={!ready || loading}
      >
        <span className="i-ph:git-branch w-4 h-4" />
        Clone a Git Repo
      </Button>

      <RepositorySelectionDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} onSelect={handleClone} />

      {loading && <LoadingOverlay message="Please wait while we clone the repository..." />}
    </>
  );
}
