import { getPeanutsHistory, getPeanutsSubscription, type PeanutHistoryEntry } from '~/lib/replay/Account';
import { useState, useEffect, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import type { ReactElement } from 'react';
import { peanutsStore, refreshPeanutsStore } from '~/lib/stores/peanuts';
import { useStore } from '@nanostores/react';
import { createTopoffCheckout, cancelSubscription, manageBilling } from '~/lib/stripe/client';
import { openSubscriptionModal } from '~/lib/stores/subscriptionModal';
import { classNames } from '~/utils/classNames';
import { stripeStatusModalActions } from '~/lib/stores/stripeStatusModal';
import { ConfirmCancelModal } from '~/components/subscription/ConfirmCancelModal';
import { database, type AppLibraryEntry } from '~/lib/persistence/apps';
import { toast } from 'react-toastify';
import { useSearchFilter } from '~/lib/hooks/useSearchFilter';
import { subscriptionStore } from '~/lib/stores/subscriptionStatus';

interface AccountModalProps {
  user: User | undefined;
  onClose: () => void;
}

export const AccountModal = ({ user, onClose }: AccountModalProps) => {
  const peanutsRemaining = useStore(peanutsStore.peanutsRemaining);
  const stripeSubscription = useStore(subscriptionStore.subscription);
  const [history, setHistory] = useState<PeanutHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [list, setList] = useState<AppLibraryEntry[] | undefined>(undefined);
  const [loadingList, setLoadingList] = useState(true);
  const { filteredItems: filteredList } = useSearchFilter({
    items: list ?? [],
    searchFields: ['title'],
  });

  const loadEntries = useCallback(() => {
    setList(undefined);
    setLoadingList(true);
    database
      .getAllAppEntries()
      .then(setList)
      .catch((error) => toast.error(error.message))
      .finally(() => setLoadingList(false));
  }, []);

  useEffect(() => {
    loadEntries();
  }, []);

  const reloadAccountData = async () => {
    setLoading(true);

    const [history] = await Promise.all([getPeanutsHistory(), getPeanutsSubscription(), refreshPeanutsStore()]);

    history.reverse();
    setHistory(history);
    setLoading(false);
  };

  useEffect(() => {
    reloadAccountData();
  }, []);

  const formatTime = (timeString: string) => {
    const date = new Date(timeString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatPeanutChange = (delta: number) => {
    const sign = delta >= 0 ? '+' : '';
    const color = delta >= 0 ? 'text-green-500' : 'text-red-500';
    return (
      <span className={`${color} font-medium`}>
        {sign}
        {delta}
      </span>
    );
  };

  const renderFeature = (why: string, appId: string | undefined, featureName: string | undefined): ReactElement => {
    // Find the app title from filteredList using the appId
    const appTitle = appId ? filteredList.find((app) => app.id === appId)?.title : undefined;

    return (
      <div className="space-y-2">
        {appTitle && (
          <div>
            <span className="text-bolt-elements-textSecondary text-sm">App: </span>
            <a
              href={`/app/${appId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 font-medium hover:text-blue-600 transition-colors underline decoration-transparent hover:decoration-blue-500"
            >
              {appTitle}
            </a>
          </div>
        )}
        <div>
          <span className="text-bolt-elements-textSecondary text-sm">
            {why === 'Feature implemented' ? 'Feature implemented' : 'Feature validated'}:{' '}
          </span>
          <span className="text-bolt-elements-textHeading font-medium">{featureName || 'Unknown feature'}</span>
        </div>
      </div>
    );
  };

  const renderHistoryEntry = (entry: PeanutHistoryEntry): string | ReactElement => {
    switch (entry.reason) {
      case 'SetSubscription':
        if (entry.subscriptionPeanuts) {
          return `Subscription set to ${entry.subscriptionPeanuts} peanuts per month`;
        } else {
          return 'Subscription canceled';
        }
      case 'SubscriptionReload':
        return 'Monthly subscription reload';
      case 'AddPeanuts':
        return 'Manual peanut addition';
      case 'FeatureImplemented':
        return renderFeature('Feature implemented', entry.appId, entry.featureName);
      case 'FeatureValidated':
        return renderFeature('Feature validated', entry.appId, entry.featureName);
      default:
        return entry.reason;
    }
  };

  const renderHistoryItem = (item: PeanutHistoryEntry, index: number) => {
    return (
      <div
        key={`${item.time}-${index}`}
        className="p-4 sm:p-5 bg-bolt-elements-background-depth-2/50 rounded-xl border border-bolt-elements-borderColor/50 hover:bg-bolt-elements-background-depth-3/50 hover:border-bolt-elements-borderColor/70 transition-all duration-200 shadow-sm hover:shadow-md group backdrop-blur-sm"
      >
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
          <div className="text-sm text-bolt-elements-textSecondary bg-bolt-elements-background-depth-3/30 px-3 py-1.5 rounded-lg border border-bolt-elements-borderColor/30 font-medium self-start">
            {formatTime(item.time)}
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <span className="text-bolt-elements-textPrimary font-semibold text-right sm:text-left">
              {formatPeanutChange(item.peanutsDelta)} peanuts
            </span>
            <span className="text-bolt-elements-textSecondary transition-transform duration-200 group-hover:scale-110 hidden sm:inline">
              →
            </span>
            <span className="text-bolt-elements-textHeading font-bold bg-bolt-elements-background-depth-3/30 px-2 py-1 rounded-md border border-bolt-elements-borderColor/30 self-start sm:self-auto">
              {item.peanutsRemaining} total
            </span>
          </div>
        </div>
        <div className="text-sm text-bolt-elements-textSecondary font-medium leading-relaxed">
          {renderHistoryEntry(item)}
        </div>
      </div>
    );
  };

  const handleSubscriptionToggle = async () => {
    openSubscriptionModal();
    onClose();
  };

  const handleAddPeanuts = async () => {
    if (!user?.id || !user?.email) {
      stripeStatusModalActions.showError(
        'Sign In Required',
        'Please sign in to add peanuts.',
        'You need to be signed in to purchase peanut top-ups.',
      );
      return;
    }

    try {
      await createTopoffCheckout();
      if (window.analytics) {
        window.analytics.track('Peanuts Added', {
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Error creating peanut top-off:', error);
      stripeStatusModalActions.showError(
        'Checkout Failed',
        "We couldn't create the checkout session.",
        'Please try again in a few moments, or contact support if the issue persists.',
      );
    }
  };

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
        "You'll continue to have access until the end of your current billing period, and you'll keep access to your remaining peanuts.",
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
    } catch (error) {
      console.error('Error opening billing portal:', error);
      stripeStatusModalActions.showError(
        'Billing Portal Unavailable',
        "We couldn't open your billing portal right now.",
        'Please try again in a few moments, or contact support if the issue persists.',
      );
    }
  };

  if (loading || loadingList) {
    return (
      <div className="bg-bolt-elements-background-depth-1 rounded-2xl p-6 sm:p-8 max-w-4xl w-full mx-4 border border-bolt-elements-borderColor/50 overflow-y-auto max-h-[95vh] shadow-2xl hover:shadow-3xl transition-all duration-300 relative backdrop-blur-sm">
        <div className="text-center py-16 bg-gradient-to-br from-bolt-elements-background-depth-2/50 to-bolt-elements-background-depth-3/30 rounded-2xl border border-bolt-elements-borderColor/30 shadow-sm backdrop-blur-sm">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-blue-500/20 shadow-lg">
            <div className="w-8 h-8 border-2 border-bolt-elements-borderColor/30 border-t-blue-500 rounded-full animate-spin" />
          </div>
          <h3 className="text-lg font-semibold text-bolt-elements-textHeading mb-2">Loading Account Data</h3>
          <p className="text-bolt-elements-textSecondary">Fetching your usage history and subscription details...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="bg-bolt-elements-background-depth-1 rounded-2xl p-6 sm:p-8 max-w-4xl w-full mx-4 border border-bolt-elements-borderColor/50 overflow-y-auto max-h-[95vh] shadow-2xl hover:shadow-3xl transition-all duration-300 relative backdrop-blur-sm"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={onClose}
        className="absolute top-3 right-3 sm:top-4 sm:right-4 w-10 h-10 sm:w-8 sm:h-8 rounded-xl bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor hover:bg-bolt-elements-background-depth-3 transition-all duration-200 flex items-center justify-center text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary shadow-sm hover:shadow-md hover:scale-105 group"
        title="Close"
      >
        <div className="i-ph:x text-lg transition-transform duration-200 group-hover:scale-110" />
      </button>

      <div className="text-center mb-8">
        <div className="mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500/10 to-green-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-bolt-elements-borderColor/30 shadow-lg backdrop-blur-sm">
            <div className="i-ph:user text-3xl text-bolt-elements-textPrimary" />
          </div>
          <h1 className="text-4xl font-bold text-bolt-elements-textHeading mb-3 bg-gradient-to-r from-bolt-elements-textHeading to-bolt-elements-textSecondary bg-clip-text">
            Account
          </h1>
          <p className="text-bolt-elements-textSecondary text-lg bg-bolt-elements-background-depth-2/30 px-4 py-2 rounded-xl inline-block border border-bolt-elements-borderColor/30">
            {user?.email ?? 'unknown'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-bolt-elements-background-depth-2/50 rounded-2xl p-6 border border-bolt-elements-borderColor/50 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] group backdrop-blur-sm">
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 bg-gradient-to-br from-yellow-400/20 to-orange-500/20 rounded-2xl flex items-center justify-center shadow-lg border border-yellow-500/20">
                <span className="text-3xl drop-shadow-sm">🥜</span>
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-bolt-elements-textHeading mb-2 transition-transform duration-200 group-hover:scale-105">
                {peanutsRemaining ?? '---'}
              </div>
              <div className="text-sm text-bolt-elements-textSecondary font-medium">Peanuts Available</div>
            </div>
          </div>

          <div className="bg-bolt-elements-background-depth-2/50 rounded-2xl p-6 border border-bolt-elements-borderColor/50 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] group backdrop-blur-sm">
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-2xl flex items-center justify-center shadow-lg border border-blue-500/20">
                <div className="i-ph:crown text-2xl text-blue-600 transition-transform duration-200 group-hover:scale-110" />
              </div>
            </div>
            <div className="text-center">
              {stripeSubscription ? (
                <>
                  <div className="text-3xl font-bold text-bolt-elements-textHeading mb-2 transition-transform duration-200 group-hover:scale-105">
                    {stripeSubscription.peanuts.toLocaleString()}
                  </div>
                  <div className="text-sm text-bolt-elements-textSecondary mb-2 font-medium">Peanuts per month</div>
                  <div className="text-xs text-bolt-elements-textSecondary bg-bolt-elements-background-depth-3/50 px-3 py-1.5 rounded-lg border border-bolt-elements-borderColor/30">
                    {stripeSubscription.tier.charAt(0).toUpperCase() + stripeSubscription.tier.slice(1)} Plan
                  </div>
                  <div className="text-xs text-bolt-elements-textSecondary mt-1">
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
                  <div className="text-xl font-semibold text-bolt-elements-textSecondary mb-2">No Subscription</div>
                  <div className="text-sm text-bolt-elements-textSecondary">Subscribe for monthly peanuts</div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-center gap-4 p-6 bg-bolt-elements-background-depth-2/30 rounded-2xl border border-bolt-elements-borderColor/30">
          {!loading && (
            <button
              onClick={handleSubscriptionToggle}
              disabled={loading}
              className={classNames(
                'px-6 py-4 rounded-xl font-semibold text-white transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 border border-white/20 hover:border-white/30 group flex items-center justify-center gap-3 min-h-[48px] bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600',
                {
                  'opacity-60 cursor-not-allowed hover:scale-100': loading,
                },
              )}
            >
              <div className="i-ph:crown text-xl transition-transform duration-200 group-hover:scale-110" />
              <span className="transition-transform duration-200 group-hover:scale-105">View Plans</span>
            </button>
          )}

          {stripeSubscription && !loading && (
            <button
              onClick={handleManageBilling}
              disabled={loading}
              className={classNames(
                'px-6 py-4 rounded-xl font-semibold text-white transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 border border-white/20 hover:border-white/30 group flex items-center justify-center gap-3 min-h-[48px]',
                'bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600',
              )}
            >
              <div className="i-ph:gear text-xl transition-transform duration-200 group-hover:scale-110" />
              <span className="transition-transform duration-200 group-hover:scale-105">Manage Billing</span>
            </button>
          )}

          {stripeSubscription && !loading && (
            <button
              onClick={handleAddPeanuts}
              disabled={loading}
              className={classNames(
                'px-6 py-4 rounded-xl font-semibold text-white transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 border border-white/20 hover:border-white/30 group flex items-center justify-center gap-3 min-h-[48px]',
                'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600',
                {
                  'opacity-60 cursor-not-allowed hover:scale-100': loading,
                },
              )}
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
          )}
        </div>
      </div>

      <div className="border-t border-bolt-elements-borderColor/50 pt-8">
        <div className="flex items-center gap-4 mb-6">
          <div
            onClick={reloadAccountData}
            className="w-10 h-10 bg-bolt-elements-background-depth-2 rounded-xl flex items-center justify-center cursor-pointer border border-bolt-elements-borderColor hover:bg-bolt-elements-background-depth-3 transition-all duration-200 shadow-sm hover:shadow-md hover:scale-105 group"
          >
            <div className="i-ph:clock-clockwise text-lg text-bolt-elements-textPrimary transition-transform duration-200 group-hover:scale-110" />
          </div>
          <h2 className="text-2xl font-bold text-bolt-elements-textHeading">Usage History</h2>
        </div>

        {history.length === 0 ? (
          <div className="text-center py-16 bg-gradient-to-br from-bolt-elements-background-depth-2/50 to-bolt-elements-background-depth-3/30 rounded-2xl border border-bolt-elements-borderColor/30 shadow-sm backdrop-blur-sm">
            <div className="w-20 h-20 bg-gradient-to-br from-bolt-elements-background-depth-2 to-bolt-elements-background-depth-3 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-bolt-elements-borderColor/50 shadow-lg">
              <div className="i-ph:list text-3xl text-bolt-elements-textSecondary" />
            </div>
            <h3 className="text-lg font-semibold text-bolt-elements-textHeading mb-2">No usage history available</h3>
            <p className="text-sm text-bolt-elements-textSecondary">
              Your peanut transactions will appear here once you start using the platform
            </p>
          </div>
        ) : (
          <div className="space-y-4 max-h-80 overflow-y-auto">{history.map(renderHistoryItem)}</div>
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
