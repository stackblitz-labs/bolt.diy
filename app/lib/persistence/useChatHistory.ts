import { getSupabaseAuthClient } from '~/lib/api/supabase-auth-client';
import { authState } from '~/lib/stores/auth';
import { useWorkspace } from '~/lib/hooks/useWorkspace';
import { useAuth } from '~/lib/hooks/useAuth';
import { useLoaderData, useNavigate, useSearchParams } from '@remix-run/react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { atom } from 'nanostores';
import { generateId, type JSONValue, type Message } from 'ai';
import { toast } from 'react-toastify';
import { workbenchStore } from '~/lib/stores/workbench';
import { logStore } from '~/lib/stores/logs'; // Import logStore
import {
  getMessages,
  getNextId,
  getUrlId,
  openDatabase,
  setMessages,
  duplicateChat,
  createChatFromMessages,
  getSnapshot,
  setSnapshot,
  type IChatMetadata,
} from './db';
import type { FileMap } from '~/lib/stores/files';
import type { Snapshot } from './types';
import { webcontainer } from '~/lib/webcontainer';
import { detectProjectCommands, createCommandActionsString } from '~/utils/projectCommands';
import type { ContextAnnotation } from '~/types/context';

export interface ChatHistoryItem {
  id: string;
  urlId?: string;
  description?: string;
  messages: Message[];
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
  const { id: mixedId } = useLoaderData<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const { currentWorkspace } = useWorkspace();
  const { isAuthenticated } = useAuth();
  const [archivedMessages, setArchivedMessages] = useState<Message[]>([]);
  const [initialMessages, setInitialMessages] = useState<Message[]>([]);
  const [ready, setReady] = useState<boolean>(false);
  const [urlId, setUrlId] = useState<string | undefined>();

  const isLoadingRef = useRef(false);
  const lastLoadedChatIdRef = useRef<string | undefined>(undefined);

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
      if (isLoadingRef.current || lastLoadedChatIdRef.current === mixedId) {
        return;
      }

      const loadChat = async () => {
        isLoadingRef.current = true;
        lastLoadedChatIdRef.current = mixedId;

        try {
          // First, try to load from IndexedDB
          let storedMessages: ChatHistoryItem | undefined = await getMessages(db, mixedId);
          let snapshot = await getSnapshot(db, mixedId);
          const indexedDBTimestamp = storedMessages?.timestamp;

          // Always check Supabase when authenticated to get the latest version
          if (isAuthenticated && currentWorkspace) {
            try {
              const supabase = getSupabaseAuthClient();
              const auth = authState.get();

              if (auth.session?.access_token) {
                // Set the session on the Supabase client
                const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
                  access_token: auth.session.access_token,
                  refresh_token: auth.session.refresh_token,
                });

                if (!sessionError && sessionData.session) {
                  // Convert string ID to number for Supabase
                  const numericChatId = parseInt(mixedId, 10);

                  if (!isNaN(numericChatId)) {
                    console.log(
                      'Checking Supabase for latest chat version:',
                      numericChatId,
                      'workspace:',
                      currentWorkspace.id,
                    );

                    // Fetch chat from Supabase
                    const { data: supabaseChat, error: fetchError } = await supabase
                      .from('chats')
                      .select('*')
                      .eq('id', numericChatId)
                      .eq('workspace_id', currentWorkspace.id)
                      .maybeSingle();

                    if (!fetchError && supabaseChat) {
                      console.log('Chat found in Supabase:', supabaseChat.id, 'updated_at:', supabaseChat.updated_at);

                      // Compare timestamps to see if Supabase has a newer version
                      const supabaseUpdatedAt = new Date(supabaseChat.updated_at).getTime();
                      const indexedDBUpdatedAt = indexedDBTimestamp ? new Date(indexedDBTimestamp).getTime() : 0;

                      // Check if messages are different (even if timestamps are equal)
                      const supabaseMessages = (supabaseChat.messages as Message[]) || [];
                      const indexedDBMessages = storedMessages?.messages || [];
                      const messagesAreDifferent =
                        supabaseMessages.length !== indexedDBMessages.length ||
                        JSON.stringify(supabaseMessages.map((m) => m.id)) !==
                          JSON.stringify(indexedDBMessages.map((m) => m.id));

                      /*
                       * Use Supabase data if:
                       * 1. It's newer (>= to handle equal timestamps - prefer Supabase as source of truth)
                       * 2. IndexedDB doesn't have the chat
                       * 3. Messages are different (even if timestamps are equal)
                       */
                      if (supabaseUpdatedAt >= indexedDBUpdatedAt || !storedMessages || messagesAreDifferent) {
                        console.log('Using Supabase version (newer or IndexedDB missing)');

                        // Transform Supabase chat to ChatHistoryItem format
                        const chatHistoryItem: ChatHistoryItem = {
                          id: String(supabaseChat.id),
                          urlId: String(supabaseChat.id),
                          description: supabaseChat.title || supabaseChat.description || String(supabaseChat.id),
                          messages: (supabaseChat.messages as Message[]) || [],
                          timestamp: supabaseChat.updated_at || supabaseChat.created_at, // Use updated_at as timestamp
                          metadata: supabaseChat.metadata || {},
                        };

                        // Save to IndexedDB for future use (with updated timestamp)
                        await setMessages(
                          db,
                          chatHistoryItem.id,
                          chatHistoryItem.messages,
                          chatHistoryItem.urlId,
                          chatHistoryItem.description,
                          chatHistoryItem.timestamp, // Pass timestamp so IndexedDB has it
                          chatHistoryItem.metadata,
                        );

                        storedMessages = chatHistoryItem;
                        snapshot = undefined; // Snapshots are not stored in Supabase
                      } else {
                        console.log('Using IndexedDB version (newer or same)');

                        // IndexedDB version is newer or same, keep using it
                      }
                    } else if (fetchError) {
                      console.warn('Chat not found in Supabase:', fetchError);

                      // Continue with IndexedDB if available
                    } else {
                      console.warn('Chat not found in Supabase');

                      // Continue with IndexedDB if available
                    }
                  } else {
                    console.warn('Invalid chat ID format:', mixedId);
                  }
                } else {
                  console.warn('Failed to set Supabase session:', sessionError);
                }
              } else {
                console.warn('No session token available for Supabase');
              }
            } catch (error) {
              console.error('Failed to load chat from Supabase:', error);

              // Continue with IndexedDB if available
            }
          }

