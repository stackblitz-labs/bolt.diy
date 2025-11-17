import React, { type RefCallback, useCallback, useEffect, useRef, useState } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { motion } from 'framer-motion';
import { Menu } from '~/components/sidebar/Menu.client';
import { Workbench } from '~/components/workbench/Workbench.client';
import { MobileNav } from '~/components/mobile-nav/MobileNav.client';
import { classNames } from '~/utils/classNames';
import { Messages } from '~/components/chat/Messages/Messages.client';
import { SharedChatInput } from '~/components/chat/SharedChatInput';
import { useSpeechRecognition } from '~/hooks/useSpeechRecognition';
import { ChatMode } from '~/lib/replay/SendChatMessage';
import { workbenchStore } from '~/lib/stores/workbench';
import { useStore } from '@nanostores/react';
import useViewport from '~/lib/hooks';
import { chatStore } from '~/lib/stores/chat';
import { userStore } from '~/lib/stores/auth';
import type { ChatMessageParams } from '~/components/chat/ChatComponent/components/ChatImplementer/ChatImplementer';
import { mobileNavStore } from '~/lib/stores/mobileNav';
import { useLayoutWidths } from '~/lib/hooks/useLayoutWidths';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import { StackedInfoCard, type InfoCardData } from '~/components/ui/InfoCard';
import { AppFeatureKind, AppFeatureStatus, BugReportStatus } from '~/lib/persistence/messageAppSummary';
import { openFeatureModal } from '~/lib/stores/featureModal';
import { activeSidebarTab } from '~/lib/stores/sidebarNav';
import { VerticalNav } from '~/components/sidebar/VerticalNav';
import { DesignSystemPanel, VersionHistoryPanel, AppSettingsPanel, DeployPanel } from '~/components/panels';
import type { MessageInput as MessageInputType } from '~/components/chat/MessageInput/MessageInput';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '~/components/ui/resizable';
import { AppLoadingScreen } from '~/components/ui/AppLoadingScreen';
import { useParams } from '@remix-run/react';
import { FloatingChatToolbar } from '~/components/chat/Messages/components/FloatingChatToolbar';

export const TEXTAREA_MIN_HEIGHT = 76;

interface AppPageProps {
  textareaRef?: React.RefObject<HTMLTextAreaElement>;
  messageRef?: RefCallback<HTMLDivElement>;
  scrollRef?: RefCallback<HTMLDivElement>;
  showChat?: boolean;
  isLoading?: boolean;
  input?: string;
  handleStop?: () => void;
  sendMessage?: (params: ChatMessageParams) => void;
  handleInputChange?: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  uploadedFiles?: File[];
  setUploadedFiles?: (files: File[]) => void;
  imageDataList?: string[];
  setImageDataList?: (dataList: string[]) => void;
}

