import { atom } from 'nanostores';
import mergeResponseMessage from '~/components/chat/ChatComponent/functions/mergeResponseMessages';
import type { Message } from '~/lib/persistence/message';
import type { ChatResponse } from '~/lib/persistence/response';
import { clearPendingMessageStatus } from './status';
import { sendChatMessage, listenAppResponses, ChatMode, type NutChatRequest } from '~/lib/replay/SendChatMessage';
import { setPendingMessageStatus } from './status';
import {
  APP_SUMMARY_CATEGORY,
  isFeatureStatusImplemented,
  parseAppSummaryMessage,
  type AppSummary,
} from '~/lib/persistence/messageAppSummary';
import { updateDevelopmentServer } from '~/lib/replay/DevelopmentServer';
import { toast } from 'react-toastify';
import { peanutsStore, refreshPeanutsStore } from './peanuts';
import { callNutAPI, NutAPIError } from '~/lib/replay/NutAPI';
import { statusModalStore } from './statusModal';
import { addAppResponse } from '~/lib/replay/ResponseFilter';

export class ChatStore {
  currentAppId = atom<string | undefined>(undefined);
  appTitle = atom<string | undefined>(undefined);
  appSummary = atom<AppSummary | undefined>(undefined);

  started = atom<boolean>(false);
  numAborts = atom<number>(0);
  showChat = atom<boolean>(true);

  // Whether there is an outstanding message sent to the chat.
  hasPendingMessage = atom<boolean>(false);

  // Set if work to build the app is actively going on and we are listening for responses.
  listenResponses = atom<boolean>(false);

  messages = atom<Message[]>([]);
  events = atom<ChatResponse[]>([]);
}

export const chatStore = new ChatStore();

// Return whether a response is relevant to reconstructing the progress on each feature.
export function isResponseEvent(response: ChatResponse) {
  switch (response.kind) {
    case 'app-event':
    case 'done':
    case 'error':
    case 'aborted':
      return true;
    default:
      return false;
  }
}

function addResponseEvent(response: ChatResponse) {
  chatStore.events.set([...chatStore.events.get(), response]);
}

export function addChatMessage(message: Message) {
  // Ensure hasInteracted field is set for text messages
  const processedMessage =
    message.type === 'text'
      ? {
          ...message,
          hasInteracted: message.hasInteracted ?? false,
        }
      : message;

  // If this is a user message, remember it so we don't add it again when it comes back
  // from the backend.
  addAppResponse({
    kind: 'message',
    message: processedMessage,
    time: processedMessage.createTime ?? new Date().toISOString(),
    chatId: undefined,
  });

  chatStore.messages.set(mergeResponseMessage(processedMessage, chatStore.messages.get()));
}

export async function doAbortChat() {
  chatStore.numAborts.set(chatStore.numAborts.get() + 1);
  chatStore.hasPendingMessage.set(false);
  chatStore.listenResponses.set(false);
  clearPendingMessageStatus();

  const appId = chatStore.currentAppId.get();
  if (appId) {
    const { response } = await callNutAPI('abort-app-chats', { appId });
    if (response) {
      onChatResponse(response, 'AbortChat');
    }
  }
}

function getErrorMessage(e: unknown): string {
  if (e instanceof NutAPIError) {
    return e.responseText;
  }
  return '';
}

function showPreview(appSummary: AppSummary) {
  if (!appSummary.repositoryId) {
    return false;
  }

  // Don't show preliminary repositories before the app finishes the mockup
  // or at least one feature.
  if (
    !isFeatureStatusImplemented(appSummary?.features?.[0]?.status) &&
    !appSummary.features?.some(({ status }) => isFeatureStatusImplemented(status))
  ) {
    return false;
  }

  return true;
}

export function onChatResponse(response: ChatResponse, reason: string) {
  if (!addAppResponse(response)) {
    return;
  }

  switch (response.kind) {
    case 'message': {
      const existingSummary = chatStore.appSummary.get();
      const existingRepositoryId = existingSummary?.repositoryId;

      const { message } = response;
      if (message.category === APP_SUMMARY_CATEGORY) {
        const appSummary = parseAppSummaryMessage(message);
        if (appSummary) {
          const existingSummary = chatStore.appSummary.get();
          if (!existingSummary || appSummary.iteration > existingSummary.iteration) {
            chatStore.appSummary.set(appSummary);
          }

          if (showPreview(appSummary) && existingRepositoryId != appSummary.repositoryId) {
            updateDevelopmentServer(appSummary.repositoryId);
          }
        }

        // Diagnostic for tracking down why the UI doesn't update as expected.
        console.log('AppSummary', reason, appSummary?.iteration);
      }

      addChatMessage(response.message);
      break;
    }
    case 'app-event':
      addResponseEvent(response);
      break;
    case 'title':
      chatStore.appTitle.set(response.title);
      break;
    case 'status':
      setPendingMessageStatus(response.status);
      break;
    case 'error':
      // Only show errors if there is an active message being sent.
      // We will get error responses from workers as well but the backend will
      // recover so we don't surface these.
      if (chatStore.hasPendingMessage.get()) {
        toast.error('Error sending message');
        console.error('Error sending message', response.error);
      }
      addResponseEvent(response);
      break;
    case 'done':
    case 'aborted':
      addResponseEvent(response);
      break;
    default:
      console.error('Unknown chat response:', response);
      break;
  }
}

export async function doSendMessage(request: NutChatRequest) {
  const numAbortsAtStart = chatStore.numAborts.get();

  if (request.mode == ChatMode.DevelopApp) {
    await refreshPeanutsStore();
    if (peanutsStore.peanutsErrorInfo.get()) {
      toast.error(peanutsStore.peanutsErrorInfo.get());
      return;
    }
  }

  chatStore.hasPendingMessage.set(true);
  clearPendingMessageStatus();

  try {
    await sendChatMessage(request, (r) => onChatResponse(r, `SendMessage:${request.mode}`));
  } catch (e) {
    toast.error(getErrorMessage(e) || 'Error sending message');
    console.error('Error sending message', e);
  }

  if (chatStore.numAborts.get() != numAbortsAtStart) {
    return;
  }

  chatStore.hasPendingMessage.set(false);

  doListenAppResponses();
}

export async function doListenAppResponses(wasStatusModalOpen = false) {
  if (!chatStore.currentAppId.get()) {
    return;
  }

  const { active } = await callNutAPI('app-chat-active', { appId: chatStore.currentAppId.get() });
  if (!active) {
    console.log('ListenAppResponsesNotActive');
    if (wasStatusModalOpen) {
      statusModalStore.open();
    }
    return;
  }

  if (chatStore.listenResponses.get()) {
    return;
  }
  chatStore.listenResponses.set(true);

  const numAbortsAtStart = chatStore.numAborts.get();

  console.log('ListenAppResponsesStart');

  try {
    await listenAppResponses((r) => onChatResponse(r, 'ListenAppResponses'));
  } catch (e) {
    toast.error('Error listing to app responses');
    console.error('Error listing to app response', e);
  }

  console.log('ListenAppResponsesDone');

  if (chatStore.numAborts.get() != numAbortsAtStart) {
    return;
  }

  chatStore.listenResponses.set(false);

  await refreshPeanutsStore();

  statusModalStore.open();
}

export function continueBuilding() {
  // This will trigger the continue building action
  // We'll need to emit an event or call a function that the BaseChat can listen to
  const event = new CustomEvent('continueBuilding');
  window.dispatchEvent(event);
}
