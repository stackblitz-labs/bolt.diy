import { Crown } from '~/components/ui/Icon';
import { accountModalStore } from '~/lib/stores/accountModal';

export function PlanUpgradeBlock() {
  const handleViewPlans = () => {
    accountModalStore.open('billing');

    if (window.analytics) {
      window.analytics.track('Clicked Upgrade Plan - App Limit', {
        timestamp: new Date().toISOString(),
        source: 'plan_upgrade_block',
      });
    }
  };

  return (
    <div className="flex items-center justify-center">
      <div className="max-w-2xl w-full">
        {/* Main Card */}
        <div className="relative overflow-hidden rounded-2xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 shadow-2xl">
          {/* Gradient Background Effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-pink-500/5 pointer-events-none" />

          <div className="relative p-4 sm:p-6">
            {/* Heading */}
            <h2 className="text-xl sm:text-2xl font-bold text-center text-bolt-elements-textHeading mb-4">
              App Limit Reached
            </h2>

            {/* Description */}
            <p className="text-center text-bolt-elements-textSecondary text-sm mb-4 max-w-md mx-auto leading-relaxed">
              You've reached your maximum number of apps for the{' '}
              <span className="text-bolt-elements-textPrimary font-semibold">Free Plan</span>. Upgrade to continue
              building amazing applications!
            </p>

            {/* CTA Button */}
            <div className="flex justify-center">
              <button
                onClick={handleViewPlans}
                className="group relative px-8 py-4 text-white bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-xl transition-all duration-200 flex items-center gap-3 font-semibold shadow-lg hover:shadow-xl hover:scale-105 text-lg"
              >
                <Crown className="transition-transform duration-200 group-hover:scale-110" size={24} />
                <span className="transition-transform duration-200 group-hover:scale-105">View Plans & Upgrade</span>
              </button>
            </div>

            {/* Small text */}
            <p className="text-center text-bolt-elements-textTertiary text-sm mt-6">
              Choose the plan that works best for you
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
