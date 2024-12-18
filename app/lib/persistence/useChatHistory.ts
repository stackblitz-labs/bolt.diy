import { useLoaderData, useNavigate, useSearchParams } from '@remix-run/react';
import { useState, useEffect, useCallback } from 'react';
import { atom } from 'nanostores';
import type { Message } from 'ai';
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
} from './db';
import type { FileMap } from '../stores/files';
import type { Snapshot } from './types';
import { webcontainer } from '../webcontainer';

export interface ChatHistoryItem {
  id: string;
  urlId?: string;
  description?: string;
  messages: Message[];
  timestamp: string;
}

const persistenceEnabled = !import.meta.env.VITE_DISABLE_PERSISTENCE;

export const db = persistenceEnabled ? await openDatabase() : undefined;

export const chatId = atom<string | undefined>(undefined);
export const description = atom<string | undefined>(undefined);

export function useChatHistory() {
  const navigate = useNavigate();
  const { id: mixedId } = useLoaderData<{ id?: string }>();
  const [searchParams] = useSearchParams();

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
      getMessages(db, mixedId)
        .then((storedMessages) => {
          if (storedMessages && storedMessages.messages.length > 0) {
            let snapshotStr = localStorage.getItem(`snapshot:${mixedId}`);
            const snapshot: Snapshot = snapshotStr ? JSON.parse(snapshotStr) : { chatIndex: 0, files: {} };
            
            const rewindId = searchParams.get('rewindTo');
            let startingIdx=0;
            let endingIdx = rewindId ? storedMessages.messages.findIndex((m) => m.id === rewindId) + 1 : storedMessages.messages.length;
            if (snapshot?.chatIndex && snapshot.chatIndex-1 <= endingIdx){
              startingIdx=snapshot.chatIndex;
            }
            if(storedMessages.messages[snapshot.chatIndex-1].id==rewindId){
              startingIdx=0;
            }
            let filteredMessages = storedMessages.messages.slice(startingIdx, endingIdx);

            

            startingIdx>0? setArchivedMessages(storedMessages.messages.slice(0,startingIdx)):setArchivedMessages([]);
            if (startingIdx>0){
              filteredMessages=[
                {
                  "id": storedMessages.messages[snapshot.chatIndex-1].id,
                  "role":"assistant",
                  "content":` 📦 Chat Restored from snapshot`, 
                  annotations:['no-store']
                },
                {
                  "id": `${Date.now()}`,
                  "role":"assistant",
                  "content":` Below are the files and content of the files restored:
                  ### Files ###
                  ${Object.entries(snapshot?.files||{}).filter(x=>!x[0].endsWith('lock.json')).map(([key,value])=>{  
                    if(value?.type==="file"){
                      return `
                      #### ${key}
                      ${value.content}
                      `
                    }
                  }).join("\n")}
                  `, 
                  annotations:['no-store','hidden']

                },
                ...filteredMessages
              ]
              restoreSnapshot(mixedId);

            }

            setInitialMessages(filteredMessages);
            
            setUrlId(storedMessages.urlId);
            description.set(storedMessages.description);
            chatId.set(storedMessages.id);
          } else {
            navigate('/', { replace: true });
          }

          setReady(true);
        })
        .catch((error) => {
          logStore.logError('Failed to load chat messages', error);
          toast.error(error.message);
        });
    }
  }, [mixedId]);



  const takeSnapshot = useCallback(async (chatIdx: number, files: FileMap, _chatId?: string | undefined) => {
    let id = _chatId || chatId;
    if (!id) return;
    const snapshot: Snapshot = {
      chatIndex: chatIdx,
      files
    }
    localStorage.setItem(`snapshot:${id}`, JSON.stringify(snapshot));
  }, [chatId])

  const restoreSnapshot = useCallback(async (id:string) => {
    let snapshotStr = localStorage.getItem(`snapshot:${mixedId}`);
    let container =await webcontainer;
    // if (snapshotStr)setSnapshot(JSON.parse(snapshotStr)); 
    const snapshot:Snapshot = snapshotStr ? JSON.parse(snapshotStr) : { chatIndex: 0, files: {} };
    if (!(snapshot?.files)) return;
    Object.entries(snapshot.files).forEach(async ([key, value]) => {
      if (key.startsWith(container.workdir)) {
        key = key.replace(container.workdir, '');
      }
      if (value?.type === "folder") {
        await container.fs.mkdir(key,{recursive:true});
      }
    })
    Object.entries(snapshot.files).forEach(async ([key, value]) => {
      if (value?.type === "file") {
        if (key.startsWith(container.workdir)){
          key = key.replace(container.workdir,'');
        }
        await container.fs.writeFile(key, value.content,{encoding:value.isBinary?undefined:'utf8'});
      }
      else{

      }
    })
    // workbenchStore.files.setKey(snapshot?.files)

  }, [ ])

  return {
    ready: !mixedId || ready,
    initialMessages,
    storeMessageHistory: async (messages: Message[]) => {
      if (!db || messages.length === 0) {
        return;
      }

      const { firstArtifact } = workbenchStore;
      messages=messages.filter((m)=>!m.annotations?.includes('no-store'))
      let _urlId = urlId
      if (!urlId && firstArtifact?.id) {
        const urlId = await getUrlId(db, firstArtifact.id);
        _urlId=urlId
        navigateChat(urlId);
        setUrlId(urlId);
      }
      
      takeSnapshot(archivedMessages.length + messages.length, workbenchStore.files.get(), _urlId)

      if (!description.get() && firstArtifact?.title) {
        description.set(firstArtifact?.title);
      }

      if (initialMessages.length === 0 && !chatId.get()) {
        const nextId = await getNextId(db);

        chatId.set(nextId);

        if (!urlId) {
          navigateChat(nextId);
        }
      }

      await setMessages(db, chatId.get() as string, [...archivedMessages,...messages], urlId, description.get());
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
    importChat: async (description: string, messages: Message[]) => {
      if (!db) {
        return;
      }

      try {
        const newId = await createChatFromMessages(db, description, messages);
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
