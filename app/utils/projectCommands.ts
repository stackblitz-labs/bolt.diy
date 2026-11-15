import type { UIMessage } from 'ai';
import { generateId } from './fileUtils';
import { createMessage } from '~/lib/persistence/messageMigration';

export interface ProjectCommands {
  type: string;
  setupCommand?: string;
  startCommand?: string;
  followupMessage: string;
}

interface FileContent {
  content: string;
  path: string;
}

export async function detectProjectCommands(files: FileContent[]): Promise<ProjectCommands> {
  const manifests = files.filter((file) => file.path.split('/').at(-1) === 'package.json');
  const packageFile = manifests.sort((a, b) => a.path.split('/').length - b.path.split('/').length)[0];

  if (!packageFile) {
    const htmlFile = files
      .filter((file) => file.path.split('/').at(-1) === 'index.html')
      .sort((a, b) => a.path.split('/').length - b.path.split('/').length)[0];

    if (htmlFile) {
      const projectDirectory = htmlFile.path.split('/').slice(0, -1).join('/');
      const prefix = projectDirectory ? `cd ${JSON.stringify(projectDirectory)} && ` : '';

      return { type: 'Static', startCommand: `${prefix}npx --yes serve`, followupMessage: '' };
    }

    return { type: '', followupMessage: '' };
  }

  try {
    const packageJson = JSON.parse(packageFile.content);
    const scripts = packageJson?.scripts || {};
    const preferredScript = ['dev', 'start', 'preview'].find((script) => typeof scripts[script] === 'string');
    const projectDirectory = packageFile.path.split('/').slice(0, -1).join('/');

    const hasFileInProject = (name: string) =>
      files.some((file) => {
        const directory = file.path.split('/').slice(0, -1).join('/');
        return directory === projectDirectory && file.path.split('/').at(-1) === name;
      });

    const detectedManager = packageJson.packageManager?.split('@')[0];

    const packageManager =
      typeof detectedManager === 'string' && ['npm', 'pnpm', 'yarn', 'bun'].includes(detectedManager)
        ? detectedManager
        : hasFileInProject('pnpm-lock.yaml')
          ? 'pnpm'
          : hasFileInProject('yarn.lock')
            ? 'yarn'
            : hasFileInProject('bun.lockb') || hasFileInProject('bun.lock')
              ? 'bun'
              : 'npm';
    const installCommands: Record<string, string> = {
      npm: 'npm install --no-audit --no-fund',
      pnpm: 'pnpm install --no-frozen-lockfile',
      yarn: 'yarn install --non-interactive',
      bun: 'bun install',
    };

    const setupCommand = installCommands[packageManager] || installCommands.npm;
    const prefix = projectDirectory ? `cd ${JSON.stringify(projectDirectory)} && ` : '';
    const startCommand = preferredScript ? `${prefix}${packageManager} run ${preferredScript}` : undefined;

    return {
      type: 'Node.js',
      setupCommand: `${prefix}${setupCommand}`,
      startCommand,
      followupMessage: '',
    };
  } catch (error) {
    console.error('Error parsing package.json:', error);
    return { type: '', followupMessage: '' };
  }
}

export function createCommandsMessage(commands: ProjectCommands): UIMessage | null {
  if (!commands.setupCommand && !commands.startCommand) {
    return null;
  }

  let commandString = '';

  if (commands.setupCommand) {
    commandString += `
<boltAction type="shell">${commands.setupCommand}</boltAction>`;
  }

  if (commands.startCommand) {
    commandString += `
<boltAction type="start">${commands.startCommand}</boltAction>
`;
  }

  return createMessage({
    role: 'assistant',
    id: generateId(),
    text: `
${commands.followupMessage ? `\n\n${commands.followupMessage}` : ''}
<boltArtifact id="project-setup" title="Project Setup">
${commandString}
</boltArtifact>`,
  }) as UIMessage;
}

export function escapeBoltArtifactTags(input: string) {
  // Regular expression to match boltArtifact tags and their content
  const regex = /(<boltArtifact[^>]*>)([\s\S]*?)(<\/boltArtifact>)/g;

  return input.replace(regex, (match, openTag, content, closeTag) => {
    // Escape the opening tag
    const escapedOpenTag = openTag.replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Escape the closing tag
    const escapedCloseTag = closeTag.replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Return the escaped version
    return `${escapedOpenTag}${content}${escapedCloseTag}`;
  });
}

export function escapeBoltAActionTags(input: string) {
  // Regular expression to match boltArtifact tags and their content
  const regex = /(<boltAction[^>]*>)([\s\S]*?)(<\/boltAction>)/g;

  return input.replace(regex, (match, openTag, content, closeTag) => {
    // Escape the opening tag
    const escapedOpenTag = openTag.replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Escape the closing tag
    const escapedCloseTag = closeTag.replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Return the escaped version
    return `${escapedOpenTag}${content}${escapedCloseTag}`;
  });
}

export function escapeBoltTags(input: string) {
  return escapeBoltArtifactTags(escapeBoltAActionTags(input));
}

// We have this seperate function to simplify the restore snapshot process in to one single artifact.
export function createCommandActionsString(commands: ProjectCommands): string {
  if (!commands.setupCommand && !commands.startCommand) {
    // Return empty string if no commands
    return '';
  }

  let commandString = '';

  if (commands.setupCommand) {
    commandString += `
<boltAction type="shell">${commands.setupCommand}</boltAction>`;
  }

  if (commands.startCommand) {
    commandString += `
<boltAction type="start">${commands.startCommand}</boltAction>
`;
  }

  return commandString;
}
