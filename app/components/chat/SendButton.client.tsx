import { useStore } from '@nanostores/react';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import { AnimatePresence, cubicBezier, motion } from 'framer-motion';
import WithTooltip from '~/components/ui/Tooltip';
import { chatStore } from '~/lib/stores/chat';
import { ArrowUp, StopCircle } from '~/components/ui/Icon';

interface SendButtonProps {
  disabled?: boolean;
  onClick?: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
  onImagesSelected?: (images: File[]) => void;
}

const customEasingFn = cubicBezier(0.4, 0, 0.2, 1);

export const SendButton = ({ disabled, onClick }: SendButtonProps) => {
  const hasPendingMessage = useStore(chatStore.hasPendingMessage);
  const className = `absolute flex justify-center items-center bottom-[22px] right-[22px] p-2 ${
    hasPendingMessage
      ? 'bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600'
      : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600'
  } text-white rounded-xl h-[40px] w-[40px] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl hover:scale-105 border border-white/20 hover:border-white/30 group`;

  // Determine tooltip text based on button state
  const tooltipText = hasPendingMessage ? 'Stop Generation' : 'Send Message';

  return (
    <AnimatePresence>
      <TooltipProvider>
        <WithTooltip tooltip={tooltipText}>
          <motion.button
            className={className}
            title={tooltipText}
            transition={{ ease: customEasingFn, duration: 0.17 }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            disabled={disabled}
            onClick={(event) => {
              event.preventDefault();

              if (!disabled) {
                onClick?.(event);
              }
            }}
          >
            {!hasPendingMessage ? (
              <ArrowUp
                className="transition-transform duration-200 group-hover:scale-110"
                size={20}
                strokeWidth={2.5}
              />
            ) : (
              <StopCircle className="transition-transform duration-200 group-hover:scale-110" size={20} />
            )}
          </motion.button>
        </WithTooltip>
      </TooltipProvider>
    </AnimatePresence>
  );
};
