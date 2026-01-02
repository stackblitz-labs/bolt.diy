import { useState } from 'react';
import { useAuth } from '~/lib/hooks/useAuth';
import { Button } from '~/components/ui/Button';
import * as RadixDropdown from '@radix-ui/react-dropdown-menu';
import { classNames } from '~/utils/classNames';
import { AuthModal } from './AuthModal';

export function UserMenu() {
  const { user, isAuthenticated, logout } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (!isAuthenticated || !user) {
    return (
      <>
        <Button
          variant="outline"
          onClick={() => {
            setAuthMode('login');
            setShowAuthModal(true);
          }}
        >
          Log in
        </Button>
        <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} initialMode={authMode} />
      </>
    );
  }

  return (
    <RadixDropdown.Root>
      <RadixDropdown.Trigger asChild>
        <Button variant="ghost" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-bolt-elements-borderColorActive flex items-center justify-center text-sm font-medium">
            {user.display_name?.[0]?.toUpperCase() || user.username[0]?.toUpperCase() || 'U'}
          </div>
          <span className="hidden sm:inline">{user.display_name || user.username}</span>
        </Button>
      </RadixDropdown.Trigger>

      <RadixDropdown.Portal>
        <RadixDropdown.Content
          className={classNames(
            'min-w-[200px] bg-bolt-elements-background rounded-md border border-bolt-elements-border p-1 shadow-lg',
            'z-50',
          )}
          align="end"
        >
          <div className="px-3 py-2 border-b border-bolt-elements-border">
            <p className="text-sm font-medium text-bolt-elements-textPrimary">{user.display_name || user.username}</p>
            <p className="text-xs text-bolt-elements-textSecondary">{user.email}</p>
          </div>

          <RadixDropdown.Item
            className={classNames(
              'px-3 py-2 text-sm rounded-md cursor-pointer',
              'hover:bg-bolt-elements-background-depth-1',
              'text-bolt-elements-textPrimary',
            )}
            onClick={handleLogout}
          >
            Log out
          </RadixDropdown.Item>
        </RadixDropdown.Content>
      </RadixDropdown.Portal>
    </RadixDropdown.Root>
  );
}
