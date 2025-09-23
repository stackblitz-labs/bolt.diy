import { renderLogger } from '~/utils/logger';
import ChatImplementer from './components/ChatImplementer/ChatImplementer';
import { useLoaderData } from '@remix-run/react';
import { useEffect, useState } from 'react';
import { logStore } from '~/lib/stores/logs';
import { toast } from 'react-toastify';
import { getExistingAppResponses } from '~/lib/replay/SendChatMessage';
import { chatStore, doListenAppResponses, onChatResponse } from '~/lib/stores/chat';
import { database } from '~/lib/persistence/apps';
import { NutAPIError } from '~/lib/replay/NutAPI';
import { Unauthorized } from '~/components/chat/Unauthorized';
import { navigateApp } from '~/utils/nut';
import { useStore } from '@nanostores/react';
import { statusModalStore } from '~/lib/stores/statusModal';
import { clearAppResponses } from '~/lib/replay/ResponseFilter';
import { AppLoadingScreen } from '~/components/ui/AppLoadingScreen';

async function isAppAccessible(appId: string) {
  try {
    await database.getAppTitle(appId);
    return true;
  } catch (error) {
    if (error instanceof NutAPIError && error.status == 401) {
      return false;
    }
    throw error;
  }
}

async function updateAppState(appId: string) {
  const title = await database.getAppTitle(appId);
  const responses = await getExistingAppResponses(appId);
  for (const response of responses) {
    onChatResponse(response, 'InitialLoad');
  }
  chatStore.currentAppId.set(appId);
  chatStore.appTitle.set(title);
  chatStore.started.set(chatStore.messages.get().length > 0);
}

export function Chat() {
  renderLogger.trace('Chat');

  const { id: initialAppId } = useLoaderData<{ id?: string }>() ?? {};

  const [ready, setReady] = useState<boolean>(!initialAppId);
  const [unauthorized, setUnauthorized] = useState<boolean>(false);
  const [isCopying, setIsCopying] = useState(false);
  const appTitle = useStore(chatStore.appTitle);
  const isOpen = useStore(statusModalStore.isOpen);

  useEffect(() => {
    if (appTitle) {
      document.title = `Nut: ${appTitle}`;
    } else {
      document.title = 'Nut';
    }
  }, [appTitle]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    let documentVisible = document.visibilityState === 'visible';

    const handleVisibilityChange = async () => {
      const visible = document.visibilityState === 'visible';
      if (visible !== documentVisible) {
        documentVisible = visible;
        if (visible) {
          const appId = chatStore.currentAppId.get();
          if (appId && !chatStore.listenResponses.get()) {
            const wasStatusModalOpen = isOpen;
            console.log('DocumentReloadApp', wasStatusModalOpen);
            statusModalStore.close();
            await updateAppState(appId);
            doListenAppResponses(wasStatusModalOpen);
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const loadApp = async (appId: string) => {
    try {
      if (!(await isAppAccessible(appId))) {
        setUnauthorized(true);
        return;
      }

      clearAppResponses();
      await updateAppState(appId);

      // Always check for ongoing work when we first start the chat.
      doListenAppResponses();

      setReady(true);
    } catch (error) {
      logStore.logError('Failed to load chat messages', error);
      toast.error((error as any).message);
    }
  };

  const handleCopyApp = async () => {
    if (!initialAppId || isCopying) {
      return;
    }

    setIsCopying(true);
    try {
      const newAppId = await database.copyApp(initialAppId);
      toast.success('App copied successfully!');
      navigateApp(newAppId);
      await loadApp(newAppId);
      setUnauthorized(false);
    } catch (error) {
      console.error('Failed to copy app:', error);
      toast.error('Failed to copy app. Please try again.');
    } finally {
      setIsCopying(false);
    }
  };

  useEffect(() => {
    if (initialAppId) {
      loadApp(initialAppId);
    }
  }, []);

  console.log('ChatClient', ready, chatStore.started.get(), chatStore.appSummary.get(), chatStore.messages.get());

  return (
    <>
      {!ready && initialAppId && !unauthorized && <AppLoadingScreen appId={initialAppId} />}
      {ready && <ChatImplementer />}
      {unauthorized && <Unauthorized handleCopyApp={handleCopyApp} isCopying={isCopying} />}
    </>
  );
}
