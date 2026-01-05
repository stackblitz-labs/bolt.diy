import { getSupabaseAuthClient } from '~/lib/api/supabase-auth-client';
import { authState } from '~/lib/stores/auth';
import { useWorkspace } from '~/lib/hooks/useWorkspace';
import { useAuth } from '~/lib/hooks/useAuth';
import { useLoaderData, useNavigate, useSearchParams } from '@remix-run/react';
import { useState, useEffect, useCallback } from 'react';
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
      const loadChat = async () => {
        try {
          // First, try to load from IndexedDB
          let storedMessages: ChatHistoryItem | undefined = await getMessages(db, mixedId);
          let snapshot = await getSnapshot(db, mixedId);

          // Check if chat was found in IndexedDB
          const foundInIndexedDB = storedMessages && storedMessages.messages && storedMessages.messages.length > 0;

          // If not found in IndexedDB and authenticated, try Supabase
          if (!foundInIndexedDB && isAuthenticated && currentWorkspace) {
            try {
              const supabase = getSupabaseAuthClient();

              // Get the session from authState
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
                    console.log('Loading chat from Supabase:', numericChatId, 'workspace:', currentWorkspace.id);

                    // Fetch chat from Supabase
                    const { data: supabaseChat, error: fetchError } = await supabase
                      .from('chats')
                      .select('*')
                      .eq('id', numericChatId)
                      .eq('workspace_id', currentWorkspace.id)
                      .maybeSingle();

                    if (!fetchError && supabaseChat) {
                      console.log('Chat found in Supabase:', supabaseChat.id);

                      // Transform Supabase chat to ChatHistoryItem format
                      const chatHistoryItem: ChatHistoryItem = {
                        id: String(supabaseChat.id),
                        urlId: String(supabaseChat.id),
                        description: supabaseChat.title || supabaseChat.description || String(supabaseChat.id),
                        messages: (supabaseChat.messages as Message[]) || [],
                        timestamp: supabaseChat.created_at,
                        metadata: supabaseChat.metadata || {},
                      };

                      // Save to IndexedDB for future use
                      await setMessages(
                        db,
                        chatHistoryItem.id,
                        chatHistoryItem.messages,
                        chatHistoryItem.urlId,
                        chatHistoryItem.description,
                        undefined,
                        chatHistoryItem.metadata,
                      );

                      storedMessages = chatHistoryItem;

                      // Note: Snapshots are not stored in Supabase, so we'll use null
                      snapshot = undefined;
                    } else {
                      console.warn('Chat not found in Supabase:', fetchError || 'No data returned');
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

              // Continue with IndexedDB result (which might be null)
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
            const snapshotIndex = storedMessages.messages.findIndex((m) => m.id === validSnapshot.chatIndex);

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
        }
      };

      loadChat();
    } else {
      // Handle case where there is no mixedId (e.g., new chat)
      setReady(true);
    }
  }, [mixedId, db, navigate, searchParams, isAuthenticated, currentWorkspace]);

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

        // Check if chat already exists in Supabase
        const { data: existingChat } = await supabase
          .from('chats')
          .select('id, messages')
          .eq('id', chatId)
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
          const messagesChanged =
            currentMessages.length !== messages.length ||
            JSON.stringify(currentMessages.map((m) => m.id)) !== JSON.stringify(messages.map((m) => m.id));

          if (!messagesChanged) {
            console.log('Messages unchanged, skipping Supabase update');
            return;
          }

          // Update existing chat
          const { error: updateError } = await supabase.from('chats').update(chatData).eq('id', chatId);

          if (updateError) {
            console.error('Failed to update chat in Supabase:', updateError);

            // Don't throw - continue with IndexedDB only
          } else {
            console.log('Chat updated in Supabase:', chatId);
          }
        } else {
          // Create new chat
          const { error: insertError } = await supabase.from('chats').insert({
            id: chatId,
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

      await setMessages(
        db,
        finalChatId, // Use the potentially updated chatId
        [...archivedMessages, ...messages],
        urlId,
        description.get(),
        undefined,
        chatMetadata.get(),
      );

      await saveChatToSupabase(finalChatId, [...archivedMessages, ...messages], description.get(), chatMetadata.get());
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
