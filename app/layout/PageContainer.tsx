import React, { useEffect } from 'react';
import { Header } from '~/components/header/Header';
import { Footer } from '~/components/footer/Footer';
import useViewport from '~/lib/hooks/useViewport';
import { chatStore } from '~/lib/stores/chat';
import { useStore } from '@nanostores/react';
import { useIsMobile } from '~/lib/hooks/useIsMobile';

interface PageContainerProps {
  children: React.ReactNode;
}

export const PageContainer: React.FC<PageContainerProps> = ({ children }) => {
  const isSmallViewport = useViewport(800);
  const chatStarted = useStore(chatStore.started);
  const { isMobile } = useIsMobile();

  useEffect(() => {
    const setAppHeight = () => {
      document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
    };

    setAppHeight();
    window.addEventListener('resize', setAppHeight);
    window.addEventListener('orientationchange', setAppHeight);

    return () => {
      window.removeEventListener('resize', setAppHeight);
      window.removeEventListener('orientationchange', setAppHeight);
    };
  }, []);

  return (
    <div className="w-full flex flex-col bg-bolt-elements-background-depth-1 dark:bg-black app-height">
      {isMobile && !chatStarted && <Header />}
      <div className="flex-1 w-full page-content overflow-hidden">{children}</div>
      {!chatStarted && !isSmallViewport && <Footer />}
    </div>
  );
};
