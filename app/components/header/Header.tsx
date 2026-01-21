import { useStore } from '@nanostores/react';
import { chatStore } from '~/lib/stores/chat';
import { classNames } from '~/utils/classNames';
import { ClientAuth } from '~/components/auth/ClientAuth';
import { ChatDescription } from '~/components/panels/SettingsPanel/components/ChatDescription.client';
import useViewport from '~/lib/hooks';
import { useLocation } from '@remix-run/react';
import { PanelLeft } from 'lucide-react';
import { sidebarMenuStore } from '~/lib/stores/sidebarMenu';

export function Header() {
  const chatStarted = useStore(chatStore.started);
  const appSummary = useStore(chatStore.appSummary);
  const isSmallViewport = useViewport(800);
  const location = useLocation();

  return (
    <header
      className={classNames(
        'flex items-center justify-between px-4 py-4 border-b h-[var(--header-height)] bg-bolt-elements-background-depth-1 bg-opacity-80 transition-all duration-300 z-20',
        {
          'border-transparent shadow-none': !chatStarted,
          'border-bolt-elements-borderColor border-opacity-50 shadow-sm backdrop-blur-md': chatStarted,
        },
      )}
    >
      <div className="flex items-center gap-4 text-bolt-elements-textPrimary">
        <PanelLeft
          size={20}
          className="text-bolt-elements-textPrimary hover:text-bolt-elements-textSecondary cursor-pointer"
          onClick={() => {
            if (isSmallViewport) {
              sidebarMenuStore.open();
            }
          }}
        />
        {location.pathname === '/' && (
          <a href="/">
            <div className="flex items-center gap-3">
              <img src="/logo.svg" alt="Logo" className="w-6 h-6" />
              <h1 className="text-bolt-elements-textHeading font-bold text-xl">
                REPLAY<span className="text-rose-500">.BUILDER</span>
              </h1>
            </div>
          </a>
        )}
        {appSummary && !isSmallViewport && <ChatDescription />}
      </div>

      <div className="flex items-center gap-4">{!chatStarted && <ClientAuth />}</div>
    </header>
  );
}
