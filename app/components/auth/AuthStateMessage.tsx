import type { ReactNode } from 'react';
import { CheckCircle, XCircle } from '~/components/ui/Icon';

interface AuthStateMessageProps {
  type: 'success' | 'error';
  title: string;
  message: string | ReactNode;
  onClose?: () => void;
  onRetry?: () => void;
  closeButtonText?: string;
  retryButtonText?: string;
}

export function AuthStateMessage({
  type,
  title,
  message,
  onClose,
  onRetry,
  closeButtonText = 'Close',
  retryButtonText = 'Try Again',
}: AuthStateMessageProps) {
  const isSuccess = type === 'success';

  return (
    <div className="max-w-md mx-auto">
      <div className="p-8 text-center">
        <div className="mb-8">
          {isSuccess ? (
            <div className="mx-auto w-20 h-20 bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-2xl flex items-center justify-center shadow-lg border border-green-500/20 backdrop-blur-sm">
              <CheckCircle className="text-green-500 animate-pulse" size={30} />
            </div>
          ) : (
            <div className="mx-auto w-20 h-20 bg-gradient-to-br from-red-500/10 to-rose-500/10 rounded-2xl flex items-center justify-center shadow-lg border border-red-500/20 backdrop-blur-sm">
              <XCircle className="text-red-500" size={30} />
            </div>
          )}
        </div>

        <h2 className="text-3xl font-bold mb-6 text-bolt-elements-textHeading">{title}</h2>

        <div className="text-lg text-bolt-elements-textSecondary mb-8 leading-relaxed max-w-sm mx-auto bg-bolt-elements-background-depth-2 bg-opacity-30 px-4 py-3 rounded-xl border border-bolt-elements-borderColor border-opacity-30">
          {message}
        </div>

        <div className="space-y-4">
          {onRetry && (
            <button
              onClick={onRetry}
              className="w-full py-4 px-6 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white rounded-xl font-semibold text-lg transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-[1.02] border border-white/20 hover:border-white/30 group"
            >
              <span className="transition-transform duration-200 group-hover:scale-105">{retryButtonText}</span>
            </button>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className={`w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-200 shadow-sm hover:shadow-md hover:scale-[1.02] border group ${
                onRetry
                  ? 'bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-3 hover:text-bolt-elements-textPrimary border-bolt-elements-borderColor'
                  : isSuccess
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white border-white/20 hover:border-white/30 shadow-lg hover:shadow-xl'
                    : 'bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white border-white/20 hover:border-white/30 shadow-lg hover:shadow-xl'
              }`}
            >
              <span className="transition-transform duration-200 group-hover:scale-105">{closeButtonText}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
