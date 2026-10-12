import ignore from 'ignore';
import { STARTER_TEMPLATES } from './constants';
import { createCommandActionsString, detectProjectCommands } from './projectCommands';
import type { ProviderInfo } from '~/types/model';

export const selectStarterTemplate = async (options: { message: string; model?: string; provider?: ProviderInfo }) => {
  const { message } = options;

  const requestedFrameworks: [RegExp, string][] = [
    [/\bnext\.?js\b/i, /\bshadcn\b/i.test(message) ? 'NextJS Shadcn' : 'blank'],
    [/\bshadcn\b/i, 'Vite Shadcn'],
    [/\bastro\b/i, 'Basic Astro'],
    [/\bexpo\b/i, 'Expo App'],
    [/\bremix\b/i, 'Remix Typescript'],
    [/\bqwik\b/i, 'Qwik Typescript'],
    [/\bsvelte(?:kit)?\b/i, 'Sveltekit'],
    [/\bvue(?:\.js)?\b/i, 'Vue'],
    [/\bangular\b/i, 'Angular'],
    [/\bsolid(?:js)?\b/i, 'SolidJS'],
    [/\breact\b/i, 'Vite React'],
  ];

  const requestedTemplate = requestedFrameworks.find(([pattern]) => pattern.test(message));

  if (requestedTemplate) {
    return { template: requestedTemplate[1], title: message.trim().slice(0, 100) };
  }

  const simpleTask = /\b(script|snippet|one[- ]off|quick calculation|simple command)\b/i.test(message);

  return {
    template: simpleTask ? 'blank' : 'Vite React',
    title: message.trim().slice(0, 100) || 'Untitled Project',
  };
};

const getGitHubRepoContent = async (
  repoName: string,
  signal?: AbortSignal,
): Promise<{ name: string; path: string; content: string }[]> => {
  try {
    // Instead of directly fetching from GitHub, use our own API endpoint as a proxy
    const response = await fetch(`/api/github-template?repo=${encodeURIComponent(repoName)}`, { signal });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Our API will return the files in the format we need
    const files = (await response.json()) as any;

    return files;
  } catch (error) {
    console.error('Error fetching release contents:', error);
    throw error;
  }
};

export async function getTemplates(templateName: string, title?: string, signal?: AbortSignal) {
  const template = STARTER_TEMPLATES.find((t) => t.name == templateName);

  if (!template) {
    return null;
  }

  const githubRepo = template.githubRepo;
  const files = await getGitHubRepoContent(githubRepo, signal);

  if (!files.length) {
    throw new Error('The starter template did not contain any files.');
  }

  let filteredFiles = files;

  /*
   * ignoring common unwanted files
   * exclude    .git
   */
  filteredFiles = filteredFiles.filter((x) => x.path.startsWith('.git') == false);

  /*
   * exclude    lock files
   * WE NOW INCLUDE LOCK FILES FOR IMPROVED INSTALL TIMES
   */
  {
    /*
     *const comminLockFiles = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];
     *filteredFiles = filteredFiles.filter((x) => comminLockFiles.includes(x.name) == false);
     */
  }

  // exclude    .bolt
  filteredFiles = filteredFiles.filter((x) => x.path.startsWith('.bolt') == false);

  // check for ignore file in .bolt folder
  const templateIgnoreFile = files.find((x) => x.path.startsWith('.bolt') && x.name == 'ignore');

  const filesToImport = {
    files: filteredFiles,
    ignoreFile: [] as typeof filteredFiles,
  };

  if (templateIgnoreFile) {
    // redacting files specified in ignore file
    const ignorepatterns = templateIgnoreFile.content.split('\n').map((x) => x.trim());
    const ig = ignore().add(ignorepatterns);

    // filteredFiles = filteredFiles.filter(x => !ig.ignores(x.path))
    const ignoredFiles = filteredFiles.filter((x) => ig.ignores(x.path));

    filesToImport.files = filteredFiles;
    filesToImport.ignoreFile = ignoredFiles;
  }

  const assistantMessage = `
Bolt is initializing your project with the required files using the ${template.name} template.
<boltArtifact id="imported-files" title="${title || 'Create initial files'}" type="bundled">
${filesToImport.files
  .map(
    (file) =>
      `<boltAction type="file" filePath="${file.path}">
${file.content}
</boltAction>`,
  )
  .join('\n')}
</boltArtifact>
`;

  const commandActions = createCommandActionsString(await detectProjectCommands(filesToImport.files));

  const setupMessage = commandActions
    ? `<boltArtifact id="project-setup" title="Project Setup" type="bundled">${commandActions}\n</boltArtifact>`
    : '';

  let userMessage = ``;

  const templatePromptFile = files.filter((x) => x.path.startsWith('.bolt')).find((x) => x.name == 'prompt');

  if (templatePromptFile) {
    userMessage = `
TEMPLATE INSTRUCTIONS:
${templatePromptFile.content}

---
`;
  }

  if (filesToImport.ignoreFile.length > 0) {
    userMessage =
      userMessage +
      `
STRICT FILE ACCESS RULES - READ CAREFULLY:

The following files are READ-ONLY and must never be modified:
${filesToImport.ignoreFile.map((file) => `- ${file.path}`).join('\n')}

Permitted actions:
✓ Import these files as dependencies
✓ Read from these files
✓ Reference these files

Strictly forbidden actions:
❌ Modify any content within these files
❌ Delete these files
❌ Rename these files
❌ Move these files
❌ Create new versions of these files
❌ Suggest changes to these files

Any attempt to modify these protected files will result in immediate termination of the operation.

If you need to make changes to functionality, create new files instead of modifying the protected ones listed above.
---
`;
  }

  userMessage += `
---
The template files are now in the active project. Modify existing files when the requested features require it, and create new files when useful. The project_write_file tool replaces an existing file by default; set overwrite to false only when you need to protect an existing file from replacement.
---
Now that the Template is imported please continue with my original request

The user's original prompt is authorization to complete the requested work. Start implementing it now. Do not respond with a plan, ask whether to proceed, or wait for another user message. Modify the starter files as needed, install dependencies, and start the app with \`npm install && npm run dev\`. Continue until the requested app is implemented and running.
`;

  return {
    assistantMessage,
    setupMessage,
    userMessage,
    files: filesToImport.files,
  };
}
