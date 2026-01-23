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
import { userStore } from '~/lib/stores/auth';
import type { ChatMessageParams } from '~/components/chat/ChatComponent/components/ChatImplementer/ChatImplementer';
import { mobileNavStore } from '~/lib/stores/mobileNav';
import { useLayoutWidths } from '~/lib/hooks/useLayoutWidths';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import { type InfoCardData } from '~/components/ui/InfoCard';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '~/components/ui/resizable';
import { AppFeatureKind, AppFeatureStatus, BugReportStatus } from '~/lib/persistence/messageAppSummary';
import { openFeatureModal, openIntegrationTestsModal } from '~/lib/stores/featureModal';
import { toast } from 'react-toastify';
import { database, type AppLibraryEntry } from '~/lib/persistence/apps';
import AppTemplates from './components/AppTemplates/AppTemplates';
import { DesignSystemPanel } from '~/components/panels/DesignPanel/DesignSystemPanel';
import { DesignToolbar } from '~/components/panels/DesignPanel/DesignToolbar';
import { SettingsPanel } from '~/components/panels/SettingsPanel/SettingsPanel';
import { HistoryPanel } from '~/components/panels/HistoryPanel/HistoryPanel';
import { ChatPanel } from '~/components/panels/ChatPanel';
import SideBar from '~/components/sidebar/side-bar.client';
import { sidebarPanelStore } from '~/lib/stores/sidebarPanel';
import { designPanelStore } from '~/lib/stores/designSystemStore';
import { TopNav } from '~/components/chat/TopNav';

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
    const { chatWidth, chatPanelSize, setChatPanelSize, panelSizeKey } = useLayoutWidths(!!user);
    const showWorkbench = useStore(workbenchStore.showWorkbench);
    const selectedElement = useStore(workbenchStore.selectedElement);
    const repositoryId = useStore(workbenchStore.repositoryId);
    const showMobileNav = useStore(mobileNavStore.showMobileNav);
    const activePanel = useStore(sidebarPanelStore.activePanel);
    const [infoCards, setInfoCards] = useState<InfoCardData[]>([]);
    const [list, setList] = useState<AppLibraryEntry[] | undefined>(undefined);

    const loadEntries = useCallback(() => {
      database
        .getAllAppEntries()
        .then(setList)
        .catch((error) => toast.error(error.message));
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
        mobileNavStore.setActiveTab('canvas');
        hasShownWorkbench.current = true;
      }
    }, [appSummary]);

    // Sync designPanelStore.isVisible with sidebar panel state
    useEffect(() => {
      const shouldShowDesignPanel = activePanel === 'design';
      designPanelStore.isVisible.set(shouldShowDesignPanel);
    }, [activePanel]);

    useEffect(() => {
      const newCards: InfoCardData[] = [];

      // Add feature cards
      if (appSummary?.features) {
        // Create filtered features array for modal
        const filteredFeatures = appSummary.features.filter((f) => f.kind !== AppFeatureKind.DesignAPIs);

        // Separate IntegrationTests from other features
        const integrationTestsFeatures = appSummary.features.filter(
          (f) => f.status === AppFeatureStatus.ImplementationInProgress && f.kind === AppFeatureKind.IntegrationTests,
        );

        const otherFeatures = appSummary.features.filter(
          (f) =>
            f.status === AppFeatureStatus.ImplementationInProgress &&
            f.kind !== AppFeatureKind.FixBug &&
            f.kind !== AppFeatureKind.IntegrationTests,
        );

        // Add non-IntegrationTests feature cards
        const featureCards = otherFeatures.map((feature) => {
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

        // Add grouped IntegrationTests card if there are any
        if (integrationTestsFeatures.length > 0) {
          const description = `${integrationTestsFeatures.length} integration test${integrationTestsFeatures.length !== 1 ? 's' : ''} in progress`;

          newCards.push({
            id: 'integration-tests-group',
            title: 'Integration Tests',
            description,
            iconType: 'loading',
            variant: 'active',
            handleSendMessage,
            onCardClick: () => {
              openIntegrationTestsModal('in-progress');
            },
          });
        }
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

        if (window.analytics) {
          if (messages.length === 0) {
            window.analytics.track('Created a new chat');
          } else {
            window.analytics.track('Sent a chat message');
          }
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

    const themeChanges = useStore(designPanelStore.themeChanges);

    // Render the appropriate panel based on activePanel
    const renderActivePanel = () => {
      switch (activePanel) {
        case 'design':
          return (
            <>
              <DesignSystemPanel />
              {themeChanges.hasChanges && <DesignToolbar />}
            </>
          );
        case 'settings':
          return <SettingsPanel />;
        case 'history':
          return <HistoryPanel />;
        case 'chat':
        default:
          return (
            <div
              className={classNames('h-full flex flex-col', {
                'px-2': isSmallViewport,
              })}
            >
              <ChatPanel
                messageRef={messageRef}
                uploadedFiles={uploadedFiles}
                setUploadedFiles={setUploadedFiles!}
                imageDataList={imageDataList}
                setImageDataList={setImageDataList!}
                messageInputProps={messageInputProps}
                infoCards={infoCards}
                handleSendMessage={handleSendMessage}
                onLastMessageCheckboxChange={onLastMessageCheckboxChange}
                list={list}
              />
            </div>
          );
      }
    };

    const baseChat = (
      <div
        ref={ref}
        className={classNames(styles.BaseChat, 'relative flex h-full w-full overflow-hidden')}
        data-chat-visible={showChat}
      >
        {!chatStarted && <ClientOnly>{() => <Menu />}</ClientOnly>}
        {user && !isSmallViewport && chatStarted && <ClientOnly>{() => <SideBar />}</ClientOnly>}
        {chatStarted && !isSmallViewport && showWorkbench ? (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            <TopNav />
            <div className="flex-1 flex flex-col h-full overflow-hidden pr-2 pb-2">
              <ResizablePanelGroup
                key={panelSizeKey}
                direction="horizontal"
                className="w-full flex-1 border rounded-md border-bolt-elements-borderColor bg-background"
                onLayout={(sizes) => {
                  if (sizes[0] !== undefined) {
                    setChatPanelSize(sizes[0]);
                  }
                }}
              >
                <ResizablePanel defaultSize={chatPanelSize} minSize={20} maxSize={60} className="h-full">
                  <div ref={scrollRef} className="w-full h-full flex flex-col overflow-x-hidden overflow-y-hidden p-2">
                    <div className={classNames(styles.Chat, 'flex flex-col h-full w-full')}>
                      <div className="h-full flex flex-col">
                        <ClientOnly>{() => renderActivePanel()}</ClientOnly>
                      </div>
                    </div>
                  </div>
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={100 - chatPanelSize} minSize={30} className="h-full">
                  <ClientOnly>{() => <Workbench chatStarted={chatStarted} isResizable />}</ClientOnly>
                </ResizablePanel>
              </ResizablePanelGroup>
            </div>
          </div>
        ) : chatStarted && isSmallViewport ? (
          /* Mobile view when chat started */
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            <TopNav />
            <div ref={scrollRef} className="flex-1 flex flex-col overflow-x-hidden overflow-y-auto pb-20">
              <ClientOnly>
                {() => {
                  // On mobile, show workbench when canvas tab is active
                  if (showWorkbench) {
                    return <Workbench chatStarted={chatStarted} />;
                  }
                  return renderActivePanel();
                }}
              </ClientOnly>
            </div>
          </div>
        ) : (
          /* Landing page or desktop without workbench */
          <div
            ref={scrollRef}
            className={classNames('w-full h-full flex flex-col lg:flex-row overflow-x-hidden', {
              'overflow-y-auto': !chatStarted,
              'overflow-y-hidden': chatStarted,
              'pt-2 pb-2 px-4': isSmallViewport && !appSummary && !showMobileNav,
              'pt-2 pb-16 px-4': isSmallViewport && (!!appSummary || showMobileNav),
              'p-6': !isSmallViewport && chatStarted,
              'pt-12 px-2 pb-16': !isSmallViewport && !chatStarted,
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
              {chatStarted && appSummary && <TopNav />}
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
                    if (!chatStarted) {
                      return null;
                    }

                    return renderActivePanel();
                  }}
                </ClientOnly>
                {!chatStarted && (
                  <ChatPromptContainer
                    uploadedFiles={uploadedFiles}
                    setUploadedFiles={setUploadedFiles!}
                    imageDataList={imageDataList}
                    setImageDataList={setImageDataList!}
                    messageInputProps={messageInputProps}
                  />
                )}
                {!chatStarted && <AppTemplates sendMessage={handleSendMessage} />}
              </div>
            </div>
            <ClientOnly>{() => <Workbench chatStarted={chatStarted} />}</ClientOnly>
          </div>
        )}
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
