import React, { useState, useEffect, useRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '~/lib/utils';
import { Icon } from './Icon';
import { CheckCircle, Info, AlertTriangle, XCircle, Loader2, MoreHorizontal } from 'lucide-react';
import { formatPascalCaseName } from '~/utils/names';
import { BugReportComponent } from '~/components/chat/BugReportComponent';
import type { BugReport } from '~/lib/persistence/messageAppSummary';
import type { ChatMessageParams } from '~/components/chat/ChatComponent/components/ChatImplementer/ChatImplementer';

const infoCardVariants = cva('flex items-start gap-3 rounded-2xl border p-4 transition-colors', {
  variants: {
    variant: {
      default: 'bg-bolt-elements-background-depth-2 border-bolt-elements-borderColor',
      active: 'bg-bolt-elements-background-depth-2 border-bolt-elements-borderColorActive border-2',
      warning: 'bg-bolt-elements-background-depth-2 border-bolt-elements-borderColorWarning border-2',
    },
    size: {
      default: 'p-4',
      sm: 'p-3',
      lg: 'p-5',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'default',
  },
});

const iconVariants = cva(
  'flex-shrink-0 rounded-full p-1 w-8 h-8 flex items-center justify-center bg-bolt-elements-background-depth-1 text-bolt-elements-textPrimary border border-bolt-elements-borderColor',
  {
    variants: {
      type: {
        success: 'bg-bolt-elements-background-depth-2 text-bolt-elements-textPrimary',
        info: 'bg-bolt-elements-background-depth-2 text-bolt-elements-textPrimary',
        warning: 'bg-bolt-elements-background-depth-2 text-bolt-elements-textPrimary',
        error: 'bg-bolt-elements-background-depth-2 text-bolt-elements-textPrimary',
        loading: 'bg-bolt-elements-background-depth-2 text-bolt-elements-textPrimary',
      },
    },
    defaultVariants: {
      type: 'success',
    },
  },
);

export interface InfoCardProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof infoCardVariants> {
  title?: string;
  description?: string;
  iconType?: 'success' | 'info' | 'warning' | 'error' | 'loading';
  actionButtons?: {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
  }[];
  onCardClick?: () => void;
  bugReport?: BugReport;
  handleSendMessage: (params: ChatMessageParams) => void;
}

export interface InfoCardData {
  id: string;
  title?: string;
  description?: string;
  iconType?: 'success' | 'info' | 'warning' | 'error' | 'loading';
  variant?: 'default' | 'active' | 'warning';
  actionButtons?: {
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
  }[];
  onCardClick?: () => void;
  bugReport?: BugReport;
  handleSendMessage: (params: ChatMessageParams) => void;
}
const InfoCard = React.forwardRef<HTMLDivElement, InfoCardProps>(
  (
    {
      className,
      variant,
      size,
      title,
      description,
      iconType = 'success',
      actionButtons,
      onCardClick,
      bugReport,
      handleSendMessage,
      ...props
    },
    ref,
  ) => {
    const [isOpen, setIsOpen] = useState(false);
    const getIcon = () => {
      switch (iconType) {
        case 'success':
          return CheckCircle;
        case 'info':
          return Info;
        case 'warning':
          return AlertTriangle;
        case 'error':
          return XCircle;
        case 'loading':
          return Loader2;
        default:
          return CheckCircle;
      }
    };

    const IconComponent = getIcon();

    return (
      <div
        ref={ref}
        className={cn(infoCardVariants({ variant, size, className }), {
          'cursor-pointer hover:bg-bolt-elements-background-depth-3': !!onCardClick,
        })}
        {...props}
        onClick={onCardClick}
      >
        {bugReport ? (
          <BugReportComponent report={bugReport} handleSendMessage={handleSendMessage} />
        ) : (
          <>
            {/* Icon */}
            <div className="flex flex-col items-center gap-2">
              <div className={cn(iconVariants({ type: iconType }))}>
                <Icon icon={IconComponent} size={16} className={iconType === 'loading' ? 'animate-spin' : ''} />
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm leading-tight text-bolt-elements-textHeading">
                {title ? formatPascalCaseName(title) : ''}
              </h3>
              <p className="text-sm mt-1 leading-relaxed text-bolt-elements-textSecondary">{description}</p>
            </div>

            {/* Action Button */}
            {actionButtons && actionButtons.length > 0 && (
              <div className="relative">
                <button
                  onClick={(e) => {
                    setIsOpen(!isOpen);
                    e.stopPropagation();
                  }}
                  className="flex-shrink-0 p-1 w-8 h-8 flex items-center justify-center rounded-full transition-colors bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor"
                  aria-label="More options"
                >
                  <Icon icon={MoreHorizontal} size={16} className="text-bolt-elements-textSecondary" />
                </button>
                {isOpen && (
                  <div className="absolute right-full top-0 mt-2 w-48 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-lg shadow-lg z-14">
                    {actionButtons.map((button) => (
                      <button
                        key={button.label}
                        onClick={button.onClick}
                        className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-3"
                      >
                        {button.icon}
                        {button.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    );
  },
);

InfoCard.displayName = 'InfoCard';

export { InfoCard, infoCardVariants };

// Stacked InfoCard Component
export interface StackedInfoCardProps {
  cards: Array<InfoCardData>;
  className?: string;
  scrollToBottom?: () => void;
  handleSendMessage: (params: ChatMessageParams) => void;
}

const StackedInfoCard = React.forwardRef<HTMLDivElement, StackedInfoCardProps>(
  ({ cards, className, scrollToBottom, handleSendMessage }, ref) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [wrapperHeight, setWrapperHeight] = useState(80); // Default height
    const [cardHeight, setCardHeight] = useState(80); // Track actual card height
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const cardRef = useRef<HTMLDivElement>(null);
    const [hasMoreCards, setHasMoreCards] = useState<boolean>(cards.length > 1);

    useEffect(() => {
      setHasMoreCards(cards.length > 1);
    }, [cards]);

    const toggleExpanded = () => {
      if (hasMoreCards) {
        setIsExpanded(!isExpanded);
        setTimeout(() => {
          scrollToBottom?.();
        }, 100);
      }
    };

    // Measure card height and update wrapper height
    useEffect(() => {
      if (cardRef.current && !isExpanded) {
        const cardElement = cardRef.current;
        const measuredHeight = cardElement.offsetHeight;
        setCardHeight(measuredHeight);
        // Use the larger of the measured height or minimum 80px
        setWrapperHeight(Math.max(measuredHeight, 80));
      }
    }, [cards, isExpanded]);

    // Scroll to bottom when expanded
    useEffect(() => {
      if (isExpanded && scrollContainerRef.current) {
        const scrollContainer = scrollContainerRef.current;
        // Use setTimeout to ensure the DOM has updated
        setTimeout(() => {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }, 0);
      }
    }, [isExpanded]);

    return (
      <div
        ref={ref}
        className={cn('relative mt-4', className, {
          'mt-8': hasMoreCards && cards.length > 1,
          'mt-10': hasMoreCards && cards.length > 2,
        })}
        style={{ height: `${wrapperHeight}px` }}
      >
        <div
          className={cn(
            'relative transition-all duration-200',
            hasMoreCards && !isExpanded && 'cursor-pointer hover:scale-[1.02]',
            isExpanded && 'absolute bottom-0 w-full left-0 z-0 backdrop-blur-sm',
          )}
          onMouseEnter={hasMoreCards && !isExpanded ? toggleExpanded : undefined}
          onMouseLeave={isExpanded ? toggleExpanded : undefined}
        >
          {!isExpanded ? (
            <>
              <div
                ref={cardRef}
                className="relative z-[3] transition-all duration-200"
                onMouseEnter={() => setHoveredIndex(0)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <InfoCard
                  title={cards[cards.length - 1].title}
                  description={cards[cards.length - 1].description}
                  iconType={cards[cards.length - 1].iconType}
                  variant={cards[cards.length - 1].variant}
                  actionButtons={cards[cards.length - 1].actionButtons}
                  className={cn('shadow-md', hoveredIndex === 0 && 'shadow-lg')}
                  onCardClick={cards[cards.length - 1].onCardClick}
                  bugReport={cards[cards.length - 1].bugReport}
                  handleSendMessage={handleSendMessage}
                />
              </div>

              {/* Empty placeholder cards for stack effect */}
              {cards.length > 1 && (
                <div
                  className="absolute w-full left-0 z-[2] transition-all duration-200"
                  style={{
                    bottom: `${cardHeight - 20}px`,
                    transform: 'scale(0.95)',
                  }}
                >
                  <div className="bg-bolt-elements-background-depth-2 border-2 border-bolt-elements-borderColor rounded-2xl p-4 h-full" />
                </div>
              )}

              {cards.length > 2 && (
                <div
                  className="absolute w-full left-0 z-[1] transition-all duration-200"
                  style={{
                    bottom: `${cardHeight - 5}px`,
                    transform: 'scale(0.9)',
                  }}
                >
                  <div className="bg-bolt-elements-background-depth-2 border-2 border-bolt-elements-borderColor rounded-2xl p-4 h-full" />
                </div>
              )}
            </>
          ) : (
            <div
              ref={scrollContainerRef}
              className={cn('space-y-2 rounded-t-xl flex flex-col gap-1 max-h-[50vh] overflow-y-auto', {
                '[box-shadow:inset_0_10px_8px_-8px_rgba(0,0,0,0.2)]': isExpanded,
              })}
            >
              <div className=""></div>
              {cards.map((card) => (
                <InfoCard
                  key={card.id}
                  title={card.title}
                  description={card.description}
                  iconType={card.iconType}
                  variant={card.variant}
                  actionButtons={card.actionButtons}
                  onCardClick={card.onCardClick}
                  className="shadow-sm"
                  bugReport={card.bugReport}
                  handleSendMessage={handleSendMessage}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  },
);

StackedInfoCard.displayName = 'StackedInfoCard';

export { StackedInfoCard };