export const AppPage = React.forwardRef<HTMLDivElement, AppPageProps>(
  (
    {
      textareaRef,
      messageRef,
      scrollRef,
      showChat = true,
      isLoading = false,
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
    const params = useParams();
    const appId = params.id;
    const appSummary = useStore(chatStore.appSummary);
    const isSmallViewport = useViewport(800);
    const user = useStore(userStore);
    const { chatWidth } = useLayoutWidths(!!user);
    const showWorkbench = useStore(workbenchStore.showWorkbench);
    const selectedElement = useStore(workbenchStore.selectedElement);
    const repositoryId = useStore(workbenchStore.repositoryId);
    const showMobileNav = useStore(mobileNavStore.showMobileNav);
    const [infoCards, setInfoCards] = useState<InfoCardData[]>([]);
    const activeTab = useStore(activeSidebarTab);

    // Show loading screen while data is being fetched
    if (isLoading) {
      return <AppLoadingScreen appId={appId} />;
    }

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

    const { isListening, startListening, stopListening } = useSpeechRecognition({
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
        const filteredFeatures = appSummary.features.filter(
          (f) => f.kind !== AppFeatureKind.BuildInitialApp && f.kind !== AppFeatureKind.DesignAPIs,
        );

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
      if (appSummary?.bugReports) {
        const bugReportCards = appSummary.bugReports
          .filter((bug) => bug.status === BugReportStatus.Open)
          .map((bug) => ({
            id: bug.name,
            title: `Fix: ${bug.name}`,
            description: bug.description,
            iconType: 'loading' as const,
            variant: 'active' as const,
            handleSendMessage,
          }));

        newCards.push(...bugReportCards);
      }

      setInfoCards(newCards);
    }, [appSummary]);

    const handleSendMessage = useCallback(
      (params: Partial<ChatMessageParams>) => {
        if (!sendMessage) {
          return;
        }

        const fullParams: ChatMessageParams = {
          messageInput: input,
          chatMode: params.chatMode ?? ChatMode.UserMessage,
          sessionRepositoryId: repositoryId,
          componentReference:
            selectedElement?.component?.name && repositoryId
              ? {
                  componentNames: [selectedElement.component.name],
                }
              : undefined,
          ...params,
        };

        sendMessage(fullParams);
      },
      [sendMessage, input, repositoryId, selectedElement],
    );

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

    const messageInputProps: Partial<React.ComponentProps<typeof MessageInputType>> = {
      textareaRef,
      handleSendMessage,
      handleStop,
      input,
      handleInputChange,
      uploadedFiles,
      setUploadedFiles,
      imageDataList,
      setImageDataList,
      isListening,
      onStartListening: startListening,
      onStopListening: stopListening,
    };

    // Render panel content based on active tab
    const renderPanelContent = () => {
      if (activeTab === 'design-system') {
        return <DesignSystemPanel />;
      }
      if (activeTab === 'version-history') {
        return <VersionHistoryPanel />;
      }
      if (activeTab === 'app-settings') {
        return <AppSettingsPanel />;
      }
      if (activeTab === 'deploy') {
        return <DeployPanel />;
      }
      // Default to chat view
      return null;
    };

    const showChatPanel = activeTab === 'chat';

    const renderChatPanel = () => (
      <motion.div
        layoutId="chat-panel"
        className={classNames('flex flex-col h-full', {
          'flex-1': isSmallViewport || showWorkbench,
          'flex-grow': isSmallViewport,
          'flex-shrink-0': !isSmallViewport && !showWorkbench,
          'pb-2': isSmallViewport,
          'bg-bolt-elements-background-depth-1 rounded-xl border border-bolt-elements-borderColor shadow-lg overflow-hidden':
            !isSmallViewport && !showWorkbench,
        })}
        style={!isSmallViewport && !showWorkbench ? { width: `${chatWidth}px` } : undefined}
      >
        <div
          className={classNames({
            'h-full flex flex-col': true,
          })}
        >
          <ClientOnly>{() => <FloatingChatToolbar />}</ClientOnly>
          <ClientOnly>
            {() => {
              return (
                <>
                  {!isLoading && (
                    <>
                      <motion.div layoutId="messages-container" className="flex-1 relative">
                        <Messages
                          ref={messageRef}
                          onLastMessageCheckboxChange={onLastMessageCheckboxChange}
                          sendMessage={handleSendMessage}
                        />
                        {infoCards && infoCards.length > 0 && (
                          <div className="sticky bottom-0 flex justify-center py-2 bg-gradient-to-t from-bolt-elements-background-depth-1 via-bolt-elements-background-depth-1 to-transparent pt-8 z-10">
                            <div style={{ width: 'calc(min(100%, var(--chat-max-width, 37rem)))' }}>
                              <StackedInfoCard
                                cards={infoCards}
                                className="w-full mb-2"
                                handleSendMessage={handleSendMessage}
                              />
                            </div>
                          </div>
                        )}
                      </motion.div>
                    </>
                  )}
                </>
              );
            }}
          </ClientOnly>
          <SharedChatInput
            uploadedFiles={uploadedFiles}
            setUploadedFiles={setUploadedFiles!}
            imageDataList={imageDataList}
            setImageDataList={setImageDataList!}
            messageInputProps={messageInputProps}
            layoutId="chat-input"
          />
        </div>
      </motion.div>
    );

    const renderTabbedPanel = () => (
      <div
        className={classNames('flex h-full flex-1 overflow-hidden', {
          'bg-bolt-elements-background-depth-1 rounded-xl border border-bolt-elements-borderColor shadow-lg':
            !isSmallViewport && !showWorkbench,
        })}
      >
        {renderPanelContent()}
      </div>
    );

    const renderPrimaryPanel = () => (showChatPanel ? renderChatPanel() : renderTabbedPanel());

    const appPage = (
      <motion.div
        ref={ref}
        className="relative flex h-full w-full overflow-hidden bg-bolt-elements-background-depth-1 transition-colors duration-300"
        data-chat-visible={showChat}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {user && <ClientOnly>{() => <Menu />}</ClientOnly>}
        <ClientOnly>{() => <VerticalNav />}</ClientOnly>
        <div
          ref={scrollRef}
          className={classNames('w-full h-full flex flex-col lg:flex-row overflow-hidden py-2', {
            'px-4': isSmallViewport && !appSummary && !showMobileNav && !showWorkbench,
            'px-4 py-2': isSmallViewport && (!!appSummary || showMobileNav) && !showWorkbench,
          })}
        >
          {isSmallViewport ? (
            <>
              {renderPrimaryPanel()}
              <ClientOnly>{() => <Workbench chatStarted={!!appSummary} />}</ClientOnly>
            </>
          ) : showWorkbench ? (
            <ClientOnly>
              {() => (
                <ResizablePanelGroup
                  direction="horizontal"
                  className="flex h-full w-full items-stretch"
                  autoSaveId="app-preview-layout"
                >
                  <ResizablePanel defaultSize={showChatPanel ? 45 : 35} minSize={25} maxSize={35} className="flex">
                    <div className="w-full h-full bg-bolt-elements-background-depth-1 rounded-xl border border-bolt-elements-borderColor shadow-lg overflow-hidden">
                      {renderPrimaryPanel()}
                    </div>
                  </ResizablePanel>
                  <ResizableHandle />
                  <ResizablePanel defaultSize={showChatPanel ? 55 : 65} minSize={25} className="flex pr-2">
                    <Workbench chatStarted={!!appSummary} layout="embedded" />
                  </ResizablePanel>
                </ResizablePanelGroup>
              )}
            </ClientOnly>
          ) : (
            renderPrimaryPanel()
          )}
        </div>
        {isSmallViewport && (appSummary || showMobileNav) && <ClientOnly>{() => <MobileNav />}</ClientOnly>}
      </motion.div>
    );

    return <TooltipProvider delayDuration={200}>{appPage}</TooltipProvider>;
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
      .trim();
  };

  const strippedLine = stripMarkdown(line);
  const strippedText = stripMarkdown(text);

  return strippedLine.includes(strippedText);
}
