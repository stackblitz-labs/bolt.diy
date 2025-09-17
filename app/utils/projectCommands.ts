import type { Message } from '@ai-sdk/ui-utils';
import { generateId } from './fileUtils';
import {
  detectPackageManager,
  createInstallCommand,
  createRunCommand,
  createShadcnInitCommand,
  createFallbackInstallCommand,
  detectExpoProject,
  createExpoStartCommand,
  createExpoSetupCommand,
} from './platformUtils';

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
  const hasFile = (name: string) => files.some((f) => f.path.endsWith(name));

  if (hasFile('package.json')) {
    const packageJsonFile = files.find((f) => f.path.endsWith('package.json'));

    if (!packageJsonFile) {
      return { type: '', setupCommand: '', followupMessage: '' };
    }

    try {
      const packageJson = JSON.parse(packageJsonFile.content);
      const scripts = packageJson?.scripts || {};
      const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

      // Check if this is an Expo project first
      const expoInfo = detectExpoProject(hasFile, dependencies);

      if (expoInfo.isExpo) {
        const { pm } = detectPackageManager(hasFile);
        const setupCommand = createExpoSetupCommand(pm, expoInfo);
        const startCommand = createExpoStartCommand(expoInfo, { mode: 'tunnel' });

        const workflowText = expoInfo.workflowType === 'bare' ? 'bare workflow' : 'managed workflow';
        const followupMessage = `Detected Expo project (${workflowText}). Starting development server with tunnel mode for mobile testing. Scan QR code with Expo Go app.`;

        return {
          type: 'Expo',
          setupCommand,
          startCommand,
          followupMessage,
        };
      }

      // Check if this is a shadcn project (more specific detection)
      const isShadcnProject = hasFile('components.json') || dependencies['@shadcn/ui'] || dependencies['shadcn-ui'];

      // Check for preferred commands in priority order
      const preferredCommands = ['dev', 'start', 'preview'];
      const availableCommand = preferredCommands.find((cmd) => scripts[cmd]);

      // Detect package manager based on lock files with confidence scoring
      const { pm, confidence } = detectPackageManager(hasFile);

      // Create cross-platform install command with proper error handling
      const installCmd = createInstallCommand(
        pm,
        {},
        {
          silent: true,
          production: false,
          offline: true,
          legacyPeerDeps: true,
          noAudit: true,
          noFund: true,
          retries: confidence === 'high' ? 3 : 1,
        },
      );

      // Create fallback install command for edge cases
      const fallbackInstallCmd = createFallbackInstallCommand(pm);

      // Build setup command with fallback strategy
      let baseSetupCommand = confidence === 'high' ? installCmd : fallbackInstallCmd;

      // Add shadcn init if it's a shadcn project (cross-platform with timeout)
      if (isShadcnProject && !hasFile('components.json')) {
        const shadcnCmd = createShadcnInitCommand();
        baseSetupCommand += ` && ${shadcnCmd}`;
      }

      const setupCommand = baseSetupCommand;

      if (availableCommand) {
        const startCommand = createRunCommand(pm, availableCommand);
        return {
          type: 'Node.js',
          setupCommand,
          startCommand,
          followupMessage: `Found "${availableCommand}" script in package.json. Using ${pm} (${confidence} confidence) for package management.`,
        };
      }

      return {
        type: 'Node.js',
        setupCommand,
        followupMessage:
          'Would you like me to inspect package.json to determine the available scripts for running this project?',
      };
    } catch (error) {
      console.error('Error parsing package.json:', error);

      // Fallback to basic npm install if package.json is corrupted
      const fallbackInstall = createFallbackInstallCommand('npm');

      return {
        type: 'Node.js',
        setupCommand: fallbackInstall,
        followupMessage:
          'package.json parsing failed, using fallback npm install. Please check your package.json for syntax errors.',
      };
    }
  }

  if (hasFile('index.html')) {
    const serveCommand = createFallbackInstallCommand('npm').includes('npm')
      ? 'npx --yes serve'
      : 'python -m http.server 8000 || python3 -m http.server 8000';

    return {
      type: 'Static',
      startCommand: serveCommand,
      followupMessage: 'Detected static HTML project. Starting local server.',
    };
  }

  return { type: '', setupCommand: '', followupMessage: '' };
}

export function createCommandsMessage(commands: ProjectCommands): Message | null {
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

  return {
    role: 'assistant',
    content: `
${commands.followupMessage ? `\n\n${commands.followupMessage}` : ''}
<boltArtifact id="project-setup" title="Project Setup">
${commandString}
</boltArtifact>`,
    id: generateId(),
    createdAt: new Date(),
  };
}

export function escapeBoltArtifactTags(input: string) {
  // Regular expression to match boltArtifact tags and their content
  const regex = /(<boltArtifact[^>]*>)([\s\S]*?)(<\/boltArtifact>)/g;

  return input.replace(regex, (_match, openTag, content, closeTag) => {
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

  return input.replace(regex, (_match, openTag, content, closeTag) => {
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
