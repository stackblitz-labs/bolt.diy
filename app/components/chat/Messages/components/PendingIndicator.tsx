import React from 'react';
import { cn } from '~/lib/utils';

interface PendingIndicatorProps {
  status?: string;
  className?: string;
}

export function PendingIndicator({ status, className }: PendingIndicatorProps) {
  return (
    <div className={cn('w-full mt-3', className)}>
      <div className="flex items-center gap-3 py-2">
        {/* Animated dots */}
        <div className="flex gap-1">
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
        </div>

        {/* Status text */}
        {status && <span className="text-sm font-medium text-muted-foreground opacity-60">{status}...</span>}
      </div>
    </div>
  );
}
