import { useStore } from '@nanostores/react';
import { authModalStore } from '~/lib/stores/authModal';
import { SignInForm } from './SignInForm';
import { SignUpForm } from './SignUpForm';
import { AuthStateMessage } from './AuthStateMessage';
import { PasswordResetForm } from './PasswordResetForm';
import { toast } from 'react-toastify';

export function GlobalAuthModal() {
  const isOpen = useStore(authModalStore.isOpen);
  const isSignUp = useStore(authModalStore.isSignUp);
  const state = useStore(authModalStore.state);
  const message = useStore(authModalStore.message);
  const showPasswordReset = useStore(authModalStore.showPasswordReset);

  const addIntercomUser = async (userEmail: string, name: string) => {
    try {
      const response = await fetch('/api/intercom', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: userEmail,
          name,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add user to Intercom');
      }

      console.log('New contact created in Intercom');
    } catch (error) {
      console.error('Error adding user to Intercom:', error);
      toast.error('Failed to sync with Intercom (non-critical)');
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex justify-center items-start z-[1001] p-4 pt-8 overflow-y-auto"
      onClick={() => authModalStore.close()}
    >
      <div
        className="bg-bolt-elements-background-depth-1 p-6 sm:p-8 rounded-2xl w-full max-w-md mx-auto border border-bolt-elements-borderColor/50 shadow-2xl hover:shadow-3xl transition-shadow duration-300 backdrop-blur-sm relative max-h-[calc(100vh-4rem)] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => authModalStore.close()}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 w-10 h-10 sm:w-8 sm:h-8 rounded-xl bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor hover:bg-bolt-elements-background-depth-3 transition-all duration-200 flex items-center justify-center text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary shadow-sm hover:shadow-md hover:scale-105 group z-10"
        >
          <div className="i-ph:x text-lg transition-transform duration-200 group-hover:scale-110" />
        </button>

        {state === 'success' ? (
          <AuthStateMessage
            type="success"
            title="Check Your Email"
            message={message}
            onClose={() => authModalStore.close()}
            closeButtonText="Got it"
          />
        ) : state === 'error' ? (
          <AuthStateMessage
            type="error"
            title="Authentication Error"
            message={message}
            onClose={() => authModalStore.close()}
            onRetry={() => authModalStore.setState('form')}
            closeButtonText="Close"
            retryButtonText="Try Again"
          />
        ) : isSignUp ? (
          <SignUpForm
            addIntercomUser={addIntercomUser}
            onToggleForm={() => authModalStore.toggleForm()}
            onSuccess={(message) => authModalStore.setState('success', message)}
            onError={(message) => authModalStore.setState('error', message)}
          />
        ) : showPasswordReset ? (
          <PasswordResetForm
            onBack={() => authModalStore.hideReset()}
            onSuccess={(message) => authModalStore.setState('success', message)}
            onError={(message) => authModalStore.setState('error', message)}
          />
        ) : (
          <SignInForm
            onToggleForm={() => authModalStore.toggleForm()}
            onError={(message) => authModalStore.setState('error', message)}
            onForgotPassword={() => authModalStore.showReset()}
          />
        )}
      </div>
    </div>
  );
}
