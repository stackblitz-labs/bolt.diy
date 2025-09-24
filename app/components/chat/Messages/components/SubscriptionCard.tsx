import React, { useEffect, useState } from 'react';
import { openSubscriptionModal } from '~/lib/stores/subscriptionModal';

interface SubscriptionCardProps {
  onMount?: () => void;
}

export const SubscriptionCard: React.FC<SubscriptionCardProps> = ({ onMount }) => {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (onMount) {
      onMount();
    }
  }, []);

  const handleViewPlans = async () => {
    setLoading(true);
    try {
      // Open the subscription modal
      openSubscriptionModal();

      // Track analytics if available
      if (window.analytics) {
        window.analytics.track('Subscription Plans Viewed', {
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Error opening subscription modal:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full mt-5">
      <div className="bg-gradient-to-br from-purple-500/5 via-pink-500/5 to-rose-500/5 border border-purple-500/20 rounded-2xl p-6 transition-all duration-300 hover:border-purple-500/30 hover:shadow-lg">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 text-white rounded-full shadow-lg">
            <div className="i-ph:crown text-2xl" />
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-bolt-elements-textHeading">No Subscription</h3>
            <p className="text-bolt-elements-textSecondary text-sm max-w-md">
              Add a subscription to continue building.
            </p>
          </div>

          <button
            onClick={handleViewPlans}
            disabled={loading}
            className="px-6 py-4 rounded-xl font-semibold text-white transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 border border-white/20 hover:border-white/30 group flex items-center justify-center gap-3 min-h-[48px] !bg-gradient-to-r !from-purple-500 !to-pink-500 hover:!from-purple-600 hover:!to-pink-600 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                <span className="transition-transform duration-200 group-hover:scale-105">Loading...</span>
              </>
            ) : (
              <>
                <div className="i-ph:crown text-xl transition-transform duration-200 group-hover:scale-110" />
                <span className="transition-transform duration-200 group-hover:scale-105">View Plans</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
