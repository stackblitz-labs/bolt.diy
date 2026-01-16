import { useLoaderData, useNavigate, useSearchParams } from '@remix-run/react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { atom } from 'nanostores';
import { generateId, type JSONValue, type Message } from 'ai';
import { extractMessageAnnotations } from './annotationHelpers';
import { toast } from 'react-toastify';
import { workbenchStore } from '~/lib/stores/workbench';
import { logStore } from '~/lib/stores/logs'; // Import logStore
import { createScopedLogger } from '~/utils/logger';
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
  getServerMessages,
  getServerMessagesPage,
  appendServerMessages,
  clearServerMessages,
  getServerSnapshot,
  setServerSnapshot,
  isUserAuthenticated,
  deleteById,
  type IChatMetadata,
} from './db';
import type { FileMap } from '~/lib/stores/files';
import type { Snapshot } from './types';
import { webcontainer } from '~/lib/webcontainer';
import { detectProjectCommands, createCommandActionsString } from '~/utils/projectCommands';
import type { ContextAnnotation } from '~/types/context';
import { sortMessagesByTimestamp } from './messageSort';
import type { MessageLoadProgress, MessageLoadingState } from '~/types/message-loading';
import { initialLoadingState } from '~/types/message-loading';
import { MESSAGE_PAGE_SIZE, MAX_MESSAGE_PAGES } from './chatSyncConstants';
import {
  markMessageAsPending,
  markMessageAsSynced,
  setSyncError,
  clearSyncError,
  initializePendingMessagesFromStore,
  computeSyncStatus,
  getPendingMessageIds,
} from './messageSyncState';
import { isMessageEmpty } from './messageValidation';

