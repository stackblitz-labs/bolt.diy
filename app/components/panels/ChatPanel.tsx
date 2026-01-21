import React from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { Messages } from '~/components/chat/Messages/Messages.client';
import { ChatPromptContainer } from '~/components/chat/BaseChat/components/ChatPromptContainer/ChatPromptContainer';
import { StackedInfoCard, type InfoCardData } from '~/components/ui/InfoCard';
import type { MessageInputProps } from '~/components/chat/MessageInput/MessageInput';
import type { AppLibraryEntry } from '~/lib/persistence/apps';
import type { ChatMessageParams } from '~/components/chat/ChatComponent/components/ChatImplementer/ChatImplementer';

interface ChatPanelProps {
  messageRef?: React.RefCallback<HTMLDivElement>;
  uploadedFiles: File[];
  setUploadedFiles: (files: File[]) => void;
  imageDataList: string[];
  setImageDataList: (dataList: string[]) => void;
  messageInputProps: MessageInputProps;
  infoCards: InfoCardData[];
  handleSendMessage: (params: ChatMessageParams) => void;
  onLastMessageCheckboxChange: (checkboxText: string, checked: boolean) => void;
  list?: AppLibraryEntry[];
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messageRef,
  uploadedFiles,
  setUploadedFiles,
  imageDataList,
  setImageDataList,
  messageInputProps,
  infoCards,
  handleSendMessage,
  onLastMessageCheckboxChange,
  list,
}) => {
  return (
    <>
      <ClientOnly>
        {() => (
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
                  <StackedInfoCard cards={infoCards} className="w-full mb-2" handleSendMessage={handleSendMessage} />
                </div>
              </div>
            )}
          </>
        )}
      </ClientOnly>
      <ChatPromptContainer
        uploadedFiles={uploadedFiles}
        setUploadedFiles={setUploadedFiles}
        imageDataList={imageDataList}
        setImageDataList={setImageDataList}
        messageInputProps={messageInputProps}
      />
    </>
  );
};
