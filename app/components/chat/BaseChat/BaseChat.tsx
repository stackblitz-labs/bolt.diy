/*
 * @ts-nocheck
 * Preventing TS checks with files presented in the video for a better presentation.
 */
import React, { type RefCallback, useCallback, useEffect, useRef, useState } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { Menu } from '~/components/sidebar/Menu.client';
import { Workbench } from '~/components/workbench/Workbench.client';
import { MobileNav } from '~/components/mobile-nav/MobileNav.client';
import { classNames } from '~/utils/classNames';
import { Messages } from '~/components/chat/Messages/Messages.client';
import { IntroSection } from '~/components/chat/BaseChat/components/IntroSection/IntroSection';
import { ChatPromptContainer } from '~/components/chat/BaseChat/components/ChatPromptContainer/ChatPromptContainer';
import { useSpeechRecognition } from '~/hooks/useSpeechRecognition';
import styles from './BaseChat.module.scss';
import { type MessageInputProps } from '~/components/chat/MessageInput/MessageInput';
import { ChatMode } from '~/lib/replay/SendChatMessage';
import { DISCOVERY_RESPONSE_CATEGORY } from '~/lib/persistence/message';
import { workbenchStore } from '~/lib/stores/workbench';
import { useStore } from '@nanostores/react';
import useViewport from '~/lib/hooks';
import { chatStore } from '~/lib/stores/chat';
import { userStore, isLoadingStore } from '~/lib/stores/auth';
import type { ChatMessageParams } from '~/components/chat/ChatComponent/components/ChatImplementer/ChatImplementer';
import { mobileNavStore } from '~/lib/stores/mobileNav';
import { useLayoutWidths } from '~/lib/hooks/useLayoutWidths';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import { StackedInfoCard, type InfoCardData } from '~/components/ui/InfoCard';
import { AppFeatureKind, AppFeatureStatus, BugReportStatus } from '~/lib/persistence/messageAppSummary';
import { openFeatureModal } from '~/lib/stores/featureModal';
import { subscriptionStore } from '~/lib/stores/subscriptionStatus';
import { toast } from 'react-toastify';
import { database, type AppLibraryEntry } from '~/lib/persistence/apps';
import { PlanUpgradeBlock } from './components/PlanUpgradeBlock';
import AppTemplates from './components/AppTemplates/AppTemplates';
import Pricing from '~/components/landingPage/components/Pricing';
import FAQs from '~/components/landingPage/components/FAQs';
import Explanation from '~/components/landingPage/components/Explanation';

export const TEXTAREA_MIN_HEIGHT = 76;

interface BaseChatProps {
  textareaRef?: React.RefObject<HTMLTextAreaElement>;
  messageRef?: RefCallback<HTMLDivElement>;
  scrollRef?: RefCallback<HTMLDivElement>;
  showChat?: boolean;
  chatStarted?: boolean;
  input?: string;
  handleStop?: () => void;
  sendMessage?: (params: ChatMessageParams) => void;
  handleInputChange?: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  uploadedFiles?: File[];
  setUploadedFiles?: (files: File[]) => void;
  imageDataList?: string[];
  setImageDataList?: (dataList: string[]) => void;
}

