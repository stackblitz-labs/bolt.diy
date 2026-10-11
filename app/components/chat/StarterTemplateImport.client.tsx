import type { UIMessage } from 'ai';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { LoadingOverlay } from '~/components/ui/LoadingOverlay';
import { db } from '~/lib/persistence';
import { createChatFromMessages } from '~/lib/persistence/db';
import { createMessage } from '~/lib/persistence/messageMigration';
import { STARTER_TEMPLATES } from '~/utils/constants';
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
        const id = await createChatFromMessages(db, `${template.label} starter`, [
          createMessage({ role: 'user', text: `Start a blank ${template.label} app.` }) as UIMessage,
          createMessage({ role: 'assistant', text: result.assistantMessage }) as UIMessage,
        ]);

        if (!cancelled) {
          navigate(`/chat/${id}`, { replace: true });
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
