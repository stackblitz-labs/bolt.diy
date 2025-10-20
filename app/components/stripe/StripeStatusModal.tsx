import { useState, useEffect } from 'react';
import { classNames } from '~/utils/classNames';
import { CheckCircle, XCircle, Info } from '~/components/ui/Icon';

interface StripeStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
  details?: string;
}

export function StripeStatusModal({ isOpen, onClose, type, title, message, details }: StripeStatusModalProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
    }
  }, [isOpen]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 200); // Wait for animation
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  if (!isOpen) {
    return null;
  }

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="text-green-500" size={24} />;
      case 'error':
        return <XCircle className="text-red-500" size={24} />;
      case 'info':
        return <Info className="text-blue-500" size={24} />;
      default:
        return <Info className="text-blue-500" size={24} />;
    }
  };

  const getColors = () => {
    switch (type) {
      case 'success':
        return {
          icon: 'text-green-500',
          bg: 'from-green-500/5 to-emerald-500/5',
          border: 'border-green-500/20',
          button: 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600',
        };
      case 'error':
        return {
          icon: 'text-red-500',
          bg: 'from-red-500/5 to-pink-500/5',
          border: 'border-red-500/20',
          button: 'bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600',
        };
      case 'info':
        return {
          icon: 'text-blue-500',
          bg: 'from-blue-500/5 to-indigo-500/5',
          border: 'border-blue-500/20',
          button: 'bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600',
        };
      default:
        return {
          icon: 'text-blue-500',
          bg: 'from-blue-500/5 to-indigo-500/5',
          border: 'border-blue-500/20',
          button: 'bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600',
        };
    }
  };

  const colors = getColors();

  return (
    <div
      className={classNames(
        'fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-[1002] flex items-center justify-center p-4 transition-all duration-300',
        {
          'opacity-100': isVisible,
          'opacity-0': !isVisible,
        },
      )}
      onClick={handleOverlayClick}
    >
      <div
        className={classNames(
          'bg-bolt-elements-background-depth-1 rounded-3xl border shadow-3xl max-w-lg w-full mx-4 transition-all duration-300 transform overflow-hidden',
          colors.border,
          {
            'scale-100 opacity-100': isVisible,
            'scale-95 opacity-0': !isVisible,
          },
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Celebration Header */}
        <div className={classNames('relative px-8 pt-12 pb-8 text-center bg-gradient-to-br', colors.bg)}>
          {/* Large celebration icon at top */}
          <div className="mb-6">
            <div
              className={classNames(
                'w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br shadow-2xl flex items-center justify-center transform transition-all duration-500 hover:scale-110',
                type === 'success'
                  ? 'from-green-400 to-emerald-500'
                  : type === 'error'
                    ? 'from-red-400 to-pink-500'
                    : 'from-blue-400 to-indigo-500',
              )}
            >
              <div className="text-4xl text-white">{getIcon()}</div>
            </div>
          </div>

          {/* Centered title */}
          <h2 className="text-3xl font-bold text-bolt-elements-textHeading mb-3 leading-tight">{title}</h2>

          {/* Subtitle */}
          <p className="text-bolt-elements-textSecondary font-medium">
            {type === 'success'
              ? '✨ Transaction completed successfully'
              : type === 'error'
                ? '⚠️ Action required'
                : 'ℹ️ Information'}
          </p>
        </div>

        {/* Content */}
        <div className="px-8 pb-8">
          {/* Main message */}
          <div className="text-center mb-6">
            <p className="text-lg text-bolt-elements-textPrimary leading-relaxed font-medium">{message}</p>
          </div>

          {/* Details card */}
          {details && (
            <div className="mb-8">
              <div
                className={classNames(
                  'p-6 rounded-2xl border shadow-sm bg-gradient-to-br',
                  'from-bolt-elements-background-depth-2/40 to-bolt-elements-background-depth-3/20',
                  'border-bolt-elements-borderColor border-opacity-30',
                )}
              >
                <p className="text-bolt-elements-textSecondary leading-relaxed text-center">{details}</p>
              </div>
            </div>
          )}

          {/* Continue button */}
          <button
            onClick={handleClose}
            className={classNames(
              'w-full py-4 px-8 rounded-2xl font-bold text-white text-lg transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-105 transform',
              colors.button,
            )}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
