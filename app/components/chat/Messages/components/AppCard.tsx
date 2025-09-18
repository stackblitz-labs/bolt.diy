import React from 'react';
import { classNames } from '~/utils/classNames';

interface AppCardProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  iconColor?: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'indigo';
  status?: 'pending' | 'in-progress' | 'completed' | 'failed';
  progressText?: string;
  onClick?: () => void;
  children?: React.ReactNode;
}

export const AppCard: React.FC<AppCardProps> = ({
  title,
  description,
  icon,
  iconColor = 'blue',
  status = 'pending',
  progressText,
  onClick,
  children,
}) => {
  const getIconColorStyles = () => {
    switch (iconColor) {
      case 'green':
        return 'bg-gradient-to-br from-green-500 to-green-600';
      case 'purple':
        return 'bg-gradient-to-br from-purple-500 to-purple-600';
      case 'orange':
        return 'bg-gradient-to-br from-orange-500 to-orange-600';
      case 'red':
        return 'bg-gradient-to-br from-red-500 to-red-600';
      case 'indigo':
        return 'bg-gradient-to-br from-indigo-500 to-indigo-600';
      case 'blue':
      default:
        return 'bg-gradient-to-br from-blue-500 to-blue-600';
    }
  };

  const getStatusStyles = () => {
    switch (status) {
      case 'in-progress':
        return {
          badge: 'text-bolt-elements-textPrimary bg-bolt-elements-background-depth-3 border-bolt-elements-borderColor',
          indicator: (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full border-2 border-bolt-elements-borderColor border-t-blue-500 animate-spin shadow-sm" />
              {progressText && (
                <span className="text-sm font-medium text-bolt-elements-textPrimary">{progressText}</span>
              )}
            </div>
          ),
        };
      case 'completed':
        return {
          badge: 'text-bolt-elements-textPrimary bg-bolt-elements-background-depth-3 border-bolt-elements-borderColor',
          indicator: (
            <div className="flex items-center gap-2 text-bolt-elements-icon-success">
              <div className="i-ph:check-bold text-sm" />
              <span className="text-sm font-medium text-green-600">Completed</span>
            </div>
          ),
        };
      case 'failed':
        return {
          badge: 'text-bolt-elements-textPrimary bg-bolt-elements-background-depth-3 border-bolt-elements-borderColor',
          indicator: (
            <div className="flex items-center gap-2">
              {progressText && (
                <span className="text-sm font-medium text-bolt-elements-textPrimary">{progressText}</span>
              )}
            </div>
          ),
        };
      default:
        return {
          badge:
            'text-bolt-elements-textSecondary bg-bolt-elements-background-depth-3 border-bolt-elements-borderColor',
          indicator: progressText ? (
            <span className="text-sm font-medium text-bolt-elements-textSecondary">{progressText}</span>
          ) : null,
        };
    }
  };

  const statusStyles = getStatusStyles();

  return (
    <div
      className={classNames('relative rounded-xl transition-all duration-300 shadow-sm group', {
        'cursor-pointer hover:shadow-xl hover:shadow-bolt-elements-focus/10 hover:scale-[1.03] hover:-translate-y-2':
          !!onClick,
      })}
      onClick={onClick}
    >
      {status === 'in-progress' && (
        <div className="absolute inset-0 p-[2px] rounded-xl animate-focus-border pointer-events-none">
          <div className="w-full h-full bg-bolt-elements-background-depth-2 rounded-[8px]" />
        </div>
      )}
      <div
        className={classNames(
          'bg-bolt-elements-background-depth-2 rounded-xl transition-all duration-300 relative overflow-hidden',
          {
            'border border-bolt-elements-borderColor hover:border-bolt-elements-focus/60':
              !!onClick && status !== 'in-progress',
            'border-transparent': status === 'in-progress',
            'bg-gradient-to-br from-bolt-elements-background-depth-2 via-bolt-elements-background-depth-2 to-blue-500/15':
              status === 'in-progress',
            'border border-bolt-elements-borderColor': !onClick,
          },
        )}
      >
        {onClick && (
          <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-bolt-elements-focus/8 via-bolt-elements-focus/3 to-bolt-elements-focus/8 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        )}

        {status === 'in-progress' && (
          <div className="absolute inset-0 rounded-xl overflow-hidden">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-blue-500/20 to-transparent animate-flow-left-to-right" />
          </div>
        )}

        <div className="p-5 relative">
          <div className="flex items-center gap-3 mb-3">
            {icon && (
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center shadow-sm ${getIconColorStyles()}`}
              >
                {icon}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold text-bolt-elements-textHeading truncate">{title}</h3>
              {statusStyles.indicator && <div className="mt-1.5 flex items-center">{statusStyles.indicator}</div>}
            </div>
          </div>

          <div className="text-sm text-bolt-elements-textSecondary leading-relaxed mb-3">{description}</div>

          {children && <div className="mt-3">{children}</div>}

          {onClick && (
            <div className="mt-3 pt-3 border-t border-bolt-elements-borderColor/30">
              <div className="flex items-center justify-between text-xs">
                <span className="text-bolt-elements-textSecondary">View details</span>
                <div className="i-ph:caret-right text-bolt-elements-textSecondary group-hover:text-bolt-elements-textPrimary transition-colors duration-200" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
