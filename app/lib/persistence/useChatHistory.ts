import { generateId, type UIMessage } from 'ai';
import { atom } from 'nanostores';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useLoaderData, useNavigate, useParams, useSearchParams } from 'react-router';
import { toast } from 'react-toastify';
import { getCachedMessages, getCachedSnapshot, invalidateChatCache } from './chatCache';
import {
  getMessagesByIdRaw,
  getMessagesByUrlIdRaw,
  openDatabase,
  setMessages,
  duplicateChat,
  createChatFromMessages,
  createChatWithNextId,
  setSnapshot,
  type IChatMetadata,
} from './db';
import { createMessage, getMessageAnnotations, hasMessageFlag, type AnyPart } from './messageMigration';
import type { Snapshot } from './types';
import type { FileMap } from '~/lib/stores/files';
import { logStore } from '~/lib/stores/logs'; // Import logStore
import { workbenchStore } from '~/lib/stores/workbench';
import { webcontainer } from '~/lib/webcontainer';
import type { ContextAnnotation } from '~/types/context';
import { detectProjectCommands, createCommandActionsString } from '~/utils/projectCommands';

export interface ChatHistoryItem {
  id: string;
  urlId?: string;
  description?: string;
  messages: UIMessage[];
  timestamp: string;
  metadata?: IChatMetadata;
}

const persistenceEnabled = !import.meta.env.VITE_DISABLE_PERSISTENCE;

export const db = persistenceEnabled ? await openDatabase() : undefined;

