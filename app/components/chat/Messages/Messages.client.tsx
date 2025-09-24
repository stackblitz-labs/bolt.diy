import React, { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { classNames } from '~/utils/classNames';
import {
  type Message,
  DISCOVERY_RESPONSE_CATEGORY,
  DISCOVERY_RATING_CATEGORY,
  getDiscoveryRating,
} from '~/lib/persistence/message';
import {
  MessageContents,
  JumpToBottom,
  AppCards,
  StartBuildingCard,
  SignInCard,
  AddPeanutsCard,
  StopBuildCard,
  ContinueBuildCard,
  SubscriptionCard,
} from './components';
import { APP_SUMMARY_CATEGORY } from '~/lib/persistence/messageAppSummary';
import { useStore } from '@nanostores/react';
import { chatStore } from '~/lib/stores/chat';
import { pendingMessageStatusStore } from '~/lib/stores/status';
import { userStore } from '~/lib/stores/auth';
import { peanutsStore } from '~/lib/stores/peanuts';
import { ChatMode, shouldDisplayMessage } from '~/lib/replay/SendChatMessage';
import { AppFeatureStatus } from '~/lib/persistence/messageAppSummary';
import { subscriptionStore } from '~/lib/stores/subscriptionStatus';

interface MessagesProps {
  id?: string;
  className?: string;
  onLastMessageCheckboxChange?: (contents: string, checked: boolean) => void;
  sendMessage?: (params: { messageInput: string; chatMode: ChatMode }) => void;
}

export const Messages = React.forwardRef<HTMLDivElement, MessagesProps>(
  ({ onLastMessageCheckboxChange, sendMessage }, ref) => {
    const [showJumpToBottom, setShowJumpToBottom] = useState(false);
    const user = useStore(userStore);
    const appSummary = useStore(chatStore.appSummary);
    const peanutsRemaining = useStore(peanutsStore.peanutsRemaining);
    const listenResponses = useStore(chatStore.listenResponses);
    const [showTopShadow, setShowTopShadow] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const messages = useStore(chatStore.messages);
    const hasPendingMessage = useStore(chatStore.hasPendingMessage);
    const pendingMessageStatus = useStore(pendingMessageStatusStore);
    const hasAppSummary = !!useStore(chatStore.appSummary);
    const completedFeatures = appSummary?.features
      ?.slice(1)
      .filter(
        (feature) =>
          feature.status === AppFeatureStatus.Validated ||
          feature.status === AppFeatureStatus.Implemented ||
          feature.status === AppFeatureStatus.ValidationInProgress ||
          feature.status === AppFeatureStatus.ValidationFailed,
      ).length;
    const totalFeatures = appSummary?.features?.slice(1).length;
    const isFullyComplete = completedFeatures === totalFeatures && totalFeatures && totalFeatures > 0;
    const hasSubscription = useStore(subscriptionStore.hasSubscription);

    // Calculate startPlanningRating for the card display
    let startPlanningRating = 0;
    if (!hasPendingMessage && !hasAppSummary) {
      startPlanningRating = getDiscoveryRating(messages || []);
    }

    const setRefs = useCallback(
      (element: HTMLDivElement | null) => {
        containerRef.current = element;

        if (typeof ref === 'function') {
          ref(element);
        } else if (ref) {
          ref.current = element;
        }
      },
      [ref],
    );

    const handleScroll = () => {
      if (!containerRef.current) {
        return;
      }

      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

      setShowJumpToBottom(distanceFromBottom > 50);
      setShowTopShadow(scrollTop > 10);
    };

    const scrollToBottom = () => {
      if (!containerRef.current) {
        return;
      }

      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    };

    useEffect(() => {
      const container = containerRef.current;
      if (container) {
        container.addEventListener('scroll', handleScroll);
        return () => container.removeEventListener('scroll', handleScroll);
      }
      return undefined;
    }, []);

    useEffect(() => {
      if (!showJumpToBottom) {
        scrollToBottom();
      }
    }, [messages, showJumpToBottom]);

    useEffect(() => {
      if (hasPendingMessage && !showJumpToBottom) {
        const timer = setTimeout(() => {
          scrollToBottom();
        }, 50);

        return () => clearTimeout(timer);
      }
    }, [pendingMessageStatus, hasPendingMessage, showJumpToBottom]);

    // Scroll to bottom when start planning card appears
    useEffect(() => {
      if (startPlanningRating === 10) {
        const timer = setTimeout(() => {
          scrollToBottom();
        }, 500); // Small delay to ensure card is rendered

        return () => clearTimeout(timer);
      }
    }, [startPlanningRating]);

    // Helper function to get AppSummary creation time
    const getAppSummaryTime = (appSummary: Message): string => {
      try {
        if (appSummary.type === 'text' && appSummary.content) {
          const summaryData = JSON.parse(appSummary.content);
          return summaryData.time;
        }
      } catch {
        // Fall through to createTime
      }
      return appSummary.createTime || new Date().toISOString();
    };

    // Helper function to filter, deduplicate, and sort messages
    const processMessageGroup = (messageGroup: Message[]): Message[] => {
      return messageGroup
        .filter((message, index, array) => array.findIndex((m) => m.id === message.id) === index)
        .sort((a, b) => new Date(a.createTime!).getTime() - new Date(b.createTime!).getTime());
    };

    const renderMessage = (message: Message, index: number) => {
      const { role } = message;
      const isUserMessage = role === 'user';
      const isFirst = index === 0;
      const isLast = index === messages.length - 1;

      // Ignore messages that aren't displayed and don't affect the UI in other ways.
      if (!shouldDisplayMessage(message)) {
        if (message.category === APP_SUMMARY_CATEGORY) {
          // App summaries are now shown in the preview area, not in chat
          return null;
        }

        if (message.category === DISCOVERY_RATING_CATEGORY) {
          return null;
        }
      }

      let onCheckboxChange = undefined;
      if (isActiveDiscoveryResponse(messages, message) && !hasInteracted(message)) {
        onCheckboxChange = onLastMessageCheckboxChange;
      }

      return (
        <div
          data-testid="message"
          key={index}
          className={classNames('group relative w-full transition-all duration-200', {
            'mt-5': !isFirst,
          })}
        >
          <div
            className={classNames('p-6 rounded-2xl border transition-all duration-200', {
              // User messages
              'bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20 hover:border-blue-500/30':
                isUserMessage,
              // Assistant messages
              'bg-bolt-elements-messages-background border-bolt-elements-borderColor hover:border-bolt-elements-borderColor/60':
                !isUserMessage && (!hasPendingMessage || (hasPendingMessage && !isLast)),
              // Last message when pending
              'bg-gradient-to-b from-bolt-elements-messages-background from-30% to-transparent border-bolt-elements-borderColor/50':
                !isUserMessage && hasPendingMessage && isLast,
            })}
          >
            <Suspense
              fallback={
                <div className="flex items-center justify-center w-full py-8">
                  <div className="flex items-center gap-3 text-bolt-elements-textSecondary">
                    <div className="w-6 h-6 border-2 border-bolt-elements-textSecondary border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm">Loading...</span>
                  </div>
                </div>
              }
            >
              <div className="flex items-center gap-3 mb-4">
                {isUserMessage && (
                  <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-blue-500 to-green-500 text-white rounded-full shadow-lg">
                    <div className="i-ph:user text-lg"></div>
                  </div>
                )}

                {!isUserMessage && (
                  <div className="flex items-center justify-center w-8 h-8 bg-bolt-elements-background-depth-2 border-2 border-bolt-elements-borderColor text-bolt-elements-textPrimary rounded-full shadow-sm">
                    <div className="w-6 h-6">
                      <img src="/logo-styled.svg" alt="Nut" className="w-full h-full" />
                    </div>
                  </div>
                )}

                <span className={classNames('text-sm font-medium text-bolt-elements-textHeading')}>
                  {isUserMessage ? 'Me' : 'Nut'}
                </span>
              </div>

              <div className="w-full">
                <MessageContents message={message} onCheckboxChange={onCheckboxChange} />
              </div>
            </Suspense>
          </div>

          <div className="absolute -left-2 top-1/2 transform -translate-y-1/2 w-1 h-8 bg-bolt-elements-focus rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
        </div>
      );
    };

    return (
      <div className="relative flex-1 min-h-0 flex flex-col">
        {showTopShadow && (
          <div
            className="absolute top-0 left-1/2 transform -translate-x-1/2 h-px bg-bolt-elements-borderColor/30 shadow-sm z-2 pointer-events-none transition-opacity duration-200"
            style={{ width: 'calc(min(100%, var(--chat-max-width, 37rem)))' }}
          />
        )}

        <div
          ref={setRefs}
          className={classNames('flex-1 overflow-y-auto rounded-b-2xl', 'flex flex-col w-full max-w-chat pb-6 mx-auto')}
        >
          {(() => {
            const firstAppSummary = messages.find((message) => message.category === APP_SUMMARY_CATEGORY);

            if (!firstAppSummary) {
              const displayableMessages = processMessageGroup(messages.filter(shouldDisplayMessage));
              return (
                <>
                  {displayableMessages.map((message, index) => renderMessage(message, index))}
                  <AppCards />
                </>
              );
            }

            const appSummaryTime = getAppSummaryTime(firstAppSummary);

            const beforeMessages = processMessageGroup(
              messages.filter(
                (message) => shouldDisplayMessage(message) && message.createTime && message.createTime < appSummaryTime,
              ),
            );

            const afterMessages = processMessageGroup(
              messages.filter(
                (message) =>
                  shouldDisplayMessage(message) &&
                  message.category !== APP_SUMMARY_CATEGORY &&
                  message.createTime &&
                  message.createTime > appSummaryTime,
              ),
            );

            return (
              <>
                {beforeMessages.map((message, index) => renderMessage(message, index))}
                <div className="w-full mt-5">
                  <AppCards />
                </div>
                {afterMessages.length > 0 && (
                  <div className="mt-5">{afterMessages.map((message, index) => renderMessage(message, index))}</div>
                )}
              </>
            );
          })()}

          {!user && startPlanningRating === 10 && <SignInCard onMount={scrollToBottom} />}

          {user &&
            (appSummary?.features?.[0]?.status === AppFeatureStatus.Implemented ||
              appSummary?.features?.[0]?.status === AppFeatureStatus.ValidationFailed ||
              appSummary?.features?.[0]?.status === AppFeatureStatus.ValidationInProgress ||
              appSummary?.features?.[0]?.status === AppFeatureStatus.Validated ||
              startPlanningRating === 10) &&
            peanutsRemaining !== undefined &&
            peanutsRemaining <= 0 &&
            hasSubscription && <AddPeanutsCard onMount={scrollToBottom} />}

          {user &&
            (appSummary?.features?.[0]?.status === AppFeatureStatus.Implemented ||
              appSummary?.features?.[0]?.status === AppFeatureStatus.ValidationFailed ||
              appSummary?.features?.[0]?.status === AppFeatureStatus.ValidationInProgress ||
              appSummary?.features?.[0]?.status === AppFeatureStatus.Validated ||
              startPlanningRating === 10) &&
            peanutsRemaining !== undefined &&
            peanutsRemaining <= 0 &&
            !hasSubscription && <SubscriptionCard onMount={scrollToBottom} />}

          {listenResponses && appSummary?.features?.length && !isFullyComplete && (
            <StopBuildCard onMount={scrollToBottom} />
          )}

          {!hasPendingMessage &&
            !listenResponses &&
            appSummary?.features?.length &&
            !isFullyComplete &&
            peanutsRemaining !== undefined &&
            peanutsRemaining > 0 && <ContinueBuildCard onMount={scrollToBottom} sendMessage={sendMessage} />}

          {user && startPlanningRating === 10 && peanutsRemaining !== undefined && peanutsRemaining > 0 && (
            <StartBuildingCard
              startPlanningRating={startPlanningRating}
              sendMessage={sendMessage}
              onMount={scrollToBottom}
            />
          )}

          {hasPendingMessage && (
            <div className="w-full mt-3">
              <div className="flex gap-4 pl-6">
                <div className="flex items-center gap-3 text-bolt-elements-textSecondary py-2">
                  <div className="flex gap-1">
                    <div
                      className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"
                      style={{ animationDelay: '0ms' }}
                    ></div>
                    <div
                      className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"
                      style={{ animationDelay: '150ms' }}
                    ></div>
                    <div
                      className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"
                      style={{ animationDelay: '300ms' }}
                    ></div>
                  </div>
                  {pendingMessageStatus && (
                    <span className="text-sm font-medium opacity-60">{pendingMessageStatus}...</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        <JumpToBottom visible={showJumpToBottom} onClick={scrollToBottom} />
      </div>
    );
  },
);

function isActiveDiscoveryResponse(messages: Message[], message: Message) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].category === DISCOVERY_RESPONSE_CATEGORY) {
      return message.id === messages[i].id;
    }
    if (messages[i].category != DISCOVERY_RATING_CATEGORY) {
      return false;
    }
  }
  return false;
}

function hasInteracted(message: Message): boolean {
  return message.type === 'text' && message.hasInteracted === true;
}