          // Process the loaded messages (existing logic)
          if (storedMessages && storedMessages.messages && storedMessages.messages.length > 0) {
            const validSnapshot = snapshot || { chatIndex: '', files: {} };
            const summary = validSnapshot.summary;

            const rewindId = searchParams.get('rewindTo');
            let startingIdx = -1;
            const endingIdx = rewindId
              ? storedMessages.messages.findIndex((m) => m.id === rewindId) + 1
              : storedMessages.messages.length;

            // Only look for snapshot if we actually have a snapshot with a valid chatIndex
            const hasValidSnapshot = snapshot && snapshot.chatIndex && snapshot.chatIndex !== '';
            const snapshotIndex = hasValidSnapshot
              ? storedMessages.messages.findIndex((m) => m.id === validSnapshot.chatIndex)
              : -1;
            fetch('http://127.0.0.1:7242/ingest/86eca0d5-12b4-4cad-9248-516c38548b58', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                location: 'useChatHistory.ts:210',
                message: 'Snapshot and rewind logic',
                data: {
                  hasValidSnapshot,
                  snapshotIndex,
                  rewindId,
                  endingIdx,
                  totalMessages: storedMessages.messages.length,
                },
                timestamp: Date.now(),
                sessionId: 'debug-session',
                runId: 'run1',
                hypothesisId: 'A',
              }),
            }).catch(() => {});
            // #endregion

            if (snapshotIndex >= 0 && snapshotIndex < endingIdx) {
              startingIdx = snapshotIndex;
            }

            if (snapshotIndex > 0 && storedMessages.messages[snapshotIndex].id == rewindId) {
              startingIdx = -1;
            }

            let filteredMessages = storedMessages.messages.slice(startingIdx + 1, endingIdx);
            let archivedMessages: Message[] = [];

            if (startingIdx >= 0) {
              archivedMessages = storedMessages.messages.slice(0, startingIdx + 1);
            }

            fetch('http://127.0.0.1:7242/ingest/86eca0d5-12b4-4cad-9248-516c38548b58', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                location: 'useChatHistory.ts:223',
                message: 'After filtering messages',
                data: {
                  startingIdx,
                  endingIdx,
                  filteredCount: filteredMessages.length,
                  archivedCount: archivedMessages.length,
                  totalCount: storedMessages.messages.length,
                  willShowSnapshot: hasValidSnapshot && startingIdx > 0 && snapshotIndex >= 0,
                },
                timestamp: Date.now(),
                sessionId: 'debug-session',
                runId: 'run1',
                hypothesisId: 'A',
              }),
            }).catch(() => {});
            // #endregion

            setArchivedMessages(archivedMessages);

            // Only show snapshot restoration if we have a valid snapshot AND startingIdx > 0
            if (hasValidSnapshot && startingIdx > 0 && snapshotIndex >= 0) {
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
                .filter((x): x is { content: string; path: string } => !!x);
              const projectCommands = await detectProjectCommands(files);

              const commandActionsString = createCommandActionsString(projectCommands);

              filteredMessages = [
                {
                  id: generateId(),
                  role: 'user',
                  content: `Restore project from snapshot`,
                  annotations: ['no-store', 'hidden'],
                },
                {
                  id: storedMessages.messages[snapshotIndex].id,
                  role: 'assistant',
                  content: `Bolt Restored your chat from a snapshot. You can revert this message to load the full chat history.
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
                    `,
                  annotations: [
                    'no-store',
                    ...(summary
                      ? [
                          {
                            chatId: storedMessages.messages[snapshotIndex].id,
                            type: 'chatSummary',
                            summary,
                          } satisfies ContextAnnotation,
                        ]
                      : []),
                  ],
                },
                ...filteredMessages,
              ];
              restoreSnapshot(mixedId);
            }

            fetch('http://127.0.0.1:7242/ingest/86eca0d5-12b4-4cad-9248-516c38548b58', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                location: 'useChatHistory.ts:296',
                message: 'Setting initial messages',
                data: {
                  filteredMessagesCount: filteredMessages.length,
                  messageRoles: filteredMessages.map((m) => m.role),
                  urlId: storedMessages.urlId,
                  chatId: storedMessages.id,
                },
                timestamp: Date.now(),
                sessionId: 'debug-session',
                runId: 'run1',
                hypothesisId: 'A',
              }),
            }).catch(() => {});
            // #endregion

            // Set the messages and state
            setInitialMessages(filteredMessages);
            setUrlId(storedMessages.urlId);
            description.set(storedMessages.description);
            chatId.set(storedMessages.id);
            chatMetadata.set(storedMessages.metadata);
          } else {
            console.warn('Chat not found in IndexedDB or Supabase, redirecting to home');
            navigate('/', { replace: true });
          }

          setReady(true);
        } catch (error) {
          console.error('Error loading chat:', error);
          logStore.logError('Failed to load chat messages or snapshot', error);
          toast.error('Failed to load chat: ' + (error instanceof Error ? error.message : 'Unknown error'));
          setReady(true);
        } finally {
          isLoadingRef.current = false;
        }
      };

      loadChat();
    } else {
      // Handle case where there is no mixedId (e.g., new chat)
      setReady(true);
      lastLoadedChatIdRef.current = undefined;
    }
  }, [mixedId, db, navigate, searchParams, isAuthenticated, currentWorkspace?.id]);

  useEffect(() => {
    if (mixedId !== lastLoadedChatIdRef.current) {
      isLoadingRef.current = false;
    }
  }, [mixedId]);

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
  const saveChatToSupabase = useCallback(
    async (
      chatId: string,
      messages: Message[],
      description: string | undefined,
      metadata: IChatMetadata | undefined,
    ) => {
      // Only save to Supabase if authenticated and workspace exists
      if (!isAuthenticated || !currentWorkspace) {
        return;
      }

      try {
        const supabase = getSupabaseAuthClient();

        const { data: user } = await supabase.auth.getUser();

        console.log('user', user);

        if (!user.user) {
          console.warn('Not authenticated, skipping Supabase save');
          return;
        }

        // Convert string ID to number for Supabase
        const numericChatId = parseInt(chatId, 10);

        if (isNaN(numericChatId)) {
          console.error('Invalid chat ID format, cannot convert to number:', chatId);
          return;
        }

        // Check if chat already exists in Supabase
        const { data: existingChat } = await supabase
          .from('chats')
          .select('id, messages')
          .eq('id', numericChatId)
          .maybeSingle();

        const chatData = {
          workspace_id: currentWorkspace.id,
          title: description || chatId,
          description: description || chatId,
          messages: messages || [],
          metadata: metadata || {},
          updated_at: new Date().toISOString(),
        };

        if (existingChat) {
          // Check if messages actually changed to avoid unnecessary updates
          const currentMessages = (existingChat.messages as Message[]) || [];

          // Compare both message IDs and content (content can change during streaming)
          const messageIdsChanged =
            currentMessages.length !== messages.length ||
            JSON.stringify(currentMessages.map((m) => m.id)) !== JSON.stringify(messages.map((m) => m.id));

          // Also check if content of existing messages changed (for streaming updates)
          const messageContentChanged = currentMessages.some((currentMsg, idx) => {
            const newMsg = messages[idx];
            return newMsg && (currentMsg.content !== newMsg.content || currentMsg.role !== newMsg.role);
          });

          const messagesChanged = messageIdsChanged || messageContentChanged;

          if (!messagesChanged) {
            console.log('Messages unchanged, skipping Supabase update');
            return;
          }

          // Update existing chat
          const { error: updateError } = await supabase.from('chats').update(chatData).eq('id', numericChatId);

          if (updateError) {
            console.error('Failed to update chat in Supabase:', updateError);

            // Don't throw - continue with IndexedDB only
          } else {
            console.log('Chat updated in Supabase:', chatId);
          }
        } else {
          // Create new chat
          const { error: insertError } = await supabase.from('chats').insert({
            id: numericChatId,
            ...chatData,
            created_by: user.user.id,
            created_at: new Date().toISOString(),
          });

          if (insertError) {
            console.error('Failed to create chat in Supabase:', insertError);

            // Don't throw - continue with IndexedDB only
          } else {
            console.log('Chat created in Supabase:', chatId);
          }
        }
      } catch (error) {
        console.error('Error saving chat to Supabase:', error);

        // Don't throw - continue with IndexedDB only
      }
    },
    [isAuthenticated, currentWorkspace],
  );

  return {
    ready: !mixedId || ready,
    initialMessages,
    updateChatMestaData: async (metadata: IChatMetadata) => {
      const id = chatId.get();

      if (!db || !id) {
        return;
      }

      try {
        await setMessages(db, id, initialMessages, urlId, description.get(), undefined, metadata);
        chatMetadata.set(metadata);

        await saveChatToSupabase(id, initialMessages, description.get(), metadata);
      } catch (error) {
        toast.error('Failed to update chat metadata');
        console.error(error);
      }
    },
    storeMessageHistory: async (messages: Message[]) => {
      if (!db || messages.length === 0) {
        return;
      }

      const { firstArtifact } = workbenchStore;
      messages = messages.filter((m) => !m.annotations?.includes('no-store'));

      let _urlId = urlId;

      if (!urlId && firstArtifact?.id) {
        const urlId = await getUrlId(db, firstArtifact.id);
        _urlId = urlId;
        navigateChat(urlId);
        setUrlId(urlId);
      }

      let chatSummary: string | undefined = undefined;
      const lastMessage = messages[messages.length - 1];

      if (lastMessage.role === 'assistant') {
        const annotations = lastMessage.annotations as JSONValue[];
        const filteredAnnotations = (annotations?.filter(
          (annotation: JSONValue) =>
            annotation && typeof annotation === 'object' && Object.keys(annotation).includes('type'),
        ) || []) as { type: string; value: any } & { [key: string]: any }[];

        if (filteredAnnotations.find((annotation) => annotation.type === 'chatSummary')) {
          chatSummary = filteredAnnotations.find((annotation) => annotation.type === 'chatSummary')?.summary;
        }
      }

      takeSnapshot(messages[messages.length - 1].id, workbenchStore.files.get(), _urlId, chatSummary);

      if (!description.get() && firstArtifact?.title) {
        description.set(firstArtifact?.title);
      }

      // Ensure chatId.get() is used here as well
      if (initialMessages.length === 0 && !chatId.get()) {
        const nextId = await getNextId(db);

        chatId.set(nextId);

        if (!urlId) {
          navigateChat(nextId);
        }
      }

      // Ensure chatId.get() is used for the final setMessages call
      const finalChatId = chatId.get();

      if (!finalChatId) {
        console.error('Cannot save messages, chat ID is not set.');
        toast.error('Failed to save chat messages: Chat ID missing.');

        return;
      }

      const allMessagesToSave = [...archivedMessages, ...messages];

      await setMessages(
        db,
        finalChatId, // Use the potentially updated chatId
        allMessagesToSave,
        urlId,
        description.get(),
        undefined,
        chatMetadata.get(),
      );

      await saveChatToSupabase(finalChatId, allMessagesToSave, description.get(), chatMetadata.get());
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
    importChat: async (description: string, messages: Message[], metadata?: IChatMetadata) => {
      if (!db) {
        return;
      }

      try {
        const newId = await createChatFromMessages(db, description, messages, metadata);
        window.location.href = `/chat/${newId}`;
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

      const chat = await getMessages(db, id);
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
