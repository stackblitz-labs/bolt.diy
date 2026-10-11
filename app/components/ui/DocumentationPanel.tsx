import * as Dialog from '@radix-ui/react-dialog';
import { ExternalLink, X } from 'lucide-react';

const credentiallessIframeAttributes = { credentialless: 'true' };

const DOCUMENTATION_URL = 'https://stackblitz-labs.github.io/bolt.diy/';

interface DocumentationPanelProps {
  open: boolean;
  onClose: () => void;
}

export function DocumentationPanel({ open, onClose }: DocumentationPanelProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[1000] bg-black/40 backdrop-blur-md transition-opacity data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-[1001] flex w-full flex-col border-l border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 text-bolt-elements-textPrimary shadow-2xl outline-none sm:inset-y-3 sm:right-3 sm:w-[min(1100px,75vw)] sm:rounded-xl sm:border">
          <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-bolt-elements-borderColor px-5 sm:px-7">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-bolt-elements-background-depth-3 text-bolt-elements-item-contentAccent">
                <div className="i-ph:book-open-text h-5 w-5" />
              </div>
              <div className="min-w-0">
                <Dialog.Title className="truncate text-sm font-semibold">bolt.diy Manual</Dialog.Title>
                <Dialog.Description className="truncate text-xs text-bolt-elements-textSecondary">
                  Product documentation and guides
                </Dialog.Description>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <a
                href={DOCUMENTATION_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-bolt-elements-borderColor px-3 py-2 text-xs font-medium text-bolt-elements-textSecondary transition-colors hover:bg-bolt-elements-background-depth-2 hover:text-bolt-elements-textPrimary"
              >
                <ExternalLink className="h-4 w-4" />
                <span className="hidden sm:inline">Open in new tab</span>
              </a>
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="Close documentation"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-bolt-elements-textSecondary transition-colors hover:bg-bolt-elements-background-depth-2 hover:text-bolt-elements-textPrimary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
                >
                  <X className="h-5 w-5" />
                </button>
              </Dialog.Close>
            </div>
          </header>

          <iframe
            {...credentiallessIframeAttributes}
            title="bolt.diy documentation"
            src={open ? DOCUMENTATION_URL : 'about:blank'}
            className="min-h-0 w-full flex-1 border-0 bg-white"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
