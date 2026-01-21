import { forwardRef, useState } from 'react';
import { useStore } from '@nanostores/react';
import { toast } from 'react-toastify';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import WithTooltip from '~/components/ui/Tooltip';
import { Button } from '~/components/ui/button';
import { chatStore } from '~/lib/stores/chat';
import { Share2 } from '~/components/ui/Icon';

interface ShareButtonProps {
  asMenuItem?: boolean;
}

export const ShareButton = forwardRef<HTMLButtonElement, ShareButtonProps>(({ asMenuItem, ...props }, ref) => {
  const appId = useStore(chatStore.currentAppId);
  const [copying, setCopying] = useState(false);

  const handleShare = async () => {
    if (!appId) {
      return;
    }

    const shareUrl = `${window.location.origin}/app/${appId}`;

    try {
      setCopying(true);

      // Try native share first on mobile
      if (navigator.share) {
        await navigator.share({
          title: 'Check out my app',
          url: shareUrl,
        });
      } else {
        // Fallback to clipboard
        await navigator.clipboard.writeText(shareUrl);
        toast.success('Link copied to clipboard');
      }
    } catch (error) {
      // User cancelled share or clipboard failed
      if ((error as Error).name !== 'AbortError') {
        console.error('Share failed:', error);
        toast.error('Failed to share');
      }
    } finally {
      setCopying(false);
    }
  };

  if (asMenuItem) {
    return (
      <button
        ref={ref}
        onClick={handleShare}
        disabled={copying}
        className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary"
        {...props}
      >
        <Share2 size={16} />
        Share
      </button>
    );
  }

  return (
    <TooltipProvider>
      <WithTooltip tooltip="Share">
        <Button
          ref={ref}
          variant="ghost"
          size="icon"
          onClick={handleShare}
          disabled={copying}
          className="h-9 w-9 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-3"
          {...props}
        >
          <Share2 size={16} />
        </Button>
      </WithTooltip>
    </TooltipProvider>
  );
});
