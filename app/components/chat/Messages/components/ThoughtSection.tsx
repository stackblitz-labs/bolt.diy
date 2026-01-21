import React, { useState } from 'react';
import { cn } from '~/lib/utils';
import { ChevronDown, Brain } from 'lucide-react';

interface ThoughtSectionProps {
  thinkingTime?: number;
  children?: React.ReactNode;
  defaultExpanded?: boolean;
}

export function ThoughtSection({ thinkingTime, children, defaultExpanded = false }: ThoughtSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const formatTime = (seconds: number) => {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  };

  const displayTime = thinkingTime ? formatTime(thinkingTime) : null;

  return (
    <div className="flex flex-col">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'flex items-center gap-1 py-1 px-0 text-muted-foreground hover:text-foreground transition-colors duration-200',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md',
        )}
      >
        <Brain size={16} className="text-muted-foreground" />
        <span className="text-sm font-normal">Thought{displayTime ? ` for ${displayTime}` : ''}</span>
        <ChevronDown
          size={12}
          className={cn('transition-transform duration-200', isExpanded ? 'rotate-180' : 'rotate-0')}
        />
      </button>

      {/* Expandable Content */}
      {isExpanded && children && (
        <div className="mt-2 pl-5 border-l-2 border-border">
          <div className="text-sm text-muted-foreground">{children}</div>
        </div>
      )}
    </div>
  );
}
