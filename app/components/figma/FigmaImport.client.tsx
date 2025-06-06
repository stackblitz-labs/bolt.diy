import { useSearchParams } from '@remix-run/react';
import { useEffect, useState } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { BaseChat } from '~/components/chat/BaseChat';
import { Chat } from '~/components/chat/Chat.client';
import { useChatHistory } from '~/lib/persistence';
import { createChatFromFigma } from '~/utils/figmaImport';
import { LoadingOverlay } from '~/components/ui/LoadingOverlay';
import { toast } from 'react-toastify';

export function FigmaImport() {
  const [searchParams] = useSearchParams();
  const { ready, importChat } = useChatHistory();
  const [imported, setImported] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready || imported) {
      return;
    }

    const url = searchParams.get('url');
    const token = searchParams.get('token');

    if (!url || !token) {
      window.location.href = '/';
      return;
    }

    createChatFromFigma(url, token)
      .then(async (messages) => {
        if (importChat) {
          const name = url.split('/').slice(-1)[0];
          await importChat(`Figma:${name}`, messages);
        }
      })
      .catch((error) => {
        console.error('Error importing Figma design:', error);
        toast.error('Failed to import Figma design');
        window.location.href = '/';
      })
      .finally(() => {
        setLoading(false);
        setImported(true);
      });
  }, [ready, imported, searchParams, importChat]);

  return (
    <ClientOnly fallback={<BaseChat />}>
      {() => (
        <>
          <Chat />
          {loading && <LoadingOverlay message="Importing Figma design..." />}
        </>
      )}
    </ClientOnly>
  );
}
