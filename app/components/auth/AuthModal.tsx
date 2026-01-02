import { useState } from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { DialogRoot, DialogTitle, DialogClose } from '~/components/ui/Dialog';
import { SignupForm } from './SignupForm';
import { LoginForm } from './LoginForm';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'signup';
}

export function AuthModal({ isOpen, onClose, initialMode = 'login' }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);

  const handleSuccess = () => {
    onClose();
  };

  return (
    <DialogRoot open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay
          className="fixed inset-0 z-[9999] bg-black/70 dark:bg-black/80 backdrop-blur-sm"
          onClick={onClose}
        />
        <RadixDialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] w-full max-w-md mx-4 focus:outline-none">
          <div className="relative bg-bolt-elements-bg-depth-1 dark:bg-bolt-elements-bg-depth-1 rounded-lg shadow-xl p-6 border border-bolt-elements-border">
            <div className="flex items-center justify-between mb-6">
              <DialogTitle className="text-bolt-elements-textPrimary">
                {mode === 'login' ? 'Log in' : 'Sign up'}
              </DialogTitle>
              <DialogClose asChild>
                <button
                  type="button"
                  className="absolute top-4 right-4 text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary transition-colors p-1.5 rounded-md hover:bg-bolt-elements-background-depth-2 flex items-center justify-center"
                  aria-label="Close"
                >
                  <div className="i-ph:x-bold w-5 h-5" />
                </button>
              </DialogClose>
            </div>

            {mode === 'login' ? (
              <LoginForm onSuccess={handleSuccess} onSwitchToSignup={() => setMode('signup')} />
            ) : (
              <SignupForm onSuccess={handleSuccess} onSwitchToLogin={() => setMode('login')} />
            )}
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </DialogRoot>
  );
}
