import type { UIMessage } from 'ai';
import { generateId } from './fileUtils';
import { detectProjectCommands, createCommandsMessage, escapeBoltTags } from './projectCommands';
import { createMessage } from '~/lib/persistence/messageMigration';

export const createChatFromFolder = async (
  files: File[],
  binaryFiles: string[],
  folderName: string,
): Promise<UIMessage[]> => {
  const fileArtifacts = await Promise.all(
    files.map(async (file) => {
      return new Promise<{ content: string; path: string }>((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
          const content = reader.result as string;
          const relativePath = file.webkitRelativePath.split('/').slice(1).join('/');
          resolve({
            content,
            path: relativePath,
          });
        };
        reader.onerror = reject;
        reader.readAsText(file);
      });
    }),
  );

  const commands = await detectProjectCommands(fileArtifacts);
  const commandsMessage = createCommandsMessage(commands);

  const binaryFilesMessage =
    binaryFiles.length > 0
      ? `\n\nSkipped ${binaryFiles.length} binary files:\n${binaryFiles.map((f) => `- ${f}`).join('\n')}`
      : '';

  const filesMessage = createMessage({
    role: 'assistant',
    id: generateId(),
    text: `I've imported the contents of the "${folderName}" folder.${binaryFilesMessage}

<boltArtifact id="imported-files" title="Imported Files" type="bundled" >
${fileArtifacts
  .map(
    (file) => `<boltAction type="file" filePath="${file.path}">
${escapeBoltTags(file.content)}
</boltAction>`,
  )
  .join('\n\n')}
</boltArtifact>`,
  });

  const userMessage = createMessage({
    role: 'user',
    id: generateId(),
    text: `Import the "${folderName}" folder`,
  });

  const messages: UIMessage[] = [userMessage as UIMessage, filesMessage as UIMessage];

  if (commandsMessage) {
    messages.push(
      createMessage({
        role: 'user',
        id: generateId(),
        text: 'Setup the codebase and Start the application',
      }) as UIMessage,
    );
    messages.push(commandsMessage);
  }

  return messages;
};
