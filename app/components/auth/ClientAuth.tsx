import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { getSupabase } from '~/lib/supabase/client';
import type { Session, AuthChangeEvent } from '@supabase/supabase-js';

import { peanutsStore, refreshPeanutsStore } from '~/lib/stores/peanuts';
import { accountModalStore } from '~/lib/stores/accountModal';
import { authModalStore } from '~/lib/stores/authModal';
import { userStore } from '~/lib/stores/userAuth';
import { useStore } from '@nanostores/react';
import { openSubscriptionModal } from '~/lib/stores/subscriptionModal';
import { subscriptionStore } from '~/lib/stores/subscriptionStatus';

export function ClientAuth() {
  const user = useStore(userStore.user);
  const [loading, setLoading] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showProTooltip, setShowProTooltip] = useState(false);
  const [proTooltipTimeout, setProTooltipTimeout] = useState<NodeJS.Timeout | null>(null);
  const stripeSubscription = useStore(subscriptionStore.subscription);
  const peanutsRemaining = useStore(peanutsStore.peanutsRemaining);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    async function getUser() {
      try {
        const { data } = await getSupabase().auth.getUser();
        userStore.setUser(data.user ?? undefined);
      } catch (error) {
        console.error('Error fetching user:', error);
      } finally {
        setLoading(false);
      }
    }

    getUser();

    const {
      data: { subscription },
    } = getSupabase().auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      userStore.setUser(session?.user ?? undefined);
      if (session?.user) {
        authModalStore.close();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (showDropdown) {
      refreshPeanutsStore();
    }
  }, [showDropdown]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  const handleSignOut = async () => {
    try {
      await getSupabase().auth.signOut();
      userStore.clearUser();
      window.location.href = '/';
    } catch (error) {
      console.error('Sign out error:', error);
      toast.error('Failed to sign out');
    } finally {
      setShowDropdown(false);
    }
  };

  const handleShowAccountModal = () => {
    accountModalStore.open();
    setShowDropdown(false);
  };

  const handleSubscriptionToggle = async () => {
    openSubscriptionModal();
    setShowDropdown(false);
  };

  if (loading) {
    return <div className="w-8 h-8 rounded-full bg-gray-300 animate-pulse" />;
  }

  const useAvatarURL = false;

  return (
    <>
      {user ? (
        <div className="relative">
          <button
            ref={buttonRef}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-green-500 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 border-2 border-white/20 hover:border-white/30 group"
            onClick={() => setShowDropdown(!showDropdown)}
          >
            {useAvatarURL && user.user_metadata?.avatar_url ? (
              <img
                src={user.user_metadata.avatar_url}
                alt="User avatar"
                className="w-full h-full rounded-lg object-cover transition-transform duration-200 group-hover:scale-110"
              />
            ) : (
              <span className="text-sm font-semibold transition-transform duration-200 group-hover:scale-110">
                <div className="i-ph:user text-lg" />
              </span>
            )}
          </button>

          {showDropdown && (
            <div
              ref={dropdownRef}
              className="absolute right-[-10px] mt-2 py-3 w-72 bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-xl shadow-2xl z-10"
            >
              <div className="px-6 py-4 border-b border-bolt-elements-borderColor">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-bolt-elements-background-depth-2 rounded-full flex items-center justify-center border border-bolt-elements-borderColor">
                    <div className="i-ph:user text-lg text-bolt-elements-textPrimary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-bolt-elements-textSecondary mb-1">Signed in as</div>
                    <div className="font-medium text-bolt-elements-textPrimary truncate text-sm">{user.email}</div>
                  </div>
                </div>
              </div>

              {!stripeSubscription ? (
                <div className="px-3 py-2 border-b border-bolt-elements-borderColor">
                  <button
                    onClick={handleSubscriptionToggle}
                    disabled={loading}
                    className="w-full px-4 py-3 text-white bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-lg transition-all duration-200 flex items-center gap-3 font-medium shadow-sm hover:shadow-md"
                  >
                    <div className="i-ph:crown text-xl transition-transform duration-200 group-hover:scale-110" />
                    <span className="transition-transform duration-200 group-hover:scale-105">View Plans</span>
                  </button>
                </div>
              ) : (
                <div className="px-6 py-4 border-b border-bolt-elements-borderColor">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="i-ph:crown text-lg text-blue-600" />
                      <span className="text-bolt-elements-textPrimary font-medium">Plan</span>
                    </div>

                    <div className="text-right">
                      <div className="text-bolt-elements-textHeading font-bold text-sm">
                        {`${stripeSubscription.tier.charAt(0).toUpperCase() + stripeSubscription.tier.slice(1)} Plan`}
                      </div>
                      <div className="text-xs text-bolt-elements-textSecondary">
                        {stripeSubscription.peanuts.toLocaleString()}/month
                      </div>
                    </div>
                  </div>
                  {stripeSubscription?.cancelAtPeriodEnd && (
                    <div className="text-xs text-yellow-500 mt-1 text-center">Cancels at period end</div>
                  )}
                </div>
              )}

              <div className="px-6 py-4 border-b border-bolt-elements-borderColor">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🥜</span>
                    <span className="text-bolt-elements-textPrimary font-medium">Peanuts</span>
                  </div>
                  <div className="text-bolt-elements-textHeading font-bold text-lg">{peanutsRemaining ?? '...'}</div>
                </div>
              </div>

              <div className="p-3 space-y-2">
                <div className="relative">
                  <a
                    href="https://form.typeform.com/to/bFKqmqdX"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full px-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white rounded-lg transition-all duration-200 flex items-center gap-3 font-medium shadow-sm hover:shadow-md"
                    onMouseEnter={() => {
                      const timeout = setTimeout(() => setShowProTooltip(true), 500);
                      setProTooltipTimeout(timeout);
                    }}
                    onMouseLeave={() => {
                      if (proTooltipTimeout) {
                        clearTimeout(proTooltipTimeout);
                        setProTooltipTimeout(null);
                      }
                      setShowProTooltip(false);
                    }}
                  >
                    <div className="i-ph:sparkle text-lg" />
                    <span>Pro Plan: Join the Waitlist</span>
                  </a>

                  {showProTooltip && (
                    <div className="absolute top-full right-0 mt-2 w-64 bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-lg p-3 shadow-lg z-20 backdrop-blur-sm">
                      <div className="text-sm text-bolt-elements-textPrimary space-y-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-black flex-shrink-0"></div>
                          <span className="font-medium">Guaranteed Reliability</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-black flex-shrink-0"></div>
                          <span className="font-medium">Up Front App Prices</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-black flex-shrink-0"></div>
                          <span className="font-medium">Priority Support</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Arrow */}
                  <div className="absolute top-1/2 left-0 transform -translate-y-1/2 -translate-x-1 w-0 h-0 border-t-4 border-b-4 border-l-4 border-transparent border-l-bolt-elements-background-depth-1"></div>
                </div>

                <button
                  onClick={handleShowAccountModal}
                  className="w-full px-4 py-3 bg-gradient-to-br from-blue-500 to-indigo-500 text-white hover:bg-gradient-to-br hover:from-blue-600 hover:to-indigo-600 rounded-lg transition-all duration-200 flex items-center gap-3 font-medium shadow-sm hover:shadow-md"
                >
                  <div className="i-ph:gear text-lg" />
                  <span>Account Settings</span>
                </button>

                <button
                  onClick={handleSignOut}
                  className="w-full px-4 py-3 bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-3 hover:text-bolt-elements-textPrimary border border-bolt-elements-borderColor rounded-lg transition-all duration-200 flex items-center gap-3 font-medium"
                >
                  <div className="i-ph:sign-out text-lg" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={() => authModalStore.open(false)}
          className="px-4 py-1.5 bg-gradient-to-r from-blue-500 to-green-500 text-white rounded-xl hover:from-blue-600 hover:to-green-600 font-semibold transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 border border-white/20 hover:border-white/30 group"
        >
          <span className="transition-transform duration-200 group-hover:scale-105">Sign In</span>
        </button>
      )}
    </>
  );
}
