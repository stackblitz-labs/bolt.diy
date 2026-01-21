import { useState } from 'react';
import { cn } from '~/lib/utils';
import { Copy, Check } from 'lucide-react';

interface MessageActionsProps {
  messageContent: string;
  onThumbsUp?: () => void;
  onThumbsDown?: () => void;
  onBranch?: () => void;
  onRetry?: () => void;
  className?: string;
  showBranch?: boolean;
  showRetry?: boolean;
}

export function MessageActions({
  messageContent,
  // onThumbsUp,
  // onThumbsDown,
  // onBranch,
  // onRetry,
  className,
  // showBranch = true,
  // showRetry = true,
}: MessageActionsProps) {
  const [copied, setCopied] = useState(false);
  // const [thumbsState, setThumbsState] = useState<'up' | 'down' | null>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(messageContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy message:', err);
    }
  };

  // const handleThumbsUp = () => {
  //   setThumbsState(thumbsState === 'up' ? null : 'up');
  //   onThumbsUp?.();
  // };

  // const handleThumbsDown = () => {
  //   setThumbsState(thumbsState === 'down' ? null : 'down');
  //   onThumbsDown?.();
  // };

  return (
    <div className={cn('flex items-center gap-0', className)}>
      {/* Thumbs Up */}
      {/* <button
        onClick={handleThumbsUp}
        className={cn(
          'flex items-center justify-center w-6 h-6 rounded-md bg-transparent transition-all duration-200',
          thumbsState === 'up'
            ? 'text-green-500 hover:text-green-600'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted',
        )}
        title="Good response"
      >
        <ThumbsUp size={12} />
      </button> */}

      {/* Thumbs Down */}
      {/* <button
        onClick={handleThumbsDown}
        className={cn(
          'flex items-center justify-center w-6 h-6 rounded-md bg-transparent transition-all duration-200',
          thumbsState === 'down'
            ? 'text-red-500 hover:text-red-600'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted',
        )}
        title="Bad response"
      >
        <ThumbsDown size={12} />
      </button> */}

      {/* Branch */}
      {/* {showBranch && (
        <button
          onClick={onBranch}
          className="flex items-center justify-center w-6 h-6 rounded-md bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200"
          title="Branch from here"
        >
          <GitBranchPlus size={12} />
        </button>
      )} */}

      {/* Retry */}
      {/* {showRetry && (
        <button
          onClick={onRetry}
          className="flex items-center justify-center w-6 h-6 rounded-md bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200"
          title="Retry"
        >
          <RotateCw size={12} />
        </button>
      )} */}

      {/* Copy */}
      <button
        onClick={handleCopy}
        className="flex items-center justify-center w-6 h-6 rounded-md bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200"
        title="Copy message"
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
      </button>
    </div>
  );
}
