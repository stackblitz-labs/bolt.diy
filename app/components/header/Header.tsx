import { useStore } from '@nanostores/react';
import { ClientOnly } from 'remix-utils/client-only';
import { chatStore } from '~/lib/stores/chat';
import { classNames } from '~/utils/classNames';
import { HeaderActionButtons } from './HeaderActionButtons.client';
import { ChatDescription } from '~/lib/persistence/ChatDescription.client';

export function Header() {
  const chat = useStore(chatStore);

  return (
    <header
      className={classNames('flex items-center px-4 border-b h-[var(--header-height)]', {
        'border-transparent': !chat.started,
        'border-bolt-elements-borderColor': chat.started,
      })}
    >
      <div className="flex items-center gap-2 z-logo text-bolt-elements-textPrimary cursor-pointer">
        <div className="i-ph:sidebar-simple-duotone text-xl" />
        <a href="/" className="flex items-center gap-2">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="brainiac-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00E5FF"/>
                <stop offset="100%" stopColor="#00B8D4"/>
              </linearGradient>
            </defs>
            <circle cx="14" cy="14" r="11" fill="none" stroke="url(#brainiac-gradient)" strokeWidth="2.5"/>
            <path d="M10 14 L14 10 L18 14 M14 10 L14 18" stroke="url(#brainiac-gradient)" strokeWidth="2" fill="none"/>
            <circle cx="10" cy="14" r="1.5" fill="#00E5FF"/>
            <circle cx="18" cy="14" r="1.5" fill="#00E5FF"/>
            <circle cx="14" cy="10" r="1.5" fill="#00E5FF"/>
          </svg>
          <span className="text-2xl font-black tracking-wider" style={{
            color: '#00E5FF',
            textShadow: '0 0 10px rgba(0, 229, 255, 0.5), 0 0 20px rgba(0, 229, 255, 0.3)',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }}>
            BRAINIAC
          </span>
        </a>
      </div>
      {chat.started && ( // Display ChatDescription and HeaderActionButtons only when the chat has started.
        <>
          <span className="flex-1 px-4 truncate text-center text-bolt-elements-textPrimary">
            <ClientOnly>{() => <ChatDescription />}</ClientOnly>
          </span>
          <ClientOnly>
            {() => (
              <div className="">
                <HeaderActionButtons chatStarted={chat.started} />
              </div>
            )}
          </ClientOnly>
        </>
      )}
    </header>
  );
}
