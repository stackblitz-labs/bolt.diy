import { useState, useRef, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { userStore, signOut } from '~/lib/stores/auth';
import { subscriptionStore } from '~/lib/stores/subscriptionStatus';
import { accountModalStore } from '~/lib/stores/accountModal';
import { themeStore, setTheme } from '~/lib/stores/theme';
import { User, Settings, LogOut, Crown } from '~/components/ui/Icon';
import { Monitor, Sun, Moon } from 'lucide-react';
import { toast } from 'react-toastify';
import { classNames } from '~/utils/classNames';

export function UserProfileMenu() {
  const user = useStore(userStore);
  const stripeSubscription = useStore(subscriptionStore.subscription);
  const theme = useStore(themeStore);
  const [showDropdown, setShowDropdown] = useState(false);
  const [domLoaded, setDomLoaded] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setDomLoaded(true);
  }, []);

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
    setShowDropdown(false);
  };

  if (!user) {
    return null;
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-green-500 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 border-2 border-white/20 hover:border-white/30 group"
        onClick={() => setShowDropdown(!showDropdown)}
      >
        <User size={18} />
      </button>

      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute bottom-full left-0 mb-2 py-3 w-64 bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-xl shadow-2xl z-[100]"
        >
          <div className="px-4 py-3 border-b border-bolt-elements-borderColor">
            <div className="text-xs text-bolt-elements-textSecondary mb-1">Signed in as</div>
            <div className="font-medium text-bolt-elements-textPrimary truncate text-sm">{user.email}</div>
          </div>

          {stripeSubscription && (
            <div className="px-4 py-3 border-b border-bolt-elements-borderColor">
              <div className="flex items-center gap-2">
                <Crown className="text-blue-600" size={16} />
                <span className="text-bolt-elements-textPrimary font-medium text-sm">
                  {`${stripeSubscription.tier.charAt(0).toUpperCase() + stripeSubscription.tier.slice(1)} Plan`}
                </span>
              </div>
            </div>
          )}

          {domLoaded && (
            <div className="px-4 py-3 border-b border-bolt-elements-borderColor">
              <div className="text-xs text-bolt-elements-textSecondary mb-2">Theme</div>
              <div className="flex items-center justify-between gap-2">
                {[
                  { value: 'system' as const, icon: Monitor, label: 'System' },
                  { value: 'light' as const, icon: Sun, label: 'Light' },
                  { value: 'dark' as const, icon: Moon, label: 'Dark' },
                ].map(({ value, icon: Icon, label }) => {
                  const isSelected = theme === value;
                  return (
                    <button
                      key={value}
                      onClick={() => setTheme(value)}
                      className={classNames(
                        'flex flex-1 items-center justify-center h-10 rounded-lg transition-all duration-200',
                        'focus:outline-none focus:ring-2 focus:ring-bolt-elements-focus focus:ring-offset-1',
                        isSelected
                          ? 'bg-bolt-elements-background-depth-3 shadow-sm'
                          : 'bg-transparent hover:bg-bolt-elements-background-depth-2',
                      )}
                      title={label}
                      aria-label={`Set theme to ${label}`}
                    >
                      <Icon
                        size={20}
                        className={classNames(
                          'stroke-[1.5]',
                          isSelected ? 'text-bolt-elements-textPrimary' : 'text-bolt-elements-textSecondary',
                        )}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="p-2 space-y-1">
            <button
              onClick={handleShowAccountModal}
              className="w-full px-4 py-2 bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-3 hover:text-bolt-elements-textPrimary rounded-lg transition-all duration-200 flex items-center gap-3 font-medium text-sm"
            >
              <Settings size={16} />
              <span>Account Settings</span>
            </button>

            <button
              onClick={handleSignOut}
              className="w-full px-4 py-2 bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-3 hover:text-bolt-elements-textPrimary rounded-lg transition-all duration-200 flex items-center gap-3 font-medium text-sm"
            >
              <LogOut size={16} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
