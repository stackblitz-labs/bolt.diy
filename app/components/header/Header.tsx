import { useStore } from '@nanostores/react';
import { ClientOnly } from 'remix-utils/client-only';
import { chatStore } from '~/lib/stores/chat';
import { classNames } from '~/utils/classNames';
import { UserMenu } from '~/components/auth/UserMenu';

function StatusBadge({ status }: { status: 'idle' | 'generating' | 'generated' | 'error' }) {
  if (status === 'idle') {
    return null;
  }

  if (status === 'generating') {
    return (
      <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-full text-xs font-medium border border-amber-100/50 shadow-sm dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/50">
        <div className="i-svg-spinners:ring-resize w-3 h-3" />
        Generating...
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-700 rounded-full text-xs font-medium border border-red-100/50 shadow-sm dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/50">
        <div className="w-2 h-2 rounded-full bg-red-500" />
        Error
      </div>
    );
  }

  return (
    <div
      className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium shadow-sm"
      style={{
        background: 'var(--bolt-status-success-bg)',
        color: 'var(--bolt-status-success-text)',
        border: '1px solid var(--bolt-status-success-border)',
      }}
    >
      <span className="relative flex h-2 w-2">
        <span
          className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
          style={{ background: 'var(--bolt-status-success-dot)' }}
        />
        <span
          className="relative inline-flex rounded-full h-2 w-2"
          style={{ background: 'var(--bolt-status-success-dot)' }}
        />
      </span>
      Site Generated
    </div>
  );
}

export function Header() {
  const chat = useStore(chatStore);

  return (
    <header
      className={classNames(
        'fixed top-0 left-0 right-0 flex items-center justify-between px-6 lg:px-8 py-3 z-50 transition-all duration-300 backdrop-blur-md',
        {
          'border-b': chat.started,
        },
      )}
      style={{
        background: 'var(--bolt-header-bg)',
        borderColor: chat.started ? 'var(--bolt-header-border)' : 'transparent',
      }}
    >
      {/* Left section - Brand */}
      <div className="flex items-center gap-3">
        <a href="/" className="flex items-center gap-3">
          <img src="/huskIT.svg" alt="HuskIT" className="h-10 w-auto" />
        </a>
        {/* <div>
          <h2 className="text-lg font-bold tracking-tight text-bolt-elements-textPrimary">AI Site Builder</h2>
          {chat.projectName && (
            <div className="text-[10px] uppercase tracking-wider font-semibold text-bolt-elements-textTertiary">
              {chat.projectName}
            </div>
          )}
        </div> */}
      </div>

      {/* Right section - Status, Buttons & User Menu */}
      <div className="flex items-center gap-4">
        <StatusBadge status={chat.generationStatus} />
        {chat.started && (
          <>
            <div className="h-6 w-px bg-bolt-elements-borderColor mx-2 hidden md:block" />
            <button
              className="px-4 py-2 border text-sm font-semibold rounded-xl transition-all duration-200 flex items-center gap-2 shadow-sm"
              style={{
                background: 'var(--bolt-elements-bg-depth-1)',
                borderColor: 'var(--bolt-elements-borderColor)',
                color: 'var(--bolt-elements-textSecondary)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--bolt-elements-textPrimary)';
                e.currentTarget.style.background = 'var(--bolt-elements-bg-depth-2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--bolt-elements-textSecondary)';
                e.currentTarget.style.background = 'var(--bolt-elements-bg-depth-1)';
              }}
            >
              Save &amp; Exit
            </button>
            <button
              className="px-5 py-2 text-white text-sm font-semibold rounded-xl shadow-lg transition-all duration-200 flex items-center gap-2 transform hover:-translate-y-0.5"
              style={{
                background: 'var(--bolt-elements-textPrimary)',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
              }}
            >
              Publish Website
              <div className="i-ph:rocket-launch text-lg" />
            </button>
          </>
        )}
        {!chat.started && <ClientOnly>{() => <UserMenu />}</ClientOnly>}
      </div>
    </header>
  );
}
