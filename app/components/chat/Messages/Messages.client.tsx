import React, { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { classNames } from '~/utils/classNames';
import {
  type Message,
  DISCOVERY_RESPONSE_CATEGORY,
  DISCOVERY_RATING_CATEGORY,
  getDiscoveryRating,
} from '~/lib/persistence/message';
import { User } from '~/components/ui/Icon';
import {
  MessageContents,
  JumpToBottom,
  StartBuildingCard,
  SignInCard,
  StopBuildCard,
  ContinueBuildCard,
} from './components';
import {
  APP_SUMMARY_CATEGORY,
  AppFeatureKind,
  AppFeatureStatus,
  isFeatureStatusImplemented,
  type AppFeature,
} from '~/lib/persistence/messageAppSummary';
import { USER_RESPONSE_CATEGORY } from '~/lib/persistence/message';
import { useStore } from '@nanostores/react';
import { chatStore } from '~/lib/stores/chat';
import { pendingMessageStatusStore } from '~/lib/stores/status';
import { userStore } from '~/lib/stores/auth';
import { shouldDisplayMessage } from '~/lib/replay/SendChatMessage';
import type { ChatMessageParams } from '~/components/chat/ChatComponent/components/ChatImplementer/ChatImplementer';
import { subscriptionStore } from '~/lib/stores/subscriptionStatus';
import { openFeatureModal, openIntegrationTestsModal } from '~/lib/stores/featureModal';
import { InfoCard } from '~/components/ui/InfoCard';
import type { AppLibraryEntry } from '~/lib/persistence/apps';

interface MessagesProps {
  id?: string;
  className?: string;
  onLastMessageCheckboxChange?: (contents: string, checked: boolean) => void;
  sendMessage: (params: ChatMessageParams) => void;
  list?: AppLibraryEntry[] | undefined;
}

export const Messages = React.forwardRef<HTMLDivElement, MessagesProps>(
  ({ onLastMessageCheckboxChange, sendMessage, list }, ref) => {
    const [showJumpToBottom, setShowJumpToBottom] = useState(false);
    const [showContinueBuildCard, setShowContinueBuildCard] = useState(false);
    const user = useStore(userStore);
    const appSummary = useStore(chatStore.appSummary);
    const listenResponses = useStore(chatStore.listenResponses);
    const [showTopShadow, setShowTopShadow] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const messages = useStore(chatStore.messages);
    const hasPendingMessage = useStore(chatStore.hasPendingMessage);
    const pendingMessageStatus = useStore(pendingMessageStatusStore);
    const hasAppSummary = !!useStore(chatStore.appSummary);
    const completedFeatures = appSummary?.features?.filter((f) => isFeatureStatusImplemented(f.status)).length;
    const totalFeatures = appSummary?.features?.length;
    const isFullyComplete = completedFeatures === totalFeatures && totalFeatures && totalFeatures > 0;
    const subscription = useStore(subscriptionStore.subscription);

    // Lazy loading state
    const [visibleItemsCount, setVisibleItemsCount] = useState(25);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const loadTriggerRef = useRef<HTMLDivElement | null>(null);
    const previousScrollHeight = useRef<number>(0);
    const hasScrolledRef = useRef(false);

    // Calculate startPlanningRating for the card display
    let startPlanningRating = 0;
    if (!hasPendingMessage && !hasAppSummary) {
      startPlanningRating = getDiscoveryRating(messages || []);
    }

    useEffect(() => {
      const shouldShow = !hasPendingMessage && !listenResponses && appSummary?.features?.length && !isFullyComplete;

      if (shouldShow) {
        const timer = setTimeout(() => {
          setShowContinueBuildCard(true);
        }, 1000); // 1 second delay

        return () => clearTimeout(timer);
      } else {
        setShowContinueBuildCard(false);
      }
    }, [hasPendingMessage, listenResponses, appSummary?.features?.length, isFullyComplete, subscription, list]);

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

      // Mark that user has scrolled
      if (scrollTop > 0) {
        hasScrolledRef.current = true;
      }

      setShowJumpToBottom(distanceFromBottom > 50);
      setShowTopShadow(scrollTop > 10);
    };

    // Load more items when scrolling to the top
    const loadMoreItems = useCallback(() => {
      if (isLoadingMore) {
        return;
      }

      setIsLoadingMore(true);

      // Store current scroll position
      if (containerRef.current) {
        previousScrollHeight.current = containerRef.current.scrollHeight;
      }

      setTimeout(() => {
        setVisibleItemsCount((prev) => prev + 25);
        setIsLoadingMore(false);
      }, 10);
    }, [isLoadingMore]);

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

    // IntersectionObserver for lazy loading
    useEffect(() => {
      const trigger = loadTriggerRef.current;
      const container = containerRef.current;
      if (!trigger || !container) {
        return;
      }

      const observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          // Only load more if:
          // 1. Element is intersecting
          // 2. Not already loading
          // 3. User has scrolled (prevents immediate trigger on mount)
          // 4. Container is actually scrollable and scrolled up
          if (entry.isIntersecting && !isLoadingMore && hasScrolledRef.current && container.scrollTop > 0) {
            loadMoreItems();
          }
        },
        {
          root: container,
          rootMargin: '100px',
          threshold: 0.1,
        },
      );

      observer.observe(trigger);

      return () => {
        observer.disconnect();
      };
    }, [loadMoreItems, isLoadingMore]);

    // Maintain scroll position after loading more items
    useEffect(() => {
      if (containerRef.current && previousScrollHeight.current > 0) {
        const newScrollHeight = containerRef.current.scrollHeight;
        const scrollDiff = newScrollHeight - previousScrollHeight.current;

        if (scrollDiff > 0) {
          containerRef.current.scrollTop += scrollDiff;
          previousScrollHeight.current = 0;
        }
      }
    }, [visibleItemsCount]);

    // Handle messages count changes - reset on new chat, expand on new messages during active chat
    const previousMessagesLengthRef = useRef(messages.length);
    useEffect(() => {
      const currentLength = messages.length;
      const previousLength = previousMessagesLengthRef.current;

      // If messages dropped significantly (e.g., new chat started), reset to 25
      if (currentLength < previousLength / 2 && currentLength < 50) {
        setVisibleItemsCount(25);
        hasScrolledRef.current = false; // Reset scroll flag for new chat
      }
      // If messages increased and we're showing all current items, expand to show new ones
      else if (currentLength > previousLength && visibleItemsCount >= previousLength) {
        setVisibleItemsCount((prev) => Math.max(prev, currentLength));
      }

      previousMessagesLengthRef.current = currentLength;
    }, [messages.length, visibleItemsCount]);

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

    // Helper function to filter, deduplicate, and sort messages
    const processMessageGroup = (messageGroup: Message[]): Message[] => {
      return messageGroup
        .filter((message, index, array) => array.findIndex((m) => m.id === message.id) === index)
        .sort((a, b) => new Date(a.createTime!).getTime() - new Date(b.createTime!).getTime());
    };

    // Helper function to create timeline items from messages and features
    const createTimelineItems = () => {
      const timelineItems: Array<{
        type: 'message' | 'feature' | 'integrationTestsGroup';
        data: Message | AppFeature | AppFeature[];
        timestamp: Date;
        id: string;
      }> = [];

      // Add messages
      const displayableMessages = processMessageGroup(messages.filter(shouldDisplayMessage));
      displayableMessages.forEach((message) => {
        if (message.createTime) {
          timelineItems.push({
            type: 'message',
            data: message,
            timestamp: new Date(message.createTime),
            id: message.id,
          });
        }
      });

      // Helper to check if an IntegrationTests feature has valid test results
      // Filter out features that are "Implemented" but have no test statuses defined
      const hasValidTestResults = (feature: AppFeature): boolean => {
        if (feature.kind !== AppFeatureKind.IntegrationTests) {
          return true;
        }
        // If the feature is Implemented but all tests have no status, filter it out
        if (feature.status === AppFeatureStatus.Implemented) {
          const hasAnyTestStatus = feature.tests?.some((test) => test.status !== undefined);
          return hasAnyTestStatus === true;
        }
        return true;
      };

      // Add features
      if (appSummary?.features) {
        const integrationTests: AppFeature[] = [];
        let earliestIntegrationTestTime: Date | null = null;

        appSummary.features
          .filter((f) => f.status === AppFeatureStatus.Implemented || f.status === AppFeatureStatus.Failed)
          .forEach((feature) => {
            if (feature.time) {
              // Group IntegrationTests features
              if (feature.kind === AppFeatureKind.IntegrationTests) {
                // Only add if it has valid test results
                if (hasValidTestResults(feature)) {
                  integrationTests.push(feature);
                  const featureTime = new Date(feature.time);
                  if (!earliestIntegrationTestTime || featureTime < earliestIntegrationTestTime) {
                    earliestIntegrationTestTime = featureTime;
                  }
                }
              } else {
                // Add non-IntegrationTests features normally
                timelineItems.push({
                  type: 'feature',
                  data: feature,
                  timestamp: new Date(feature.time),
                  id: feature.name,
                });
              }
            }
          });

        // Add grouped IntegrationTests as a single timeline item
        // Position it after the BuildInitialApp completion message
        if (integrationTests.length > 0 && earliestIntegrationTestTime) {
          let integrationTestsTimestamp: Date = earliestIntegrationTestTime;

          // Find the BuildInitialApp feature to position IntegrationTestsGroup after its completion message
          const buildInitialAppFeature = appSummary.features?.find(
            (f) =>
              f.kind === AppFeatureKind.BuildInitialApp &&
              (f.status === AppFeatureStatus.Implemented || f.status === AppFeatureStatus.Failed),
          );

          if (buildInitialAppFeature?.time) {
            const buildInitialAppTime = new Date(buildInitialAppFeature.time);

            // Find the first assistant UserResponse message at or after BuildInitialApp completion
            const completionMessage = displayableMessages.find(
              (m) =>
                m.role === 'assistant' &&
                m.category === USER_RESPONSE_CATEGORY &&
                m.createTime &&
                new Date(m.createTime) >= buildInitialAppTime,
            );

            if (completionMessage?.createTime) {
              // Place IntegrationTestsGroup right after the completion message
              integrationTestsTimestamp = new Date(new Date(completionMessage.createTime).getTime() + 1);
            }
          }

          timelineItems.push({
            type: 'integrationTestsGroup',
            data: integrationTests,
            timestamp: integrationTestsTimestamp,
            id: 'integration-tests-group',
          });
        }
      }

      // Sort by timestamp
      return timelineItems.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    };

    const renderFeature = (feature: any) => {
      const iconType =
        feature.status === AppFeatureStatus.ImplementationInProgress
          ? 'loading'
          : feature.status === AppFeatureStatus.Failed
            ? 'error'
            : 'success';

      const variant = feature.status === AppFeatureStatus.ImplementationInProgress ? 'active' : 'default';

      // Find the index of this feature in the filtered array for modal
      const filteredFeatures = appSummary?.features?.filter((f) => f.kind !== AppFeatureKind.DesignAPIs) || [];
      const modalIndex = filteredFeatures.findIndex((f) => f === feature);

      return (
        <div className="mt-5">
          <InfoCard
            title={feature.name}
            description={feature.description}
            iconType={iconType}
            variant={variant}
            onCardClick={
              modalIndex !== -1
                ? () => {
                    openFeatureModal(modalIndex, filteredFeatures.length);
                  }
                : undefined
            }
            className="shadow-sm"
            handleSendMessage={sendMessage}
          />
        </div>
      );
    };

    const renderIntegrationTestsGroup = (tests: AppFeature[]) => {
      // Determine the overall status based on the tests
      const hasFailedTests = tests.some((t) => t.status === AppFeatureStatus.Failed);
      const allImplemented = tests.every((t) => t.status === AppFeatureStatus.Implemented);

      const iconType = hasFailedTests ? 'error' : allImplemented ? 'success' : 'loading';
      const variant = 'default';

      // Create a summary description
      const passedCount = tests.filter((t) => t.status === AppFeatureStatus.Implemented).length;
      const failedCount = tests.filter((t) => t.status === AppFeatureStatus.Failed).length;
      const description = `${tests.length} integration test${tests.length !== 1 ? 's' : ''} • ${passedCount} passed${failedCount > 0 ? ` • ${failedCount} failed` : ''}`;

      return (
        <div className="mt-5">
          <InfoCard
            title="Integration Tests"
            description={description}
            iconType={iconType}
            variant={variant}
            onCardClick={() => {
              openIntegrationTestsModal('completed');
            }}
            className="shadow-sm"
            handleSendMessage={sendMessage}
          />
        </div>
      );
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
              'bg-bolt-elements-messages-background border-bolt-elements-borderColor hover:border-bolt-elements-borderColor border-opacity-60':
                !isUserMessage && (!hasPendingMessage || (hasPendingMessage && !isLast)),
              // Last message when pending
              'bg-gradient-to-b from-bolt-elements-messages-background from-30% to-transparent border-bolt-elements-borderColor border-opacity-50':
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
                    <User size={18} />
                  </div>
                )}

                {/* {!isUserMessage && (
                  <div className="flex items-center justify-center w-8 h-8 bg-bolt-elements-background-depth-2 border-2 border-bolt-elements-borderColor text-bolt-elements-textPrimary rounded-full shadow-sm">
                    <div className="w-6 h-6">
                      <img src="/logo-styled.svg" alt="Replay" className="w-full h-full" />
                    </div>
                  </div>
                )} */}

                <span className={classNames('text-sm font-medium text-bolt-elements-textHeading')}>
                  {isUserMessage ? 'Me' : 'Replay'}
                </span>
              </div>

              <div className="w-full">
                <MessageContents
                  message={message}
                  messages={messages}
                  onCheckboxChange={onCheckboxChange}
                  sendMessage={sendMessage}
                />
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
            const timelineItems = createTimelineItems();
            const totalItems = timelineItems.length;
            const startIndex = Math.max(0, totalItems - visibleItemsCount);
            const visibleItems = timelineItems.slice(startIndex);
            const hasMoreToLoad = startIndex > 0;

            return (
              <>
                {hasMoreToLoad && (
                  <div ref={loadTriggerRef} className="flex items-center justify-center py-4 mb-4">
                    {isLoadingMore ? (
                      <div className="flex items-center gap-3 text-bolt-elements-textSecondary">
                        <div className="w-5 h-5 border-2 border-bolt-elements-textSecondary border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm">Loading earlier messages...</span>
                      </div>
                    ) : (
                      <div className="text-sm text-bolt-elements-textTertiary opacity-60">Scroll up to load more</div>
                    )}
                  </div>
                )}

                {visibleItems.map((item, index) => {
                  if (item.type === 'message') {
                    return renderMessage(item.data as Message, index);
                  } else if (item.type === 'feature') {
                    return renderFeature(item.data as AppFeature);
                  } else if (item.type === 'integrationTestsGroup') {
                    return renderIntegrationTestsGroup(item.data as AppFeature[]);
                  }
                  return null;
                })}
              </>
            );
          })()}

          {!user && startPlanningRating === 10 && <SignInCard onMount={scrollToBottom} />}

          {!showContinueBuildCard &&
            listenResponses &&
            !hasPendingMessage &&
            appSummary?.features?.length &&
            !isFullyComplete && <StopBuildCard onMount={scrollToBottom} />}

          {showContinueBuildCard && (
            <ContinueBuildCard
              onMount={scrollToBottom}
              sendMessage={sendMessage}
              setShowContinueBuildCard={setShowContinueBuildCard}
            />
          )}

          {user && startPlanningRating === 10 && (
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
  return message.hasInteracted === true;
}
