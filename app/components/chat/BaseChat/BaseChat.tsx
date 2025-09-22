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
import { ExamplePrompts } from '~/components/chat/ExamplePrompts';
import { type MessageInputProps } from '~/components/chat/MessageInput/MessageInput';
import { ChatMode } from '~/lib/replay/SendChatMessage';
import { DISCOVERY_RESPONSE_CATEGORY } from '~/lib/persistence/message';
import { workbenchStore } from '~/lib/stores/workbench';
import { useStore } from '@nanostores/react';
import useViewport from '~/lib/hooks';
import { chatStore } from '~/lib/stores/chat';
import { userStore } from '~/lib/stores/userAuth';
import type { ChatMessageParams } from '~/components/chat/ChatComponent/components/ChatImplementer/ChatImplementer';
import { mobileNavStore } from '~/lib/stores/mobileNav';
import { useLayoutWidths } from '~/lib/hooks/useLayoutWidths';
import { TooltipProvider } from '@radix-ui/react-tooltip';

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
    const hasPendingMessage = useStore(chatStore.hasPendingMessage);
    const appSummary = useStore(chatStore.appSummary);
    const TEXTAREA_MAX_HEIGHT = chatStarted ? 300 : 200;
    const isSmallViewport = useViewport(800);
    const user = useStore(userStore.user);
    const { chatWidth } = useLayoutWidths(!!user);
    const showWorkbench = useStore(workbenchStore.showWorkbench);
    const showMobileNav = useStore(mobileNavStore.showMobileNav);

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

    const [checkedBoxes, setCheckedBoxes] = useState<string[]>([]);

    const hasShownWorkbench = useRef(false);
    useEffect(() => {
      if (appSummary && !showWorkbench && !hasShownWorkbench.current) {
        workbenchStore.setShowWorkbench(true);
        mobileNavStore.setActiveTab('preview');
        hasShownWorkbench.current = true;
      }
    }, [appSummary]);

    const handleContinueBuilding = () => {
      if (sendMessage) {
        sendMessage({ chatMode: ChatMode.DevelopApp });
      }
    };

    // Listen for continue building events from the global status modal
    useEffect(() => {
      const handleContinueBuildingEvent = () => {
        handleContinueBuilding();
      };

      window.addEventListener('continueBuilding', handleContinueBuildingEvent);
      return () => {
        window.removeEventListener('continueBuilding', handleContinueBuildingEvent);
      };
    }, [sendMessage]);

    const handleSendMessage = (params: ChatMessageParams) => {
      if (sendMessage) {
        // Mark discovery messages as interacted when user sends a response
        const messages = chatStore.messages.get();
        const updatedMessages = messages.map((message) => {
          if (message.type === 'text' && message.category === DISCOVERY_RESPONSE_CATEGORY && !message.hasInteracted) {
            return { ...message, hasInteracted: true };
          }
          return message;
        });
        chatStore.messages.set(updatedMessages);

        sendMessage(params);
        abortListening();
        setCheckedBoxes([]);
        if (window.analytics) {
          window.analytics.track('Message Sent', {
            timestamp: new Date().toISOString(),
            chatMode: params.chatMode,
          });
        }
        if (handleInputChange) {
          const syntheticEvent = {
            target: { value: '' },
          } as React.ChangeEvent<HTMLTextAreaElement>;
          handleInputChange(syntheticEvent);
        }
      }
    };

    const onLastMessageCheckboxChange = (checkboxText: string, checked: boolean) => {
      const newMessages = chatStore.messages.get().map((message) => {
        if (message.type == 'text') {
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
        }
        return message;
      });
      chatStore.messages.set(newMessages);
      if (checked) {
        setCheckedBoxes((prev) => [...prev, checkboxText]);
      } else {
        setCheckedBoxes((prev) => prev.filter((box) => box !== checkboxText));
      }
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
      checkedBoxes,
    };

    const baseChat = (
      <div
        ref={ref}
        className={classNames(styles.BaseChat, 'relative flex h-full w-full overflow-hidden')}
        data-chat-visible={showChat}
      >
        {user && <ClientOnly>{() => <Menu />}</ClientOnly>}
        <div
          ref={scrollRef}
          className={classNames('w-full h-full flex flex-col lg:flex-row overflow-hidden', {
            'overflow-y-auto': !chatStarted,
            'pt-2 pb-2 px-4': isSmallViewport && !appSummary && !showMobileNav,
            'pt-2 pb-15 px-4': isSmallViewport && (!!appSummary || showMobileNav),
            'p-6': !isSmallViewport && chatStarted,
            'p-6 pb-16': !isSmallViewport && !chatStarted,
          })}
        >
          <div
            className={classNames(styles.Chat, 'flex flex-col h-full', {
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
                    <Messages
                      ref={messageRef}
                      onLastMessageCheckboxChange={onLastMessageCheckboxChange}
                      sendMessage={sendMessage}
                    />
                  ) : null;
                }}
              </ClientOnly>
              <ChatPromptContainer
                uploadedFiles={uploadedFiles}
                setUploadedFiles={setUploadedFiles!}
                imageDataList={imageDataList}
                setImageDataList={setImageDataList!}
                messageInputProps={messageInputProps}
              />
            </div>
            {!chatStarted && (
              <>
                {ExamplePrompts((event: React.UIEvent, messageInput: string) => {
                  if (hasPendingMessage) {
                    handleStop?.();
                    return;
                  }
                  handleSendMessage({ messageInput, chatMode: ChatMode.UserMessage });
                })}
              </>
            )}
          </div>
          <ClientOnly>{() => <Workbench chatStarted={chatStarted} handleSendMessage={handleSendMessage} />}</ClientOnly>
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
