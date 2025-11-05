import React, { useEffect, useState } from 'react';
import { createTopoffCheckout } from '~/lib/stripe/client';
import { stripeStatusModalActions } from '~/lib/stores/stripeStatusModal';
import { userStore } from '~/lib/stores/auth';
import { useStore } from '@nanostores/react';
import { accountModalStore } from '~/lib/stores/accountModal';
import { Crown } from 'lucide-react';
import { subscriptionStore } from '~/lib/stores/subscriptionStatus';

interface AddPeanutsCardProps {
  onMount?: () => void;
}

export const AddPeanutsCard: React.FC<AddPeanutsCardProps> = ({ onMount }) => {
  const [loading, setLoading] = useState(false);
  const user = useStore(userStore);
  const stripeSubscription = useStore(subscriptionStore.subscription);
  const currentTier = stripeSubscription?.tier;

  useEffect(() => {
    if (onMount) {
      onMount();
    }
  }, []);

  const handleAddPeanuts = async () => {
    if (!user?.id || !user?.email) {
      stripeStatusModalActions.showError(
        'Sign In Required',
        'Please sign in to add peanuts.',
        'You need to be signed in to purchase peanut top-ups.',
      );
      return;
    }

    setLoading(true);
    try {
      await createTopoffCheckout();
      if (window.analytics) {
        window.analytics.track('Peanuts Added', {
          timestamp: new Date().toISOString(),
          userId: user?.id,
          email: user?.email,
        });
      }
    } catch (error) {
      console.error('Error creating peanut top-off:', error);
      stripeStatusModalActions.showError(
        'Checkout Failed',
        "We couldn't create the checkout session.",
        'Please try again in a few moments, or contact support if the issue persists.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubscriptionToggle = async () => {
    accountModalStore.open('billing');
    if (window.analytics) {
      window.analytics.track('Clicked View Plans button', {
        timestamp: new Date().toISOString(),
        userId: user?.id,
        email: user?.email,
      });
    }
  };

  return (
    <div className="w-full mt-5">
      <div className="bg-gradient-to-br from-orange-500/5 via-amber-500/5 to-yellow-500/5 border border-orange-500/20 rounded-2xl p-6 transition-all duration-300 hover:border-orange-500/30 hover:shadow-lg">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-500 text-white rounded-full shadow-lg">
            <div className="text-2xl">🥜</div>
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-bolt-elements-textHeading">Out of Peanuts!</h3>
            <p className="text-bolt-elements-textSecondary text-sm max-w-md">
              You will need to add more to continue building.
            </p>
          </div>

          <button
            onClick={handleAddPeanuts}
            disabled={loading}
            className="px-6 py-4 rounded-xl font-semibold text-white transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 border border-white/20 hover:border-white/30 group flex items-center justify-center gap-3 min-h-[48px] !bg-gradient-to-r !from-green-500 !to-emerald-500 hover:!from-green-600 hover:!to-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                <span className="transition-transform duration-200 group-hover:scale-105">Loading...</span>
              </>
            ) : (
              <>
                <span className="text-2xl transition-transform duration-200 group-hover:scale-110">🥜</span>
                <span className="transition-transform duration-200 group-hover:scale-105">Add 2000 Peanuts</span>
              </>
            )}
          </button>
          {currentTier === 'free' && (
            <>
              <p className="text-bolt-elements-textSecondary text-sm">Or Upgrade Plan</p>
              <button
                onClick={handleSubscriptionToggle}
                disabled={loading}
                className="w-full px-4 py-3 w-fit text-white bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-lg transition-all duration-200 flex items-center gap-3 font-medium shadow-sm hover:shadow-md group"
              >
                <Crown className="transition-transform duration-200 group-hover:scale-110" size={20} />
                <span className="transition-transform duration-200 group-hover:scale-105">View Plans</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
