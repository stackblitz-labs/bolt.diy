import { useEffect } from 'react';
import { LoginForm } from './LoginForm';
import { SignupForm } from './SignupForm';
import { createPortal } from 'react-dom';
import { ClientOnly } from 'remix-utils/client-only';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'signup';
  onSwitchMode: (mode: 'login' | 'signup') => void;
}

export function AuthModal({ isOpen, onClose, initialMode = 'login', onSwitchMode }: AuthModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <ClientOnly>
      {() =>
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-[1000px] z-10 animate-in fade-in zoom-in-95 duration-200">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 z-20 p-2 rounded-full bg-white/10 hover:bg-white/20 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              >
                <div className="i-ph:x text-xl" />
              </button>

              <div className="overflow-hidden rounded-[2rem] bg-white shadow-xl dark:bg-gray-900 dark:shadow-2xl">
                <div className="flex flex-col lg:flex-row">
                  <div className="flex-1">
                    {initialMode === 'login' ? (
                      <LoginForm onRegisterClick={() => onSwitchMode('signup')} onSuccess={onClose} />
                    ) : (
                      <SignupForm onLoginClick={() => onSwitchMode('login')} onSuccess={onClose} />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )
      }
    </ClientOnly>
  );
}
