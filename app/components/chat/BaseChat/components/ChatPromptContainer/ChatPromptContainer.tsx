import React from 'react';
import { classNames } from '~/utils/classNames';
import FilePreview from '~/components/chat/FilePreview';
import { ScreenshotStateManager } from '~/components/chat/ScreenshotStateManager';
import { ClientOnly } from 'remix-utils/client-only';

import { MessageInput } from '~/components/chat/MessageInput/MessageInput';
import { isAppOwnerStore, permissionsStore } from '~/lib/stores/permissions';
import { useStore } from '@nanostores/react';
import { AppAccessKind, isAppAccessAllowed } from '~/lib/api/permissions';
import { userStore } from '~/lib/stores/auth';

interface ChatPromptContainerProps {
  uploadedFiles: File[];
  setUploadedFiles: (files: File[]) => void;
  imageDataList: string[];
  setImageDataList: (dataList: string[]) => void;
  messageInputProps: Partial<React.ComponentProps<typeof MessageInput>>;
}

export const ChatPromptContainer: React.FC<ChatPromptContainerProps> = ({
  uploadedFiles,
  setUploadedFiles,
  imageDataList,
  setImageDataList,
  messageInputProps,
}) => {
  const permissions = useStore(permissionsStore);
  const isAppOwner = useStore(isAppOwnerStore);
  const user = useStore(userStore);

  if (
    permissions.length > 0 &&
    !isAppAccessAllowed(permissions, AppAccessKind.SendMessage, user?.email ?? '', isAppOwner)
  ) {
    return null;
  }

  return (
    <div
      className={classNames(
        'relative w-full max-w-chat mx-auto z-prompt mt-0 rounded-md',
        'shadow-md hover:shadow-lg transition-shadow duration-200',
      )}
    >
      <FilePreview
        files={uploadedFiles}
        imageDataList={imageDataList}
        onRemove={(index) => {
          setUploadedFiles(uploadedFiles.filter((_, i) => i !== index));
          setImageDataList(imageDataList.filter((_, i) => i !== index));
        }}
      />
      <ClientOnly>
        {() => (
          <ScreenshotStateManager
            setUploadedFiles={setUploadedFiles}
            setImageDataList={setImageDataList}
            uploadedFiles={uploadedFiles}
            imageDataList={imageDataList}
          />
        )}
      </ClientOnly>
      <MessageInput {...messageInputProps} />
    </div>
  );
};
