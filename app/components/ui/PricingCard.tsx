import { CheckCircle, XCircle, Info } from 'lucide-react';
import { cn } from '~/lib/utils';

export interface PricingFeature {
  name: string;
  included: boolean;
  tooltip?: string;
}

export type PricingCardButtonState = 'current' | 'purchase' | 'coming-soon';

export interface PricingCardProps {
  title: string;
  description: string;
  price: string;
  pricePeriod?: string;
  features: PricingFeature[];
  emphasized?: boolean;
  titleColor?: string;
  className?: string;
  featuresLabel?: string;
}

export function PricingCard({
  title,
  description,
  price,
  pricePeriod = '/month',
  features,
  emphasized = false,
  titleColor,
  className,
}: PricingCardProps) {
  return (
    <div
      className={cn(
        'relative p-6 rounded-2xl transition-all duration-300',
        'flex flex-col w-full max-w-[340px] md:w-[340px]',
        // Base card styling - same dark background for all cards
        'bg-bolt-elements-background-depth-2 dark:bg-bolt-elements-background-depth-2',
        {
          // Emphasized style (for featured plan) - green border and glow
          'border-2 border-green-500/50 shadow-[0_0_30px_-5px_rgba(34,197,94,0.3)]': emphasized,
          // Default - subtle gray border and shadow
          'border border-gray-700/50 dark:border-gray-600/30 shadow-lg': !emphasized,
        },
        className,
      )}
    >
      {/* Gradient overlay at bottom for emphasized card */}
      {emphasized && (
        <div className="absolute -bottom-8 left-0 right-0 h-16 bg-gradient-to-b from-green-500/20 to-transparent rounded-b-2xl blur-xl" />
      )}
      {/* Header */}
      <div className="text-center mb-6">
        <h3
          className={cn(
            'text-2xl font-bold mb-2',
            titleColor || (emphasized ? 'text-green-500 dark:text-green-400' : 'text-bolt-elements-textHeading'),
          )}
        >
          {title}
        </h3>
        <p className="text-sm text-bolt-elements-textSecondary mb-4">{description}</p>
        <div className="mb-4">
          <span className="text-4xl font-bold text-bolt-elements-textHeading">{price}</span>
          {pricePeriod && <span className="text-sm text-bolt-elements-textSecondary ml-1">{pricePeriod}</span>}
        </div>
      </div>

      {/* Features */}
      <div className="">
        <h4 className="text-sm font-semibold text-bolt-elements-textHeading mb-3">What's included:</h4>
        <div className="space-y-3">
          {features.map((feature, index) => (
            <div key={index} className="flex items-start gap-2">
              <div className="flex-shrink-0 mt-0.5">
                {feature.included ? (
                  <CheckCircle className="text-green-500 dark:text-green-400" size={20} />
                ) : (
                  <XCircle className="text-red-500 dark:text-red-400" size={20} />
                )}
              </div>
              <div className="flex-1 flex items-center gap-2">
                <span
                  className={cn(
                    'text-sm',
                    feature.included
                      ? 'text-bolt-elements-textHeading'
                      : 'text-bolt-elements-textSecondary line-through',
                  )}
                >
                  {feature.name}
                </span>
                <button
                  className="flex-shrink-0 text-bolt-elements-textTertiary hover:text-bolt-elements-textSecondary transition-colors"
                  title={feature.tooltip || 'More information'}
                  aria-label={feature.tooltip || 'More information'}
                >
                  <Info size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