export const chatId = atom<string | undefined>(undefined);
export const description = atom<string | undefined>(undefined);
export const chatMetadata = atom<IChatMetadata | undefined>(undefined);
export function useChatHistory() {
  const navigate = useNavigate();
  const { id: paramId } = useParams<{ id?: string }>();
  const loaderData = useLoaderData<{ id?: string }>() as { id?: string } | undefined;
  const mixedId = paramId ?? loaderData?.id;
  const [searchParams] = useSearchParams();

  const [archivedMessages, setArchivedMessages] = useState<UIMessage[]>([]);
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [ready, setReady] = useState<boolean>(false);
  const [urlId, setUrlId] = useState<string | undefined>();

  /*
   * Whether `initialMessages` belong to a different chat than the one that was
   * on screen. Consumers that keep their own per-chat state, such as the message
   * parser, need it to tell a switch apart from a re-read of the same chat.
   */
  const [chatChanged, setChatChanged] = useState(false);

  /*
   * The chat the messages, artifacts and files on screen belong to. Keyed on the
   * persisted record rather than on the route, because storeMessageHistory moves
   * a chat that is already on screen to /chat/<id> with history.replaceState,
   * which the router does pick up. That re-run is not a switch.
   */
  const loadedChatIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!db) {
      setReady(true);

      if (persistenceEnabled) {
        const error = new Error('Chat persistence is unavailable');
        logStore.logError('Chat persistence initialization failed', error);
        toast.error('Chat persistence is unavailable');
      }

      return;
    }

    if (mixedId) {
      Promise.all([getCachedMessages(db, mixedId), getCachedSnapshot(db, mixedId)])
        .then(async ([storedMessages, snapshot]) => {
          if (storedMessages && storedMessages.messages.length > 0) {
            /*
             * Keyed on the persisted record, not on the route. The effect also
             * re-runs for a rewind or a `?prompt=` navigation within the same
             * chat, and those must not empty the project.
             */
            const switchedChat = loadedChatIdRef.current !== storedMessages.id;
            loadedChatIdRef.current = storedMessages.id;

            /*
             * Emptied before anything of the incoming chat is written, so the
             * messages, the artifacts and the container never describe different
             * chats.
             */
            if (switchedChat) {
              await workbenchStore.resetWorkbench();
            }

            /*
             * const snapshotStr = localStorage.getItem(`snapshot:${mixedId}`); // Remove localStorage usage
             * const snapshot: Snapshot = snapshotStr ? JSON.parse(snapshotStr) : { chatIndex: 0, files: {} }; // Use snapshot from DB
             */
            const validSnapshot: Snapshot = snapshot || { chatIndex: '', files: {} }; // Ensure snapshot is not undefined
            const summary = validSnapshot.summary;

            const rewindId = searchParams.get('rewindTo');

            let startingIdx = -1;

            const endingIdx = rewindId
              ? storedMessages.messages.findIndex((m) => m.id === rewindId) + 1
              : storedMessages.messages.length;

            const snapshotIndex = storedMessages.messages.findIndex((m) => m.id === validSnapshot.chatIndex);

            if (snapshotIndex >= 0 && snapshotIndex < endingIdx) {
              startingIdx = snapshotIndex;
            }

            if (snapshotIndex > 0 && storedMessages.messages[snapshotIndex].id == rewindId) {
              startingIdx = -1;
            }

            let filteredMessages = storedMessages.messages.slice(startingIdx + 1, endingIdx);
            let archivedMessages: UIMessage[] = [];

            if (startingIdx >= 0) {
              archivedMessages = storedMessages.messages.slice(0, startingIdx + 1);
            }

            setArchivedMessages(archivedMessages);

            if (startingIdx > 0) {
              const files = Object.entries(validSnapshot?.files || {})
                .map(([key, value]) => {
                  if (value?.type !== 'file') {
                    return null;
                  }

                  return {
                    content: value.content,
                    path: key,
                  };
                })
                .filter((x): x is { content: string; path: string } => !!x); // Type assertion

              const projectCommands = await detectProjectCommands(files);

              // Call the modified function to get only the command actions string
              const commandActionsString = createCommandActionsString(projectCommands);

              const restoredAssistantText = `Bolt Restored your chat from a snapshot. You can revert this message to load the full chat history.
                  <boltArtifact id="restored-project-setup" title="Restored Project & Setup" type="bundled">
                  ${Object.entries(snapshot?.files || {})
                    .map(([key, value]) => {
                      if (value?.type === 'file') {
                        return `
                      <boltAction type="file" filePath="${key}">
${value.content}
                      </boltAction>
                      `;
                      } else {
                        return ``;
                      }
                    })
                    .join('\n')}
                  ${commandActionsString}
                  </boltArtifact>
                  `;

              const restoredSummary = summary
                ? [
                    {
                      chatId: storedMessages.messages[snapshotIndex].id,
                      type: 'chatSummary',
                      summary,
                    } satisfies ContextAnnotation,
                  ]
                : [];

              /*
               * Both shapes written. `annotations` still carries the v4 sentinels
               * and the summary because the v4 readers have not moved yet;
               * metadata.flags and the data-chatSummary part are what v5 reads.
               */
              const restoredParts: AnyPart[] = [
                { type: 'text', text: restoredAssistantText },
                ...(summary
                  ? [
                      {
                        type: 'data-chatSummary',
                        data: {
                          chatId: storedMessages.messages[snapshotIndex].id,
                          summary,
                        },
                      },
                    ]
                  : []),
              ];

              filteredMessages = [
                createMessage({
                  id: generateId(),
                  role: 'user',
                  text: `Restore project from snapshot`,
                  flags: ['no-store', 'hidden'],
                }) as UIMessage,
                {
                  ...(createMessage({
                    id: storedMessages.messages[snapshotIndex].id,
                    role: 'assistant',
                    text: restoredAssistantText,
                    flags: ['no-store'],
                  }) as UIMessage),

                  /*
                   * v5 removed UIMessage.annotations, so the summary now travels
                   * as a data-chatSummary part (above) and the 'no-store' flag
                   * as metadata.flags (set by createMessage). The legacy
                   * `annotations` mirror is preserved so a downgrade still
                   * works, which is why this object literal is cast.
                   */
                  parts: restoredParts as unknown as UIMessage['parts'],
                  annotations: ['no-store', ...restoredSummary],
                } as unknown as UIMessage,

                ...filteredMessages,
              ];
              restoreSnapshot(mixedId, validSnapshot);
            }

            setChatChanged(switchedChat);
            setInitialMessages(filteredMessages);

            setUrlId(storedMessages.urlId);
            description.set(storedMessages.description);
            chatId.set(storedMessages.id);
            chatMetadata.set(storedMessages.metadata);
          } else {
            navigate('/', { replace: true });
          }

          setReady(true);
        })
        .catch((error) => {
          console.error(error);

          logStore.logError('Failed to load chat messages or snapshot', error); // Updated error message
          toast.error('Failed to load chat: ' + error.message); // More specific error
        });
    } else {
      // Clean reset when switching to a fresh chat (e.g., /)
      const leftChat = loadedChatIdRef.current !== undefined;

      if (leftChat) {
        loadedChatIdRef.current = undefined;

        void workbenchStore.resetWorkbench().catch((error) => {
          logStore.logError('Failed to empty the workbench', error);
        });
      }

      setChatChanged(leftChat);
      setArchivedMessages([]);
      setInitialMessages([]);
      setUrlId(undefined);
      description.set(undefined);
      chatId.set(undefined);
      chatMetadata.set(undefined);
      setReady(true);
    }
  }, [mixedId, db, navigate, searchParams]); // Added db, navigate, searchParams dependencies

  const takeSnapshot = useCallback(
    async (chatIdx: string, files: FileMap, _chatId?: string | undefined, chatSummary?: string) => {
      const id = chatId.get();

      if (!id || !db) {
        return;
      }

      const snapshot: Snapshot = {
        chatIndex: chatIdx,
        files,
        summary: chatSummary,
      };

      // localStorage.setItem(`snapshot:${id}`, JSON.stringify(snapshot)); // Remove localStorage usage
      try {
        await setSnapshot(db, id, snapshot);
      } catch (error) {
        console.error('Failed to save snapshot:', error);
        toast.error('Failed to save chat snapshot.');
      }
    },
    [db],
  );

  const restoreSnapshot = useCallback(async (id: string, snapshot?: Snapshot) => {
    // const snapshotStr = localStorage.getItem(`snapshot:${id}`); // Remove localStorage usage
    const container = await webcontainer;

    const validSnapshot = snapshot || { chatIndex: '', files: {} };

    if (!validSnapshot?.files) {
      return;
    }

    Object.entries(validSnapshot.files).forEach(async ([key, value]) => {
      if (key.startsWith(container.workdir)) {
        key = key.replace(container.workdir, '');
      }

      if (value?.type === 'folder') {
        await container.fs.mkdir(key, { recursive: true });
      }
    });
    Object.entries(validSnapshot.files).forEach(async ([key, value]) => {
      if (value?.type === 'file') {
        if (key.startsWith(container.workdir)) {
          key = key.replace(container.workdir, '');
        }

        await container.fs.writeFile(key, value.content, { encoding: value.isBinary ? undefined : 'utf8' });
      } else {
      }
    });

    // workbenchStore.files.setKey(snapshot?.files)
  }, []);

  return {
    ready: !mixedId || ready,
    initialMessages,
    chatChanged,
    updateChatMestaData: async (metadata: IChatMetadata) => {
      const id = chatId.get();

      if (!db || !id) {
        return;
      }

      try {
        await setMessages(db, id, initialMessages, urlId, description.get(), undefined, metadata);
        chatMetadata.set(metadata);
      } catch (error) {
        toast.error('Failed to update chat metadata');
        console.error(error);
      }
    },
    storeMessageHistory: async (messages: UIMessage[]) => {
      if (!db || messages.length === 0) {
        return;
      }

      const { firstArtifact } = workbenchStore;
      messages = messages.filter((m) => !hasMessageFlag(m, 'no-store'));

      let _urlId = urlId;

      if (!urlId && firstArtifact?.id) {
        _urlId = firstArtifact.id;
      }

      let chatSummary: string | undefined = undefined;

      const lastMessage = messages[messages.length - 1];

      if (lastMessage.role === 'assistant') {
        const chatSummaryAnnotation = getMessageAnnotations(lastMessage).find(
          (annotation) => annotation.type === 'chatSummary',
        );

        if (chatSummaryAnnotation) {
          chatSummary = chatSummaryAnnotation.summary as string;
        }
      }

      takeSnapshot(messages[messages.length - 1].id, workbenchStore.files.get(), _urlId, chatSummary);

      if (!description.get() && firstArtifact?.title) {
        description.set(firstArtifact?.title);
      }

      // Ensure chatId.get() is used here as well
      const creatingNewChat = initialMessages.length === 0 && !chatId.get();

      let createdChat: { id: string; urlId?: string } | undefined;

      if (creatingNewChat) {
        createdChat = await createChatWithNextId(
          db,
          [...archivedMessages, ...messages],
          _urlId,
          description.get(),
          chatMetadata.get(),
          Boolean(_urlId),
        );

        const nextId = createdChat.id;
        _urlId = createdChat.urlId;

        chatId.set(nextId);

        /*
         * Claimed before navigating: the messages on screen already belong to
         * this chat, so the re-run that the new route triggers must not be read
         * as a switch away from it.
         */
        loadedChatIdRef.current = nextId;

        navigateChat(_urlId || nextId);
        setUrlId(_urlId);
      }

      // Ensure chatId.get() is used for the final setMessages call
      const finalChatId = chatId.get();

      if (!finalChatId) {
        console.error('Cannot save messages, chat ID is not set.');
        toast.error('Failed to save chat messages: Chat ID missing.');

        return;
      }

      if (!createdChat) {
        await setMessages(
          db,
          finalChatId,
          [...archivedMessages, ...messages],
          _urlId,
          description.get(),
          undefined,
          chatMetadata.get(),
        );
      }

      invalidateChatCache(finalChatId);

      if (urlId) {
        invalidateChatCache(urlId);
      }
    },
    duplicateCurrentChat: async (listItemId: string) => {
      if (!db || (!mixedId && !listItemId)) {
        return;
      }

      try {
        const newId = await duplicateChat(db, mixedId || listItemId);
        navigate(`/chat/${newId}`);
        toast.success('Chat duplicated successfully');
      } catch (error) {
        toast.error('Failed to duplicate chat');
        console.log(error);
      }
    },
    importChat: async (description: string, messages: UIMessage[], metadata?: IChatMetadata) => {
      if (!db) {
        return;
      }

      try {
        const newId = await createChatFromMessages(db, description, messages, metadata);
        navigate(`/chat/${newId}`);
        toast.success('Chat imported successfully');
      } catch (error) {
        if (error instanceof Error) {
          toast.error('Failed to import chat: ' + error.message);
        } else {
          toast.error('Failed to import chat');
        }
      }
    },
    exportChat: async (id = urlId) => {
      if (!db || !id) {
        return;
      }

      /*
       * Raw read on purpose: this is a backup, so it must reproduce the stored
       * record exactly rather than a migrated view of it.
       */
      const chat = (await getMessagesByIdRaw(db, id)) || (await getMessagesByUrlIdRaw(db, id));

      const chatData = {
        messages: chat.messages,
        description: chat.description,
        exportDate: new Date().toISOString(),
      };

      const blob = new Blob([JSON.stringify(chatData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat-${new Date().toISOString()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
  };
}

function navigateChat(nextId: string) {
  /**
   * FIXME: Using the intended navigate function causes a rerender for <Chat /> that breaks the app.
   *
   * `navigate(`/chat/${nextId}`, { replace: true });`
   */
  const url = new URL(window.location.href);
  url.pathname = `/chat/${nextId}`;

  window.history.replaceState({}, '', url);
}