const logger = createScopedLogger('ChatHistory');

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
export function useChatHistory(projectId?: string) {
  const navigate = useNavigate();
  const { id: mixedId } = useLoaderData<{ id?: string }>();
  const [searchParams] = useSearchParams();

  const [archivedMessages, setArchivedMessages] = useState<Message[]>([]);
  const [initialMessages, setInitialMessages] = useState<Message[]>([]);
  const [ready, setReady] = useState<boolean>(false);
  const [urlId, setUrlId] = useState<string | undefined>();
  const [loadingState, setLoadingState] = useState<MessageLoadingState>(initialLoadingState);
  const [totalServerMessages, setTotalServerMessages] = useState<number | null>(null);
  const [loadedServerMessages, setLoadedServerMessages] = useState<number>(0);
  const [loadingOlder, setLoadingOlder] = useState<boolean>(false);
  const [loadingOlderError, setLoadingOlderError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Track which ID the current data was loaded for to prevent stale data display
  const loadedIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const loadMessages = async () => {
      let storedMessages: ChatHistoryItem | null = null;
      let snapshot: Snapshot | null = null;

      // Reset ALL relevant state to prevent stale data from previous chat
      setReady(false);
      setInitialMessages([]);
      setArchivedMessages([]);
      setUrlId(undefined);
      loadedIdRef.current = undefined; // Clear loaded ID to invalidate stale data immediately

      // Reset loading state
      setLoadingState(initialLoadingState);
      setTotalServerMessages(null);
      setLoadedServerMessages(0);
      setLoadingOlder(false);
      setLoadingOlderError(null);

      // Track whether server loading was attempted and succeeded (even if no data returned)
      let serverLoadAttempted = false;

      // Track whether snapshot has been restored to prevent duplicate calls
      let snapshotRestored = false;

      // Try server storage first if projectId is provided and user is authenticated
      if (projectId && isUserAuthenticated()) {
        try {
          // Update loading state to 'server'
          setLoadingState({
            phase: 'server',
            loaded: 0,
            total: null,
            error: null,
            isPartial: false,
            retryCount: 0,
            lastRetryAt: null,
          });

          // Progress callback for paginated loading
          const onProgress = (progress: MessageLoadProgress) => {
            logger.info('Loading messages progress:', {
              loaded: progress.loaded,
              total: progress.total,
              page: progress.page,
              isComplete: progress.isComplete,
              isRateLimited: progress.isRateLimited,
            });

            setLoadedServerMessages(progress.loaded);
            setTotalServerMessages(progress.total);

            // Update loading state during pagination
            setLoadingState((prev) => ({
              ...prev,
              phase: progress.isRateLimited ? 'partial' : 'server',
              loaded: progress.loaded,
              total: progress.total,
              isPartial: !progress.isComplete && progress.loaded > 0,
            }));
          };

          const [serverMessages, serverSnapshot] = await Promise.all([
            getServerMessages(projectId, onProgress),
            getServerSnapshot(projectId),
          ]);
          storedMessages = serverMessages;
          snapshot = serverSnapshot;

          if (storedMessages) {
            setLoadedServerMessages(storedMessages.messages.length);

            // Initialize pending message tracking from loaded messages
            if (projectId) {
              initializePendingMessagesFromStore(projectId, storedMessages.messages);
            }
          }

          /*
           * When server load succeeds, trust the server as the source of truth.
           * Skip merging with local IndexedDB - this prevents issues where:
           * 1. Local has stale/different data from previous sessions
           * 2. Unnecessary merge operations when sync was successful
           * 3. Confusion about which messages are authoritative
           *
           * Local IndexedDB is only used as fallback when:
           * - Server request fails (offline, auth error, etc.)
           * - User is not authenticated
           */
          logger.info('Server load successful, using server data as source of truth', {
            projectId,
            messageCount: storedMessages?.messages.length || 0,
          });

          // Mark that server was successfully queried (even if no data was returned)
          serverLoadAttempted = true;
          logger.info('Loaded messages and snapshot from server', { projectId });
        } catch (error) {
          logger.warn('Failed to load from server, falling back to client storage', {
            projectId,
            error: String(error),
          });

          // Fall back to client storage
          setLoadingState({
            phase: 'local',
            loaded: 0,
            total: null,
            error: null,
            isPartial: true,
            retryCount: 0,
            lastRetryAt: null,
          });

          // Try local storage as fallback
          if (db && mixedId) {
            try {
              const [clientMessages, clientSnapshot] = await Promise.all([
                getMessages(db, mixedId),
                getSnapshot(db, mixedId),
              ]);
              storedMessages = clientMessages;
              snapshot = clientSnapshot || null;

              // Show warning toast for local fallback
              toast.warning('Loaded from local cache - server unavailable', {
                toastId: 'local-cache-fallback',
                autoClose: 5000,
              });

              logger.info('Loaded messages from local cache', { projectId, mixedId });
            } catch (localError) {
              logger.error('Failed to load from client storage', { error: String(localError) });

              // Set error state
              setLoadingState({
                phase: 'error',
                loaded: 0,
                total: null,
                error: String(localError),
                isPartial: false,
                retryCount: 0,
                lastRetryAt: null,
              });
            }
          }
        }
      }

      /*
       * If server storage failed or not available, try client storage
       * Only fall back to local storage if server was NOT successfully queried
       */
      if (!storedMessages && db && mixedId && !serverLoadAttempted) {
        try {
          const [clientMessages, clientSnapshot] = await Promise.all([
            getMessages(db, mixedId),
            getSnapshot(db, mixedId),
          ]);
          storedMessages = clientMessages;
          snapshot = clientSnapshot || null;
        } catch (error) {
          logger.error('Failed to load from client storage', { error: String(error) });
        }
      }

      // Process loaded messages
      if (storedMessages && storedMessages.messages.length > 0) {
        /*
         * Sort messages by timestamp to ensure consistent order
         * This is important for messages loaded from server which may be out of order
         */
        const sortedMessages = sortMessagesByTimestamp(storedMessages.messages);
        storedMessages.messages = sortedMessages;

        /*
         * const snapshotStr = localStorage.getItem(`snapshot:${mixedId}`); // Remove localStorage usage
         * const snapshot: Snapshot = snapshotStr ? JSON.parse(snapshotStr) : { chatIndex: 0, files: {} }; // Use snapshot from DB
         */
        const validSnapshot = snapshot || { chatIndex: '', files: {} }; // Ensure snapshot is not undefined
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
            .filter((x): x is { content: string; path: string } => !!x); // Type assertion
          const projectCommands = await detectProjectCommands(files);

          // Call the modified function to get only the command actions string
          const commandActionsString = createCommandActionsString(projectCommands);

          filteredMessages = [
            {
              id: generateId(),
              role: 'user',
              content: `Restore project from snapshot`, // Removed newline
              annotations: ['no-store', 'hidden'],
            },
            {
              id: storedMessages.messages[snapshotIndex].id,
              role: 'assistant',

              // Combine followup message and the artifact with files and command actions
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
                  `, // Added commandActionsString, followupMessage, updated id and title
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

            // Remove the separate user and assistant messages for commands
            /*
             *...(commands !== null // This block is no longer needed
             *  ? [ ... ]
             *  : []),
             */
            ...filteredMessages,
          ];

          if (mixedId && !snapshotRestored) {
            await restoreSnapshot(mixedId, snapshot || undefined);
            snapshotRestored = true;
          }
        }

        // If we have a snapshot with files but didn't restore it yet (no chatIndex match),
        // still restore the files to WebContainer
        if (snapshot?.files && Object.keys(snapshot.files).length > 0 && startingIdx <= 0 && !snapshotRestored) {
          const idToRestore = mixedId || projectId;
          if (idToRestore) {
            logger.info('Restoring snapshot without chatIndex match', {
              projectId,
              mixedId,
              filesCount: Object.keys(snapshot.files).length,
            });
            await restoreSnapshot(idToRestore, snapshot);
            snapshotRestored = true;
          }
        }

        setInitialMessages(filteredMessages);

        setUrlId(storedMessages.urlId);
        description.set(storedMessages.description);
        chatId.set(storedMessages.id);
        chatMetadata.set(storedMessages.metadata);
      } else if (projectId || mixedId) {
        /*
         * Either project exists (projectId) or we're on a /chat/:id route (mixedId).
         * Don't redirect - initialize as empty chat so user can start chatting.
         * This handles: 1) new projects with no messages, 2) local chats without server project
         */
        setInitialMessages([]);
        chatId.set(mixedId || projectId);

        // Restore snapshot files even without messages (e.g., newly generated projects)
        if (snapshot?.files && Object.keys(snapshot.files).length > 0 && !snapshotRestored) {
          const idToRestore = mixedId || projectId;
          if (idToRestore) {
            logger.info('Restoring snapshot for project with no messages', {
              projectId,
              mixedId,
              filesCount: Object.keys(snapshot.files).length,
            });
            await restoreSnapshot(idToRestore, snapshot);
            snapshotRestored = true;
          }
        }
      } else {
        navigate('/', { replace: true });
      }

      loadedIdRef.current = mixedId || projectId; // Mark which ID this data belongs to
      setReady(true);

      // Set loading state to complete
      setLoadingState({
        phase: 'complete',
        loaded: storedMessages?.messages.length || 0,
        total: storedMessages?.messages.length || 0,
        error: null,
        isPartial: false,
        retryCount: 0,
        lastRetryAt: null,
      });
    };

    // Execute the loadMessages function
    loadMessages().catch((error) => {
      logger.error(error);
      logStore.logError('Failed to load chat messages or snapshot', error);
      toast.error('Failed to load chat: ' + error.message);
      loadedIdRef.current = mixedId || projectId; // Mark which ID this data belongs to (even on error)
      setReady(true);

      // Set error state
      setLoadingState({
        phase: 'error',
        loaded: 0,
        total: null,
        error: error.message,
        isPartial: false,
        retryCount: 0,
        lastRetryAt: null,
      });
    });
  }, [mixedId, db, navigate, searchParams, projectId]); // Added projectId dependency

  // Background sync effect: triggers when auth becomes available
  useEffect(() => {
    // Only run if we have a project and user is authenticated
    if (!projectId || !isUserAuthenticated()) {
      return undefined;
    }

    // Check if there are pending messages
    const checkAndSyncPending = async () => {
      try {
        const { getPendingMessageIds } = await import('./messageSyncState');
        const pendingIds = getPendingMessageIds(projectId);

        if (pendingIds.size === 0) {
          return undefined; // No pending messages
        }

        logger.info('Background sync: Found pending messages', { projectId, count: pendingIds.size });

        // Find pending messages from current messages
        const pendingMessages = initialMessages.filter((m) => pendingIds.has(m.id));

        if (pendingMessages.length === 0) {
          // Clear stale pending state
          const { clearPendingMessages } = await import('./messageSyncState');
          clearPendingMessages(projectId);

          return undefined;
        }

        // Try to sync without showing UI toasts (background operation)
        setIsSyncing(true);

        try {
          await appendServerMessages(projectId, pendingMessages);

          // Clear pending markers after successful sync
          const { markMessageAsSynced, clearSyncError } = await import('./messageSyncState');

          for (const msg of pendingMessages) {
            markMessageAsSynced(projectId, msg.id);
          }
          clearSyncError(projectId);

          logger.info('Background sync completed', { projectId, count: pendingMessages.length });
        } catch (error) {
          // Keep pending state on error (will be retried)
          const errorMessage = error instanceof Error ? error.message : String(error);
          const { setSyncError } = await import('./messageSyncState');
          setSyncError(projectId, errorMessage);
          logger.warn('Background sync failed (messages remain pending)', { projectId, error: errorMessage });
        } finally {
          setIsSyncing(false);
        }
      } catch (error) {
        logger.error('Background sync check failed', { projectId, error: String(error) });
      }

      return undefined;
    };

    // Delay slightly to avoid interfering with initial load
    const timeoutId = setTimeout(checkAndSyncPending, 2000);

    return () => clearTimeout(timeoutId);
  }, [projectId, initialMessages]); // Re-run when projectId or messages change

  // Re-run background sync when auth state changes
  useEffect(() => {
    if (!projectId) {
      return undefined;
    }

    const isAuthenticated = isUserAuthenticated();

    // If user just signed in, trigger background sync after a short delay
    if (isAuthenticated) {
      const pendingIds = getPendingMessageIds(projectId);

      if (pendingIds.size > 0) {
        logger.info('Auth state changed: User signed in, triggering background sync');

        const timeoutId = setTimeout(async () => {
          // Trigger the retry sync logic
          try {
            const pendingMessages = initialMessages.filter((m) => pendingIds.has(m.id));

            if (pendingMessages.length > 0) {
              setIsSyncing(true);
              await appendServerMessages(projectId, pendingMessages);

              const { markMessageAsSynced, clearSyncError } = await import('./messageSyncState');

              for (const msg of pendingMessages) {
                markMessageAsSynced(projectId, msg.id);
              }
              clearSyncError(projectId);

              logger.info('Post-auth sync completed', { projectId, count: pendingMessages.length });
            }
          } catch (error) {
            logger.error('Post-auth sync failed', { projectId, error: String(error) });
          } finally {
            setIsSyncing(false);
          }
        }, 1000);

        return () => clearTimeout(timeoutId);
      }
    }

    return undefined;
  }, [projectId]); // Only depends on projectId (auth check happens inside)

  const takeSnapshot = useCallback(
    async (chatIdx: string, files: FileMap, _chatId?: string | undefined, chatSummary?: string) => {
      const id = chatId.get();

      if (!id) {
        return;
      }

      const snapshot: Snapshot = {
        chatIndex: chatIdx,
        files,
        summary: chatSummary,
      };

      // localStorage.setItem(`snapshot:${id}`, JSON.stringify(snapshot)); // Remove localStorage usage
      try {
        // Save to client-side IndexedDB if available
        if (db) {
          await setSnapshot(db, id, snapshot);
        }

        // Also save to server if authenticated and projectId is available
        if (projectId && isUserAuthenticated()) {
          try {
            await setServerSnapshot(projectId, snapshot);
            logger.info('Snapshot saved to server', { projectId });
          } catch (serverError) {
            logger.warn('Failed to save snapshot to server, client-only backup exists', {
              projectId,
              error: String(serverError),
            });

            // Don't show toast for server errors since client backup succeeded
          }
        }
      } catch (error) {
        logger.error('Failed to save snapshot:', error);
        toast.error('Failed to save chat snapshot.');
      }
    },
    [db, projectId],
  );

  const restoreSnapshot = useCallback(async (id: string, snapshot?: Snapshot) => {
    const validSnapshot = snapshot || { chatIndex: '', files: {} };

    if (!validSnapshot?.files || Object.keys(validSnapshot.files).length === 0) {
      return;
    }

    logger.info('Restoring snapshot files', {
      id,
      filesCount: Object.keys(validSnapshot.files).length,
    });

    const entries = Object.entries(validSnapshot.files);

    // First pass: create all folders (sorted by path depth to ensure parents first)
    const folders = entries
      .filter(([, value]) => value?.type === 'folder')
      .sort(([a], [b]) => a.length - b.length);

    for (const [folderPath] of folders) {
      try {
        await workbenchStore.createFolder(folderPath);
      } catch (error) {
        // Folder might already exist, which is fine
        logger.debug('Folder creation skipped (may exist)', { folderPath });
      }
    }

    // Second pass: create all files
    const files = entries.filter(([, value]) => value?.type === 'file');

    for (const [filePath, value] of files) {
      if (value?.type === 'file') {
        try {
          await workbenchStore.createFile(filePath, value.content);
        } catch (error) {
          logger.error('Failed to create file from snapshot', { filePath, error: String(error) });
        }
      }
    }

    logger.info('Snapshot restoration complete', {
      id,
      foldersCreated: folders.length,
      filesCreated: files.length,
    });

    // Show workbench after successful file restoration
    if (files.length > 0) {
      workbenchStore.setShowWorkbench(true);
    }
  }, []);

  // Compute effective ready state: only ready if data belongs to current ID
  const currentId = mixedId || projectId;
  const isDataForCurrentId = loadedIdRef.current === currentId;

  return {
    ready: !mixedId || (ready && isDataForCurrentId),
    initialMessages,
    loadingState,
    totalServerMessages,
    loadedServerMessages,
    hasOlderMessages: totalServerMessages !== null && loadedServerMessages < totalServerMessages,
    loadingOlder,
    loadingOlderError,
    isSyncing,
    syncStatus: computeSyncStatus(projectId, isUserAuthenticated(), isSyncing),
    loadOlderMessages: async () => {
      if (!projectId || !isUserAuthenticated()) {
        return;
      }

      if (loadingOlder) {
        return;
      }

      // Guardrail: Check if we've reached the maximum number of pages
      const currentPages = Math.ceil(loadedServerMessages / MESSAGE_PAGE_SIZE);

      if (currentPages >= MAX_MESSAGE_PAGES) {
        toast.info(
          `You've loaded the maximum number of messages (${MAX_MESSAGE_PAGES * MESSAGE_PAGE_SIZE}). For very large chat histories, consider exporting and starting a new chat.`,
        );
        return;
      }

      const offset = loadedServerMessages;

      setLoadingOlder(true);
      setLoadingOlderError(null);

      try {
        const { messages, total } = await getServerMessagesPage(projectId, offset, MESSAGE_PAGE_SIZE);

        if (messages.length === 0) {
          setTotalServerMessages(total);
          return;
        }

        const normalizedMessages = sortMessagesByTimestamp(messages);
        setInitialMessages((prev) => [...normalizedMessages, ...prev]);
        setLoadedServerMessages((prev) => prev + normalizedMessages.length);
        setTotalServerMessages(total);

        if (db) {
          const persistedMessages = [...archivedMessages, ...normalizedMessages, ...initialMessages];
          const persistedId = chatId.get() || projectId;
          const persistedUrlId = urlId || (persistedId !== projectId ? persistedId : undefined);
          await setMessages(
            db,
            persistedId,
            persistedMessages,
            persistedUrlId,
            description.get(),
            undefined,
            chatMetadata.get(),
          );
        }

        // Show warning if approaching limit
        const newPages = Math.ceil((loadedServerMessages + normalizedMessages.length) / MESSAGE_PAGE_SIZE);

        if (newPages >= MAX_MESSAGE_PAGES) {
          toast.info(
            `You've reached the maximum number of messages that can be loaded (${MAX_MESSAGE_PAGES * MESSAGE_PAGE_SIZE}). Older messages are still saved but not displayed for performance.`,
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load older messages';
        setLoadingOlderError(message);
        throw error;
      } finally {
        setLoadingOlder(false);
      }
    },
    retrySync: async () => {
      if (!projectId || !isUserAuthenticated()) {
        toast.info('Sign in to sync messages');
        return;
      }

      setIsSyncing(true);

      try {
        // Get pending message IDs for this project
        const { getPendingMessageIds } = await import('./messageSyncState');
        const pendingIds = getPendingMessageIds(projectId);

        if (pendingIds.size === 0) {
          toast.info('No pending messages to sync');
          return;
        }

        // Find pending messages from current messages
        const pendingMessages = initialMessages.filter((m) => pendingIds.has(m.id));

        if (pendingMessages.length === 0) {
          // Clear stale pending state
          const { clearPendingMessages } = await import('./messageSyncState');
          clearPendingMessages(projectId);

          return;
        }

        logger.info('Retrying sync for pending messages', { projectId, count: pendingMessages.length });

        // Try to append pending messages to server
        await appendServerMessages(projectId, pendingMessages);

        // Clear pending markers after successful sync
        const { markMessageAsSynced, clearSyncError } = await import('./messageSyncState');

        for (const msg of pendingMessages) {
          markMessageAsSynced(projectId, msg.id);
        }
        clearSyncError(projectId);

        toast.success(`Synced ${pendingMessages.length} message(s)`);
        logger.info('Pending messages synced successfully', { projectId, count: pendingMessages.length });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        const { setSyncError } = await import('./messageSyncState');
        setSyncError(projectId, errorMessage);

        logger.error('Failed to retry sync', { projectId, error: errorMessage });
        toast.error('Failed to sync messages. They will be saved locally.');
      } finally {
        setIsSyncing(false);
      }
    },
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
        logger.error(error);
      }
    },
    storeMessageHistory: async (messages: Message[]) => {
      if (!db || messages.length === 0) {
        return;
      }

      const { firstArtifact } = workbenchStore;
      messages = messages.filter((m) => !extractMessageAnnotations(m).includes('no-store'));

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
        logger.error('Cannot save messages, chat ID is not set.');
        toast.error('Failed to save chat messages: Chat ID missing.');

        return;
      }

      // Deduplicate messages by ID before saving to avoid duplicates
      const existingMessageIds = new Set(archivedMessages.map((m) => m.id));
      const newMessages = messages.filter((m) => !existingMessageIds.has(m.id));
      const allMessages = [...archivedMessages, ...newMessages];

      // Save to client storage
      await setMessages(
        db,
        finalChatId, // Use the potentially updated chatId
        allMessages,
        urlId,
        description.get(),
        undefined,
        chatMetadata.get(),
      );

      // Also save to server if projectId is provided and user is authenticated
      if (projectId && isUserAuthenticated()) {
        try {
          const existingIds = new Set(archivedMessages.map((message) => message.id));
          const unsyncedMessages = messages.filter((message) => !existingIds.has(message.id));

          // Filter out messages with empty content to avoid LLM validation errors
          const messagesToSync = unsyncedMessages.filter((msg) => !isMessageEmpty(msg));

          if (messagesToSync.length > 0) {
            await appendServerMessages(projectId, messagesToSync);

            // Clear pending markers after successful sync
            for (const msg of messagesToSync) {
              markMessageAsSynced(projectId, msg.id);
            }

            // Clear any sync errors
            clearSyncError(projectId);

            logger.info('Messages appended to server', { projectId, count: messagesToSync.length });
          } else if (unsyncedMessages.length > 0) {
            // All messages had empty content - log for debugging
            logger.warn('Skipped syncing messages with empty content', { projectId, count: unsyncedMessages.length });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);

          // Mark messages as pending and set error state
          for (const msg of messages) {
            if (!archivedMessages.some((am) => am.id === msg.id)) {
              markMessageAsPending(projectId, msg.id);
            }
          }

          setSyncError(projectId, errorMessage);

          logger.error('Failed to append messages to server', {
            projectId,
            error: errorMessage,
          });
          toast.warning('Messages saved locally, but failed to sync to server');
        }
      } else if (projectId && !isUserAuthenticated()) {
        // User is signed out - mark new messages as pending
        const existingIds = new Set(archivedMessages.map((message) => message.id));
        const newMessages = messages.filter((message) => !existingIds.has(message.id));

        for (const msg of newMessages) {
          markMessageAsPending(projectId, msg.id);
        }

        logger.info('Messages marked as pending (signed out)', { projectId, count: newMessages.length });
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
        logger.info(error);
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
    clearChatHistory: async () => {
      const id = chatId.get() || projectId;

      if (!id) {
        toast.error('No chat to clear');
        return;
      }

      // Confirm before clearing
      const confirmed = window.confirm(
        'Are you sure you want to clear all chat history? This action cannot be undone.',
      );

      if (!confirmed) {
        return;
      }

      try {
        // Clear from server if projectId and user is authenticated
        if (projectId && isUserAuthenticated()) {
          await clearServerMessages(projectId);
          logger.info('Server messages cleared', { projectId });
        }

        // Clear from local IndexedDB
        if (db) {
          const deleteId = chatId.get() || projectId;

          if (deleteId) {
            await deleteById(db, deleteId);
            logger.info('Local messages cleared', { deleteId });
          }
        }

        // Clear pending sync state
        if (projectId) {
          const { clearPendingMessages } = await import('./messageSyncState');
          clearPendingMessages(projectId);
        }

        // Reset chat state
        setInitialMessages([]);
        setArchivedMessages([]);
        setTotalServerMessages(null);
        setLoadedServerMessages(0);
        setLoadingOlderError(null);

        toast.success('Chat history cleared successfully');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to clear chat history';
        logger.error('Failed to clear chat history', { error });
        toast.error(errorMessage);
      }
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
