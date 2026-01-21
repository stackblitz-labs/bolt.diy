import { ChevronLeft, ChevronRight, ArrowDownWideNarrow } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';

interface MessageNavigatorProps {
  userMessages: Array<{ id: string; content: string; index: number }>;
  currentIndex: number;
  onNavigate: (index: number) => void;
  onScrollToBottom: () => void;
  showJumpToBottom: boolean;
}

export function MessageNavigator({
  userMessages,
  currentIndex,
  onNavigate,
  onScrollToBottom,
  showJumpToBottom,
}: MessageNavigatorProps) {
  if (userMessages.length === 0) {
    return null;
  }

  const currentMessage = userMessages[currentIndex];
  const canGoBack = currentIndex > 0;
  const canGoForward = currentIndex < userMessages.length - 1;

  const handlePrevious = () => {
    if (canGoBack) {
      onNavigate(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (canGoForward) {
      onNavigate(currentIndex + 1);
    }
  };

  return (
    <div className="flex items-center gap-1 p-4 bg-background border border-bolt-elements-borderColor rounded-md shadow-md">
      {/* Message text */}
      <div className="flex-1 min-w-0 text-sm text-bolt-elements-textPrimary truncate pr-2">
        {currentMessage.content}
      </div>

      {/* Navigation arrows */}
      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          onClick={handlePrevious}
          disabled={!canGoBack}
          className={cn(
            'h-7 w-7 text-bolt-elements-textSecondary',
            canGoBack && 'hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-2',
          )}
        >
          <ChevronLeft size={16} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleNext}
          disabled={!canGoForward}
          className={cn(
            'h-7 w-7 text-bolt-elements-textSecondary',
            canGoForward && 'hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-2',
          )}
        >
          <ChevronRight size={16} />
        </Button>
      </div>

      {/* Separator */}
      <div className="w-px h-5 bg-bolt-elements-borderColor mx-1" />

      {/* Scroll to bottom */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onScrollToBottom}
        className="h-7 w-7 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-2"
        disabled={!showJumpToBottom}
      >
        <ArrowDownWideNarrow size={16} />
      </Button>
    </div>
  );
}
