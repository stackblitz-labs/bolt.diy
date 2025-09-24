import { useState } from 'react';
import { toast } from 'react-toastify';
import { useStore } from '@nanostores/react';
import { userStore } from '~/lib/stores/auth';
import {
  SUBSCRIPTION_TIERS,
  createSubscriptionCheckout,
  type SubscriptionTier,
  manageSubscription,
} from '~/lib/stripe/client';
import { classNames } from '~/utils/classNames';
import { IconButton } from '~/components/ui/IconButton';
import { subscriptionStore } from '~/lib/stores/subscriptionStatus';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTier?: SubscriptionTier;
}

export function SubscriptionModal({ isOpen, onClose, currentTier: propCurrentTier }: SubscriptionModalProps) {
  const [loading, setLoading] = useState<SubscriptionTier | null>(null);
  const stripeSubscription = useStore(subscriptionStore.subscription);
  const user = useStore(userStore);

  if (!isOpen) {
    return null;
  }

  const currentTier = stripeSubscription?.tier ?? propCurrentTier;

  const handleSubscribe = async (tier: SubscriptionTier) => {
    if (!user?.id || !user?.email) {
      toast.error('Please sign in to subscribe');
      return;
    }

    if (tier === currentTier) {
      toast.info('You are already subscribed to this tier');
      return;
    }

    setLoading(tier);

    try {
      await createSubscriptionCheckout(tier);
    } catch (error) {
      console.error('Error creating subscription:', error);
      toast.error('Failed to create subscription. Please try again.');
      setLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    await manageSubscription();
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={handleOverlayClick}
    >
      <div
        className="bg-bolt-elements-background-depth-1 rounded-2xl border border-bolt-elements-borderColor shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-bolt-elements-borderColor/50">
          <div>
            <h2 className="text-2xl font-bold text-bolt-elements-textHeading">Choose Your Plan</h2>
            <p className="text-sm text-bolt-elements-textSecondary mt-1">
              Select a subscription tier that fits your needs
            </p>
          </div>

          <IconButton
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-2 rounded-lg transition-all duration-200 hover:scale-105"
            aria-label="Close modal"
            icon="i-ph:x"
            size="xxl"
          />
        </div>

        <div className="px-6 sm:px-8 pt-2 pb-6">
          <div className="p-4 sm:p-6 bg-gradient-to-r from-bolt-elements-background-depth-2/30 to-bolt-elements-background-depth-3/20 rounded-2xl border border-bolt-elements-borderColor/30 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-xl bg-blue-500/20 flex items-center justify-center mt-1 flex-shrink-0 border border-blue-500/30 shadow-sm">
                <div className="i-ph:info text-blue-500 text-lg"></div>
              </div>
              <div className="text-sm text-bolt-elements-textSecondary">
                <p className="font-semibold text-bolt-elements-textHeading mb-3 text-base">Important Notes:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 gap-x-6">
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-bolt-elements-textSecondary/40 mt-2 flex-shrink-0"></div>
                    <span>Peanuts do not roll over between billing cycles</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-bolt-elements-textSecondary/40 mt-2 flex-shrink-0"></div>
                    <span>You can upgrade or downgrade your plan at any time</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-bolt-elements-textSecondary/40 mt-2 flex-shrink-0"></div>
                    <span>Cancellation takes effect at the end of your current billing period</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-bolt-elements-textSecondary/40 mt-2 flex-shrink-0"></div>
                    <span>All plans include access to all Nut features</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 sm:px-8 pb-6 sm:pb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
            {(
              Object.entries(SUBSCRIPTION_TIERS) as [SubscriptionTier, (typeof SUBSCRIPTION_TIERS)[SubscriptionTier]][]
            ).map(([tier, details]) => {
              const isCurrentTier = tier === currentTier;
              const isLoading = loading === tier;
              const isFree = tier === 'free';

              return (
                <div
                  key={tier}
                  className={classNames(
                    'relative p-6 rounded-2xl border transition-all duration-300 hover:shadow-xl hover:scale-105 group min-h-[400px] flex flex-col',
                    {
                      'border-emerald-400/60 bg-gradient-to-br from-emerald-50/80 to-green-50/60 shadow-xl ring-2 ring-emerald-200/40 dark:from-emerald-900/10 dark:to-green-900/5 dark:ring-emerald-500/20':
                        isCurrentTier,
                      'border-bolt-elements-borderColor/50 bg-gradient-to-br from-bolt-elements-background-depth-2/30 to-bolt-elements-background-depth-3/20 shadow-sm':
                        !isCurrentTier,
                      'hover:border-bolt-elements-borderColor/70 hover:shadow-lg': !isCurrentTier,
                    },
                  )}
                >
                  {isCurrentTier && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <span className="bg-gradient-to-r from-emerald-500 to-green-500 text-white px-4 py-1.5 rounded-full text-xs font-semibold shadow-lg border border-emerald-400/50">
                        ✓ Current Subscription
                      </span>
                    </div>
                  )}

                  <div className="text-center mb-6">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-bolt-elements-background-depth-3/50 to-bolt-elements-background-depth-2/30 border border-bolt-elements-borderColor/30 flex items-center justify-center shadow-sm group-hover:shadow-md transition-all duration-300">
                      <div
                        className={classNames('text-2xl transition-transform duration-300 group-hover:scale-110', {
                          'i-ph:gift text-green-500': isFree,
                          'i-ph:rocket-launch text-blue-500': tier === 'builder',
                        })}
                      />
                    </div>
                    <h3
                      className={classNames(
                        'text-xl font-bold mb-3 transition-transform duration-300 group-hover:scale-105',
                        {
                          'text-emerald-700 dark:text-emerald-400': isCurrentTier,
                          'text-bolt-elements-textHeading': !isCurrentTier,
                        },
                      )}
                    >
                      {details.name}
                      {isCurrentTier && <span className="ml-2 text-emerald-500">✓</span>}
                    </h3>
                    <div className="text-4xl font-bold text-bolt-elements-textHeading mb-2 transition-transform duration-300 group-hover:scale-105">
                      ${details.price}
                      <span className="text-lg font-normal text-bolt-elements-textSecondary">/month</span>
                    </div>
                    <p className="text-sm text-bolt-elements-textSecondary leading-relaxed px-2">
                      {details.description}
                    </p>
                  </div>

                  <div className="space-y-3 mb-8 flex-grow">
                    {details.features.map((feature, index) => (
                      <div key={index} className="flex items-start gap-3 group/feature">
                        <div className="w-6 h-6 rounded-lg bg-green-500/20 flex items-center justify-center mt-0.5 flex-shrink-0 border border-green-500/30 transition-all duration-200 group-hover/feature:scale-110 group-hover/feature:bg-green-500/30">
                          <div className="i-ph:check text-green-500 text-sm transition-transform duration-200 group-hover/feature:scale-110"></div>
                        </div>
                        <span className="text-sm text-bolt-elements-textSecondary leading-relaxed transition-colors duration-200 group-hover/feature:text-bolt-elements-textPrimary">
                          {feature}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-auto">
                    <button
                      onClick={!currentTier ? () => handleSubscribe(tier) : () => handleManageSubscription()}
                      disabled={isCurrentTier || isLoading}
                      className={classNames(
                        'w-full py-4 px-6 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center gap-3 shadow-lg hover:shadow-xl group/btn min-h-[56px]',
                        {
                          'bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-600 border border-green-500/30 cursor-not-allowed':
                            isCurrentTier,
                          'bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white border border-blue-500/50 hover:border-blue-400 hover:scale-105':
                            !isFree && !isCurrentTier && !isLoading,
                          'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white border border-green-500/50 hover:border-green-400 hover:scale-105':
                            isFree && !isCurrentTier && !isLoading,
                          'opacity-50 cursor-not-allowed hover:scale-100': isLoading,
                        },
                      )}
                    >
                      {isLoading && (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      )}
                      <span className="transition-transform duration-300 group-hover/btn:scale-105">
                        {isCurrentTier
                          ? '✓ Current Plan'
                          : isLoading
                            ? 'Processing...'
                            : !!currentTier
                              ? 'Update Subscription'
                              : 'Subscribe'}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}

            <div className="relative overflow-hidden min-h-[400px]">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 rounded-2xl"></div>
              <div className="relative h-full p-6 rounded-2xl bg-gradient-to-r from-bolt-elements-background-depth-2/80 to-bolt-elements-background-depth-3/80 border border-indigo-500/20 shadow-lg backdrop-blur-sm flex flex-col">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center border border-indigo-500/30 shadow-lg">
                    <div className="i-ph:sparkle text-2xl text-indigo-500"></div>
                  </div>
                  <h3 className="text-xl font-bold text-bolt-elements-textHeading mb-3">Pro</h3>
                  <div className="text-2xl font-bold text-indigo-500 mb-2">Coming Soon</div>
                  <p className="text-sm text-bolt-elements-textSecondary leading-relaxed px-2">
                    Build apps effortlessly
                  </p>
                </div>

                <div className="space-y-3 mb-8 flex-grow">
                  <div className="flex items-start gap-3 group/feature">
                    <div className="w-6 h-6 rounded-lg bg-indigo-500/20 flex items-center justify-center mt-0.5 flex-shrink-0 border border-indigo-500/30">
                      <div className="i-ph:sparkle text-indigo-500 text-sm"></div>
                    </div>
                    <span className="text-sm text-bolt-elements-textSecondary leading-relaxed">
                      Guaranteed Reliability
                    </span>
                  </div>
                  <div className="flex items-start gap-3 group/feature">
                    <div className="w-6 h-6 rounded-lg bg-pink-500/20 flex items-center justify-center mt-0.5 flex-shrink-0 border border-pink-500/30">
                      <div className="i-ph:sparkle text-pink-500 text-sm"></div>
                    </div>
                    <span className="text-sm text-bolt-elements-textSecondary leading-relaxed">
                      Up Front App Prices
                    </span>
                  </div>
                  <div className="flex items-start gap-3 group/feature">
                    <div className="w-6 h-6 rounded-lg bg-purple-500/20 flex items-center justify-center mt-0.5 flex-shrink-0 border border-purple-500/30">
                      <div className="i-ph:sparkle text-purple-500 text-sm"></div>
                    </div>
                    <span className="text-sm text-bolt-elements-textSecondary leading-relaxed">Priority Support</span>
                  </div>
                </div>

                <div className="mt-auto">
                  <a
                    href="https://form.typeform.com/to/bFKqmqdX"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-4 px-6 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center gap-3 shadow-lg bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white border border-indigo-500/50 hover:border-indigo-400 hover:scale-105 cursor-pointer"
                  >
                    <div className="i-ph:arrow-up-right text-white"></div>
                    <span>Join Waitlist</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
