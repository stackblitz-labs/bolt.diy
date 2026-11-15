import type { UIMessage } from 'ai';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { LoadingOverlay } from '~/components/ui/LoadingOverlay';
import { db } from '~/lib/persistence';
import { createChatFromMessages, getMessagesByUrlIdRaw, setSnapshot } from '~/lib/persistence/db';
import { createMessage } from '~/lib/persistence/messageMigration';
import type { FileMap } from '~/lib/stores/files';
import { STARTER_TEMPLATES, WORK_DIR } from '~/utils/constants';
import { getTemplates } from '~/utils/selectStarterTemplate';

export function StarterTemplateImport() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const templateName = searchParams.get('template');
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    let cancelled = false;
    setError(undefined);

    void (async () => {
      try {
        const template = STARTER_TEMPLATES.find((item) => item.name === templateName);

        if (!template) {
          throw new Error('Choose a starter template from the homepage.');
        }

        if (!db) {
          throw new Error('Project storage is unavailable. Enable chat persistence and try again.');
        }

        const result = await getTemplates(template.name, `${template.label} starter`, controller.signal);

        if (cancelled) {
          return;
        }

        if (controller.signal.aborted) {
          throw new Error('Loading the starter template timed out. Please try again.');
        }

        if (!result) {
          throw new Error('The starter template could not be loaded.');
        }

        /*
         * Persist the files and setup actions before navigating; the chat replays
         * them to initialize the project without needing an AI response.
         */

        const userMessage = createMessage({ role: 'user', text: `Start a blank ${template.label} app.` });
        const assistantMessage = createMessage({ role: 'assistant', text: result.assistantMessage });

        const setupMessage = result.setupMessage
          ? createMessage({ role: 'assistant', text: result.setupMessage })
          : undefined;

        const starterMessages = [userMessage, assistantMessage, ...(setupMessage ? [setupMessage] : [])];

        const urlId = await createChatFromMessages(db, `${template.label} starter`, starterMessages as UIMessage[]);

        const chat = await getMessagesByUrlIdRaw(db, urlId);

        if (!chat) {
          throw new Error('The starter project was created but could not be loaded. Please try again.');
        }

        /*
         * Starter files are the initial state of this project. Persisting them
         * as a snapshot ensures they are restored after chat navigation resets
         * the WebContainer, even if the parser's initial file events race its
         * lifecycle.
         */
        const snapshotFiles: FileMap = {};

        for (const file of result.files) {
          const filePath = `${WORK_DIR}/${file.path}`;
          const pathParts = filePath.split('/');

          for (let index = 2; index < pathParts.length - 1; index++) {
            const folderPath = pathParts.slice(0, index + 1).join('/');
            snapshotFiles[folderPath] = { type: 'folder' };
          }

          snapshotFiles[filePath] = { type: 'file', content: file.content, isBinary: false };
        }

        await setSnapshot(db, chat.id, {
          chatIndex: assistantMessage.id!,
          files: snapshotFiles,
          preserveMessagesOnRestore: true,
        });

        if (!cancelled) {
          navigate(`/chat/${urlId}`, { replace: true });
        }
      } catch (cause) {
        if (!cancelled) {
          setError(
            controller.signal.aborted
              ? 'Loading the starter template timed out. Please try again.'
              : cause instanceof Error
                ? cause.message
                : 'The starter project could not be created.',
          );
        }
      } finally {
        clearTimeout(timeout);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [templateName, attempt, navigate]);

  if (!error) {
    return <LoadingOverlay message="Loading starter template..." />;
  }

  return (
    <div className="relative m-auto max-w-lg rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 p-6 text-bolt-elements-textPrimary">
      <h1 className="mb-2 text-lg font-semibold">Unable to start the app</h1>
      <p role="alert" className="mb-4 text-sm text-bolt-elements-textSecondary">
        {error}
      </p>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => setAttempt((value) => value + 1)}
          className="rounded-md bg-bolt-elements-button-primary-background px-4 py-2 text-bolt-elements-button-primary-text hover:bg-bolt-elements-button-primary-backgroundHover"
        >
          Try again
        </button>
        <a href="/" className="text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary">
          Back to homepage
        </a>
      </div>
    </div>
  );
}