export const BaseChat = React.forwardRef<HTMLDivElement, BaseChatProps>(
  (
    {
      textareaRef,
      messageRef,
      scrollRef,
      showChat = true,
      chatStarted = false,
      input = '',
      handleInputChange,
      sendMessage,
      handleStop,
      uploadedFiles = [],
      setUploadedFiles,
      imageDataList = [],
      setImageDataList,
    },
    ref,
  ) => {
    const appSummary = useStore(chatStore.appSummary);
    const TEXTAREA_MAX_HEIGHT = chatStarted ? 300 : 200;
    const isSmallViewport = useViewport(800);
    const user = useStore(userStore);
    const isAuthLoading = useStore(isLoadingStore);
    const { chatWidth } = useLayoutWidths(!!user);
    const showWorkbench = useStore(workbenchStore.showWorkbench);
    const selectedElement = useStore(workbenchStore.selectedElement);
    const repositoryId = useStore(workbenchStore.repositoryId);
    const showMobileNav = useStore(mobileNavStore.showMobileNav);
    const [infoCards, setInfoCards] = useState<InfoCardData[]>([]);
    const stripeSubscription = useStore(subscriptionStore.subscription);
    const isSubscriptionStoreLoaded = useStore(subscriptionStore.isLoaded);
    const [list, setList] = useState<AppLibraryEntry[] | undefined>(undefined);
    const [isLoadingList, setIsLoadingList] = useState(true);

    const loadEntries = useCallback(() => {
      setIsLoadingList(true);
      database
        .getAllAppEntries()
        .then(setList)
        .catch((error) => toast.error(error.message))
        .finally(() => setIsLoadingList(false));
    }, []);

    useEffect(() => {
      loadEntries();
    }, [loadEntries, user]);

    const onTranscriptChange = useCallback(
      (transcript: string) => {
        if (handleInputChange) {
          const syntheticEvent = {
            target: { value: transcript },
          } as React.ChangeEvent<HTMLTextAreaElement>;
          handleInputChange(syntheticEvent);
        }
      },
      [handleInputChange],
    );

    const { isListening, startListening, stopListening, abortListening } = useSpeechRecognition({
      onTranscriptChange,
    });

    const hasShownWorkbench = useRef(false);

    useEffect(() => {
      if (appSummary && !showWorkbench && !hasShownWorkbench.current) {
        workbenchStore.setShowWorkbench(true);
        mobileNavStore.setActiveTab('preview');
        hasShownWorkbench.current = true;
      }
    }, [appSummary]);

    useEffect(() => {
      const newCards: InfoCardData[] = [];

      // Add feature cards
      if (appSummary?.features) {
        // Create filtered features array for modal
        const filteredFeatures = appSummary.features.filter((f) => f.kind !== AppFeatureKind.DesignAPIs);

        const featureCards = appSummary.features
          .filter((f) => f.status === AppFeatureStatus.ImplementationInProgress && f.kind !== AppFeatureKind.FixBug)
          .map((feature) => {
            const iconType: 'loading' | 'error' | 'success' =
              feature.status === AppFeatureStatus.ImplementationInProgress
                ? 'loading'
                : feature.status === AppFeatureStatus.Failed
                  ? 'error'
                  : 'success';

            const variant: 'active' | 'default' =
              feature.status === AppFeatureStatus.ImplementationInProgress ? 'active' : 'default';

            // Find the index of this feature in the filtered array
            const modalIndex = filteredFeatures.findIndex((f) => f === feature);

            return {
              id: feature.name,
              title: feature.name,
              description: feature.description,
              iconType,
              variant,
              handleSendMessage,
              onCardClick:
                modalIndex !== -1
                  ? () => {
                      openFeatureModal(modalIndex, filteredFeatures.length);
                    }
                  : undefined,
            };
          });

        newCards.push(...featureCards);
      }

      // Add bug report cards
      const bugReportCards = (
        appSummary?.bugReports?.filter(
          (a) => a.status !== BugReportStatus.Resolved && a.status !== BugReportStatus.Canceled,
        ) ?? []
      ).map((report) => {
        const filteredFeatures = appSummary?.features?.filter((f) => f.kind !== AppFeatureKind.DesignAPIs);

        const featureIndex = filteredFeatures?.findIndex((f) => f.name === report.name);

        return {
          id: report.name,
          bugReport: report,
          handleSendMessage,
          onCardClick:
            featureIndex !== undefined && featureIndex !== -1
              ? () => {
                  openFeatureModal(featureIndex, filteredFeatures?.length ?? 0);
                }
              : undefined,
        };
      });

      newCards.push(...bugReportCards);

      setInfoCards(newCards);
    }, [appSummary]);

    const getComponentReference = useCallback(() => {
      if (!selectedElement?.tree?.length) {
        return undefined;
      }

      return {
        componentNames: selectedElement.tree.map((component) => component.displayName || 'Anonymous'),
      };
    }, [selectedElement]);

    const handleSendMessage = useCallback(
      (params: ChatMessageParams) => {
        if (!sendMessage) {
          return;
        }

        const componentReference = params.componentReference ?? getComponentReference();
        const sessionRepositoryId = params.sessionRepositoryId ?? repositoryId;

        // Mark discovery messages as interacted when user sends a response
        const messages = chatStore.messages.get();
        const updatedMessages = messages.map((message) => {
          if (message.category === DISCOVERY_RESPONSE_CATEGORY && !message.hasInteracted) {
            return { ...message, hasInteracted: true };
          }
          return message;
        });
        chatStore.messages.set(updatedMessages);

        const payload: ChatMessageParams = {
          ...params,
          componentReference,
        };

        if (sessionRepositoryId) {
          payload.sessionRepositoryId = sessionRepositoryId;
        }

        sendMessage(payload);
        abortListening();

        if (window.analytics && messages.length === 0) {
          window.analytics.track('Created a new chat', {
            timestamp: new Date().toISOString(),
            userId: user?.id,
            email: user?.email,
          });
        }

        if (handleInputChange) {
          const syntheticEvent = {
            target: { value: '' },
          } as React.ChangeEvent<HTMLTextAreaElement>;
          handleInputChange(syntheticEvent);
        }
      },
      [sendMessage, getComponentReference, repositoryId, abortListening, user, handleInputChange],
    );

    // Listen for continue building events from the global status modal
    useEffect(() => {
      const handleContinueBuildingEvent = () => {
        handleSendMessage({ chatMode: ChatMode.DevelopApp });
      };

      window.addEventListener('continueBuilding', handleContinueBuildingEvent);
      return () => {
        window.removeEventListener('continueBuilding', handleContinueBuildingEvent);
      };
    }, [handleSendMessage]);

    const onLastMessageCheckboxChange = (checkboxText: string, checked: boolean) => {
      const newMessages = chatStore.messages.get().map((message) => {
        const oldBox = checked ? `[ ]` : `[x]`;
        const newBox = checked ? `[x]` : `[ ]`;
        const lines = message.content.split('\n');
        const matchingLineIndex = lines.findIndex(
          (line) => line.includes(oldBox) && lineIncludesNoMarkdown(line, checkboxText),
        );
        if (matchingLineIndex >= 0) {
          lines[matchingLineIndex] = lines[matchingLineIndex].replace(oldBox, newBox);
          return {
            ...message,
            content: lines.join('\n').trim(),
          };
        }
        return message;
      });
      chatStore.messages.set(newMessages);
    };

    const messageInputProps: MessageInputProps = {
      textareaRef,
      input,
      handleInputChange,
      handleSendMessage,
      handleStop,
      uploadedFiles,
      setUploadedFiles,
      imageDataList,
      setImageDataList,
      isListening,
      onStartListening: startListening,
      onStopListening: stopListening,
      minHeight: TEXTAREA_MIN_HEIGHT,
      maxHeight: TEXTAREA_MAX_HEIGHT,
    };

    const baseChat = (
      <div
        ref={ref}
        className={classNames(styles.BaseChat, 'relative flex h-full w-full overflow-hidden', {
          'max-w-[1337px] mx-auto': !chatStarted,
        })}
        data-chat-visible={showChat}
      >
        {user && <ClientOnly>{() => <Menu />}</ClientOnly>}
        <div
          ref={scrollRef}
          className={classNames('w-full h-full flex flex-col lg:flex-row overflow-x-hidden', {
            'overflow-y-auto': !chatStarted,
            'overflow-y-hidden': chatStarted,
            'pt-2 pb-2 px-4': isSmallViewport && !appSummary && !showMobileNav,
            'pt-2 pb-16 px-4': isSmallViewport && (!!appSummary || showMobileNav),
            'p-6': !isSmallViewport && chatStarted,
            'pt-12 px-6 pb-16': !isSmallViewport && !chatStarted,
          })}
        >
          <div
            className={classNames(styles.Chat, 'flex flex-col', {
              'h-full': chatStarted,
              'min-h-full': !chatStarted,
              'flex-grow': isSmallViewport,
              'flex-shrink-0': !isSmallViewport,
              'pb-2': isSmallViewport,
              'landing-page-layout': !chatStarted,
            })}
            style={!isSmallViewport && showWorkbench ? { width: `${chatWidth}px` } : { width: '100%' }}
          >
            {!chatStarted && (
              <>
                <IntroSection />
              </>
            )}
            <div
              className={classNames({
                'pr-4': !isSmallViewport && showWorkbench,
                'h-full flex flex-col': chatStarted,
                'px-2': !isSmallViewport,
              })}
            >
              <ClientOnly>
                {() => {
                  return chatStarted ? (
                    <>
                      <Messages
                        ref={messageRef}
                        onLastMessageCheckboxChange={onLastMessageCheckboxChange}
                        sendMessage={handleSendMessage}
                        list={list}
                      />
                      {infoCards && infoCards.length > 0 && (
                        <div className="flex justify-center">
                          <div style={{ width: 'calc(min(100%, var(--chat-max-width, 37rem)))' }}>
                            <StackedInfoCard
                              cards={infoCards}
                              className="w-full mb-2"
                              handleSendMessage={handleSendMessage}
                            />
                          </div>
                        </div>
                      )}
                    </>
                  ) : null;
                }}
              </ClientOnly>
              {(() => {
                const isLoadingData = isAuthLoading || (user && !isSubscriptionStoreLoaded) || isLoadingList;

                if (isLoadingData && !chatStarted) {
                  return (
                    <div className="flex items-center justify-center min-h-[176.5px]">
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-8 h-8 border-2 border-bolt-elements-borderColor border-t-bolt-elements-textPrimary rounded-full animate-spin"></div>
                        <p className="text-sm text-bolt-elements-textSecondary">Loading...</p>
                      </div>
                    </div>
                  );
                }

                const hasNoPaidPlan = !stripeSubscription || stripeSubscription.tier === 'free';

                const shouldShowUpgradeBlock = user && hasNoPaidPlan && list && list.length > 0 && !chatStarted;

                return shouldShowUpgradeBlock ? (
                  <PlanUpgradeBlock />
                ) : (
                  <>
                    <ChatPromptContainer
                      uploadedFiles={uploadedFiles}
                      setUploadedFiles={setUploadedFiles!}
                      imageDataList={imageDataList}
                      setImageDataList={setImageDataList!}
                      messageInputProps={messageInputProps}
                    />
                  </>
                );
              })()}
              {!user && !chatStarted && <Pricing />}
              {!user && !chatStarted && <Explanation />}
              {!chatStarted && <AppTemplates sendMessage={handleSendMessage} />}
              {!user && !chatStarted && <FAQs />}
            </div>
          </div>
          <ClientOnly>{() => <Workbench chatStarted={chatStarted} />}</ClientOnly>
        </div>
        {isSmallViewport && (appSummary || showMobileNav) && <ClientOnly>{() => <MobileNav />}</ClientOnly>}
      </div>
    );

    return <TooltipProvider delayDuration={200}>{baseChat}</TooltipProvider>;
  },
);

function lineIncludesNoMarkdown(line: string, text: string) {
  // Remove markdown formatting characters from both strings
  const stripMarkdown = (str: string) => {
    return str
      .replace(/[*_`~]/g, '') // Remove asterisks, underscores, backticks, tildes
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // Replace markdown links with just the text
      .replace(/^#+\s*/g, '') // Remove heading markers
      .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold markers
      .replace(/\*([^*]+)\*/g, '$1') // Remove italic markers
      .replace(/`([^`]+)`/g, '$1') // Remove inline code markers
      .replace(/~~([^~]+)~~/g, '$1'); // Remove strikethrough markers
  };

  const strippedLine = stripMarkdown(line);
  const strippedText = stripMarkdown(text);

  return strippedLine.includes(strippedText);
}
