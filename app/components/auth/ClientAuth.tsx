import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { accountModalStore } from '~/lib/stores/accountModal';
import { authModalStore } from '~/lib/stores/authModal';
import { signOut, userStore } from '~/lib/stores/auth';
import { useStore } from '@nanostores/react';
import { subscriptionStore } from '~/lib/stores/subscriptionStatus';
import { User, Settings, LogOut, Wand2, CreditCard, Bell, ArrowLeft, LogIn } from 'lucide-react';
import useViewport from '~/lib/hooks';
import { classNames } from '~/utils/classNames';

interface ClientAuthProps {
  isSidebarCollapsed?: boolean;
}

export function ClientAuth({ isSidebarCollapsed }: ClientAuthProps) {
  const user = useStore(userStore);
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const stripeSubscription = useStore(subscriptionStore.subscription);
  const isSmallViewport = useViewport(800);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

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

  useEffect(() => {
    if (showDropdown && buttonRef.current && !isSmallViewport) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: buttonRect.top,
        left: buttonRect.left,
      });
    }
  }, [showDropdown, isSmallViewport]);

  const handleSignOut = async () => {
    try {
      await signOut();
      window.location.href = '/';
    } catch (error) {
      console.error('Sign out error:', error);
      toast.error('Failed to sign out');
    } finally {
      setShowDropdown(false);
    }
  };

  const handleShowAccountModal = () => {
    accountModalStore.open('account');
    if (window.analytics) {
      window.analytics.track('Clicked Account Settings button', {
        timestamp: new Date().toISOString(),
        userId: user?.id,
        email: user?.email,
      });
    }
    setShowDropdown(false);
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
    setShowDropdown(false);
  };

  return (
    <>
      {user ? (
        <div className="relative">
          <button
            ref={buttonRef}
            className="flex items-center justify-center w-10 h-10 rounded-full overflow-hidden transition-all duration-200 hover:ring-2 hover:ring-border shadow-md"
            onClick={() => setShowDropdown(!showDropdown)}
          >
            {user.user_metadata?.avatar_url ? (
              <img src={user.user_metadata.avatar_url} alt="User avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-muted flex items-center justify-center">
                <User size={20} className="text-muted-foreground" />
              </div>
            )}
          </button>

          {showDropdown && isSmallViewport && (
            /* Mobile: Full screen overlay below TopNav */
            <div
              ref={dropdownRef}
              className="fixed top-[55px] left-0 right-0 bottom-0 z-[200] flex flex-col p-1 bg-bolt-elements-background-depth-2"
            >
              <div className="w-full h-full border border-border rounded-md">
                {/* Header with back button */}
                <div className="flex items-center h-[60px] px-4 border-b border-border">
                  <button
                    onClick={() => setShowDropdown(false)}
                    className="h-9 w-9 flex items-center justify-center text-foreground"
                  >
                    <ArrowLeft size={20} />
                  </button>
                  <div className="w-px h-8 bg-border mx-2" />
                  <span className="font-semibold text-foreground">Account</span>
                </div>

                {/* User Info */}
                <div className="px-5 py-4 border-b border-border">
                  <div className="flex items-center gap-3">
                    {user.user_metadata?.avatar_url ? (
                      <img
                        src={user.user_metadata.avatar_url}
                        alt="User avatar"
                        className="w-12 h-12 rounded-full object-cover ring-2 ring-border"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                        <User size={24} className="text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-muted-foreground">Signed in as</div>
                      <div className="font-semibold text-foreground truncate">{user.email}</div>
                    </div>
                  </div>
                </div>

                {/* Menu Items */}
                <div className="flex-1 py-2">
                  {stripeSubscription?.tier !== 'builder' && (
                    <button
                      onClick={handleSubscriptionToggle}
                      className="w-full px-5 py-3 flex items-center gap-4 text-foreground hover:bg-accent transition-colors duration-150 border-b border-border"
                    >
                      <Wand2 size={20} className="text-muted-foreground" />
                      <span className="font-medium">Upgrade to Builder</span>
                    </button>
                  )}

                  <button
                    onClick={handleShowAccountModal}
                    className="w-full px-5 py-3 flex items-center gap-4 text-foreground hover:bg-accent transition-colors duration-150 border-b border-border"
                  >
                    <Settings size={20} className="text-muted-foreground" />
                    <span className="font-medium">Account settings</span>
                  </button>

                  <button
                    onClick={() => {
                      accountModalStore.open('billing');
                      setShowDropdown(false);
                    }}
                    className="w-full px-5 py-3 flex items-center gap-4 text-foreground hover:bg-accent transition-colors duration-150 border-b border-border"
                  >
                    <CreditCard size={20} className="text-muted-foreground" />
                    <span className="font-medium">Billing</span>
                  </button>

                  <button
                    onClick={() => {
                      // TODO: Open notifications panel
                      setShowDropdown(false);
                    }}
                    className="w-full px-5 py-3 flex items-center gap-4 text-foreground hover:bg-accent transition-colors duration-150 border-b border-border"
                  >
                    <Bell size={20} className="text-muted-foreground" />
                    <span className="font-medium">Notifications</span>
                  </button>

                  <button
                    onClick={handleSignOut}
                    className="w-full px-5 py-3 flex items-center gap-4 text-foreground hover:bg-accent transition-colors duration-150"
                  >
                    <LogOut size={20} className="text-muted-foreground" />
                    <span className="font-medium">Sign Out</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {showDropdown && !isSmallViewport && (
            /* Desktop: Dropdown menu */
            <div
              ref={dropdownRef}
              className="fixed w-64 bg-card border border-border rounded-md shadow-lg z-[9999]"
              style={{
                top: `${dropdownPosition.top}px`,
                left: `${dropdownPosition.left}px`,
                transform: 'translateY(calc(-100% - 12px))',
              }}
            >
              {/* User Header */}
              <div className="px-5 py-4 border-b border-border">
                <div className="flex items-center gap-3">
                  {user.user_metadata?.avatar_url ? (
                    <img
                      src={user.user_metadata.avatar_url}
                      alt="User avatar"
                      className="w-12 h-12 rounded-full object-cover ring-2 ring-border"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                      <User size={24} className="text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-muted-foreground">Signed in as</div>
                    <div className="font-semibold text-foreground truncate">{user.email}</div>
                  </div>
                </div>
              </div>

              {/* Menu Items */}
              <div className="py-2">
                {stripeSubscription?.tier !== 'builder' && (
                  <button
                    onClick={handleSubscriptionToggle}
                    className="w-full px-5 py-3 flex items-center gap-4 text-foreground hover:bg-accent transition-colors duration-150"
                  >
                    <Wand2 size={20} className="text-muted-foreground" />
                    <span className="font-medium">Upgrade to Builder</span>
                  </button>
                )}

                <button
                  onClick={handleShowAccountModal}
                  className="w-full px-5 py-3 flex items-center gap-4 text-foreground hover:bg-accent transition-colors duration-150"
                >
                  <Settings size={20} className="text-muted-foreground" />
                  <span className="font-medium">Account settings</span>
                </button>

                <button
                  onClick={() => {
                    accountModalStore.open('billing');
                    setShowDropdown(false);
                  }}
                  className="w-full px-5 py-3 flex items-center gap-4 text-foreground hover:bg-accent transition-colors duration-150"
                >
                  <CreditCard size={20} className="text-muted-foreground" />
                  <span className="font-medium">Billing</span>
                </button>

                <button
                  onClick={handleSignOut}
                  className="w-full px-5 py-3 flex items-center gap-4 text-foreground hover:bg-accent transition-colors duration-150"
                >
                  <LogOut size={20} className="text-muted-foreground" />
                  <span className="font-medium">Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={() => authModalStore.open(false)}
          className={classNames(
            'h-10 bg-rose-500 text-white rounded-full hover:from-rose-600 hover:to-pink-600 font-semibold transition-all duration-200 shadow-lg hover:shadow-xl border border-white/20 hover:border-white/30 group',
            isSidebarCollapsed ? 'w-full flex items-center justify-center' : 'w-full px-4 py-1.5',
          )}
        >
          <span className="transition-transform duration-200 flex items-center justify-center">
            {isSidebarCollapsed && !isSmallViewport ? <LogIn size={20} /> : 'Log In'}
          </span>
        </button>
      )}
    </>
  );
}
