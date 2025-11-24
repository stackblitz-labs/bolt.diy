import { useRef, useState } from 'react';
import { useStore } from '@nanostores/react';
import useViewport from '~/lib/hooks';
import { userStore } from '~/lib/stores/auth';
import { workbenchStore } from '~/lib/stores/workbench';
import { useLayoutWidths } from '~/lib/hooks/useLayoutWidths';
import { classNames } from '~/utils/classNames';
import styles from '~/components/chat/BaseChat/BaseChat.module.scss';
import { IntroSection } from '~/components/chat/BaseChat/components/IntroSection/IntroSection';
import { ChatPromptContainer } from '~/components/chat/BaseChat/components/ChatPromptContainer/ChatPromptContainer';
import AppTemplates from '~/components/chat/BaseChat/components/AppTemplates/AppTemplates';
import { type MessageInputProps } from '~/components/chat/MessageInput/MessageInput';
import type { ChatMessageParams } from '~/components/chat/ChatComponent/components/ChatImplementer/ChatImplementer';
import Pricing from '~/components/landingPage/components/Pricing';
import FAQs from '~/components/landingPage/components/FAQs';
import Explanation from '~/components/landingPage/components/Explanation';

export const TEXTAREA_MIN_HEIGHT = 76;
export const TEXTAREA_MAX_HEIGHT = 200;

const LandingPage = () => {
  const isSmallViewport = useViewport(800);
  const user = useStore(userStore);
  const showWorkbench = useStore(workbenchStore.showWorkbench);
  const { chatWidth } = useLayoutWidths(!!user);
  const ref = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [imageDataList, setImageDataList] = useState<string[]>([]);

  const messageInputProps: MessageInputProps = {
    uploadedFiles,
    setUploadedFiles,
    imageDataList,
    setImageDataList,
    minHeight: TEXTAREA_MIN_HEIGHT,
    maxHeight: TEXTAREA_MAX_HEIGHT,
  };

  const handleSendMessage = (params: ChatMessageParams) => {
    console.log(params);
  };

  return (
    <div ref={ref} className={classNames(styles.BaseChat, 'relative flex h-full w-full overflow-hidden')}>
      <div
        ref={scrollRef}
        className={classNames('w-full h-full flex flex-col lg:flex-row overflow-x-hidden overflow-y-auto', {
          'pt-2 pb-2 px-4': isSmallViewport,
          'pt-12 px-6 pb-16': !isSmallViewport,
        })}
      >
        <div
          className={classNames(styles.Chat, 'landing-page-layout flex flex-col min-h-full flex-shrink-0', {
            'flex-grow': isSmallViewport,
            'pb-2': isSmallViewport,
          })}
          style={!isSmallViewport && showWorkbench ? { width: `${chatWidth}px` } : { width: '100%' }}
        >
          <IntroSection />
          <div className={classNames('px-2')}>
            <ChatPromptContainer
              uploadedFiles={uploadedFiles}
              setUploadedFiles={setUploadedFiles!}
              imageDataList={imageDataList}
              setImageDataList={setImageDataList!}
              messageInputProps={messageInputProps}
            />
            <Pricing />
            <Explanation />
            <AppTemplates sendMessage={handleSendMessage} />
            <FAQs />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
