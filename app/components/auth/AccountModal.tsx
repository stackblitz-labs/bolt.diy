import { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { useStore } from '@nanostores/react';
import { cancelSubscription, manageBilling, checkSubscriptionStatus } from '~/lib/stripe/client';
import { classNames } from '~/utils/classNames';
import { stripeStatusModalActions } from '~/lib/stores/stripeStatusModal';
import { ConfirmCancelModal } from '~/components/subscription/ConfirmCancelModal';
import { subscriptionStore } from '~/lib/stores/subscriptionStatus';
import { useIsMobile } from '~/lib/hooks/useIsMobile';
import { User as UserIcon, Crown, Settings } from '~/components/ui/Icon';
import { accountModalStore } from '~/lib/stores/accountModal';

interface AccountModalProps {
  user: User | undefined;
}

export const AccountModal = ({ user }: AccountModalProps) => {
  const { isMobile } = useIsMobile();
  const stripeSubscription = useStore(subscriptionStore.subscription);
  const [loading, setLoading] = useState(true);
  const [loadingBilling, setLoadingBilling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const reloadAccountData = async () => {
    setLoading(true);
    setLoadingBilling(true);

    const stripeStatus = await checkSubscriptionStatus();
    subscriptionStore.setSubscription(stripeStatus);

    setLoading(false);
    setLoadingBilling(false);
  };

  useEffect(() => {
    reloadAccountData();
  }, []);

  const handleCancelSubscription = () => {
    if (!user?.email) {
      stripeStatusModalActions.showError(
        'Sign In Required',
        'Please sign in to cancel your subscription.',
        'You need to be signed in to manage your subscription settings.',
      );
      return;
    }

    setShowCancelConfirm(true);
  };

  const confirmCancelSubscription = async () => {
    setShowCancelConfirm(false);

    if (!user?.email) {
      return;
    }

    try {
      await cancelSubscription(false);
      stripeStatusModalActions.showSuccess(
        '✅ Subscription Canceled',
        'Your subscription has been successfully canceled.',
        "You'll continue to have access until the end of your current billing period.",
      );
      reloadAccountData();
    } catch (error) {
      console.error('Error canceling subscription:', error);
      stripeStatusModalActions.showError(
        'Cancellation Failed',
        "We couldn't cancel your subscription at this time.",
        'Please try again in a few moments, or contact support if the issue persists.',
      );
    }
  };

  const handleManageBilling = async () => {
    setLoadingBilling(true);
    if (!user?.email) {
      stripeStatusModalActions.showError(
        'Sign In Required',
        'Please sign in to manage your subscription.',
        'You need to be signed in to access your billing portal.',
      );
      return;
    }

    try {
      await manageBilling();
      if (window.analytics) {
        window.analytics.track('Clicked Manage Billing button', {
          timestamp: new Date().toISOString(),
          userId: user?.id,
          email: user?.email,
        });
      }
      setLoadingBilling(false);
    } catch (error) {
      console.error('Error opening billing portal:', error);
      stripeStatusModalActions.showError(
        'Billing Portal Unavailable',
        "We couldn't open your billing portal right now.",
        'Please try again in a few moments, or contact support if the issue persists.',
      );
    } finally {
      setLoadingBilling(false);
    }
  };

  const handleViewPlans = () => {
    accountModalStore.open('billing');
  };

  if (loading) {
    return (
      <div
        className={classNames(
          'bg-bolt-elements-background-depth-1 p-6 sm:p-8 max-w-4xl w-full border border-bolt-elements-borderColor border-opacity-50 overflow-y-auto max-h-[95vh] shadow-2xl hover:shadow-3xl transition-all duration-300 relative backdrop-blur-sm',
          {
            'rounded-b-2xl': isMobile,
            'rounded-r-2xl': !isMobile,
          },
        )}
      >
        <div className="text-center py-16 bg-gradient-to-br from-bolt-elements-background-depth-2/50 to-bolt-elements-background-depth-3/30 rounded-2xl border border-bolt-elements-borderColor border-opacity-30 shadow-sm backdrop-blur-sm">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-blue-500/20 shadow-lg">
            <div className="w-8 h-8 border-2 border-bolt-elements-borderColor border-opacity-30 border-t-blue-500 rounded-full animate-spin" />
          </div>
          <h3 className="text-lg font-semibold text-bolt-elements-textHeading mb-2">Loading Account Data</h3>
          <p className="text-bolt-elements-textSecondary">Fetching your subscription details...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={classNames(
        'bg-bolt-elements-background-depth-1 p-6 sm:p-8 max-w-4xl w-full border border-bolt-elements-borderColor border-opacity-50 overflow-y-auto h-full shadow-2xl hover:shadow-3xl transition-all duration-300 relative backdrop-blur-sm',
        {
          'rounded-b-2xl': isMobile,
          'rounded-r-2xl': !isMobile,
        },
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="text-center mb-8">
        <div className="mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500/10 to-green-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-bolt-elements-borderColor border-opacity-30 shadow-lg backdrop-blur-sm">
            <UserIcon className="text-bolt-elements-textPrimary" size={30} />
          </div>
          <h1 className="text-4xl font-bold text-bolt-elements-textHeading mb-3 bg-gradient-to-r from-bolt-elements-textHeading to-bolt-elements-textSecondary bg-clip-text">
            Account
          </h1>
          <p className="text-bolt-elements-textSecondary text-lg bg-bolt-elements-background-depth-2 bg-opacity-30 px-4 py-2 rounded-xl inline-block border border-bolt-elements-borderColor border-opacity-30">
            {user?.email ?? 'unknown'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-1 gap-6 mb-8">
          <div className="flex flex-col items-center bg-bolt-elements-background-depth-2 bg-opacity-50 rounded-2xl p-6 border border-bolt-elements-borderColor border-opacity-50 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] group backdrop-blur-sm">
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-2xl flex items-center justify-center shadow-lg border border-blue-500/20">
                <Crown className="text-blue-600 transition-transform duration-200 group-hover:scale-110" size={24} />
              </div>
            </div>
            <div className="flex flex-col items-center">
              {stripeSubscription ? (
                <>
                  <div className="text-3xl font-bold text-bolt-elements-textHeading mb-2 transition-transform duration-200 group-hover:scale-105">
                    {stripeSubscription.tier === 'builder' ? '$20' : '$0'}
                  </div>
                  <div className="text-sm text-bolt-elements-textSecondary mb-2 font-medium">per month</div>
                  <div className="w-full text-xs text-bolt-elements-textSecondary bg-bolt-elements-background-depth-3 bg-opacity-50 px-3 py-1.5 rounded-lg border border-bolt-elements-borderColor border-opacity-30">
                    {stripeSubscription.tier.charAt(0).toUpperCase() + stripeSubscription.tier.slice(1)} Plan
                  </div>
                  <div className="text-xs text-bolt-elements-textSecondary mt-2">
                    Next billing:{' '}
                    {stripeSubscription.currentPeriodEnd
                      ? new Date(stripeSubscription.currentPeriodEnd).toLocaleDateString()
                      : 'N/A'}
                  </div>
                  {stripeSubscription.cancelAtPeriodEnd && (
                    <div className="text-xs text-yellow-500 mt-1">Cancels at period end</div>
                  )}

                  {!stripeSubscription.cancelAtPeriodEnd && (
                    <button
                      onClick={handleCancelSubscription}
                      className="mt-3 px-4 py-2 text-xs font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg transition-all duration-200 hover:scale-105"
                    >
                      Cancel Subscription
                    </button>
                  )}
                </>
              ) : (
                <>
                  <div className="text-xl font-semibold text-bolt-elements-textSecondary mb-2">
                    You are on the Free Plan
                  </div>
                  <div className="text-sm text-bolt-elements-textSecondary mb-4 font-medium">
                    Upgrade to builder plan to build unlimited apps
                  </div>
                  <button
                    onClick={handleViewPlans}
                    className="flex items-center justify-center w-fit px-4 py-3 text-white bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-lg transition-all duration-200 gap-3 font-medium shadow-sm hover:shadow-md group"
                  >
                    <Crown className="transition-transform duration-200 group-hover:scale-110" size={20} />
                    <span className="transition-transform duration-200 group-hover:scale-105">View Plans</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {stripeSubscription && !loading && (
          <div className="flex flex-col sm:flex-row justify-center gap-4 p-6 bg-bolt-elements-background-depth-2 bg-opacity-30 rounded-2xl border border-bolt-elements-borderColor border-opacity-30">
            {stripeSubscription && !loading && (
              <button
                onClick={handleManageBilling}
                disabled={loadingBilling}
                className={classNames(
                  'px-6 py-4 rounded-xl font-semibold text-white transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 border border-white/20 hover:border-white/30 group flex items-center justify-center gap-3 min-h-[48px] disabled:opacity-50 disabled:cursor-not-allowed',
                  'bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600',
                )}
              >
                <Settings className="transition-transform duration-200 group-hover:scale-110" size={20} />
                <span className="transition-transform duration-200 group-hover:scale-105">Manage Billing</span>
              </button>
            )}
          </div>
        )}
      </div>

      <ConfirmCancelModal
        isOpen={showCancelConfirm}
        onConfirm={confirmCancelSubscription}
        onCancel={() => setShowCancelConfirm(false)}
      />
    </div>
  );
};
