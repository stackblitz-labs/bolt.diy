import { useStore } from '@nanostores/react';
import { ClientOnly } from 'remix-utils/client-only';
import { chatStore } from '~/lib/stores/chat';
import { classNames } from '~/utils/classNames';
import { HeaderActionButtons } from './HeaderActionButtons.client';
import { ChatDescription } from '~/lib/persistence/ChatDescription.client';
import { UserMenu } from '~/components/auth/UserMenu';

import { Link } from '@remix-run/react';

export function Header() {
  const chat = useStore(chatStore);

  return (
    <header
      className={classNames(
        'fixed top-0 left-0 right-0 z-[50] bg-white/80 dark:bg-gray-950/80 backdrop-blur-md border-b border-bolt-elements-borderColor h-20 flex items-center px-6 lg:px-12',
        {
          'border-transparent': !chat.started,
          'border-bolt-elements-borderColor': chat.started,
        },
      )}
    >
      <div className="flex items-center gap-2 z-logo text-bolt-elements-textPrimary cursor-pointer">
        <a
          href="/"
          onClick={(e) => {
            // If we are already on home page, force a reload to reset the state to Landing Page
            if (window.location.pathname === '/' && !window.location.search) {
              e.preventDefault();
              window.location.reload();
            }
          }}
          className="flex items-center hover:opacity-80 transition-opacity"
        >
          <img src="/huskIT.svg" alt="HuskIT" className="w-[90px]" />
        </a>
      </div>

      {chat.started && (
        <>
          <span className="flex-1 px-4 truncate text-center text-bolt-elements-textPrimary">
            <ClientOnly>{() => <ChatDescription />}</ClientOnly>
          </span>
          <ClientOnly>
            {() => (
              <div className="mr-4">
                <HeaderActionButtons chatStarted={chat.started} />
              </div>
            )}
          </ClientOnly>
        </>
      )}

      {/* Replicating the right side of the Dashboard header */}
      <div className="flex items-center gap-3 sm:gap-4 ml-auto">
        <Link
          to="/app"
          className="bg-[#1a1b26] hover:bg-black dark:bg-white dark:hover:bg-gray-200 text-white dark:text-black px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm active:scale-95 flex items-center gap-2"
        >
          Save & Exit
        </Link>
        <div className="h-8 w-px bg-gray-200 dark:bg-gray-700 hidden sm:block mx-2" />
        <ClientOnly>
          {() => (
            <div className="">
              <UserMenu className="bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-background-depth-3 text-bolt-elements-textPrimary rounded-lg transition-colors" />
            </div>
          )}
        </ClientOnly>
      </div>
    </header>
  );
}
