import { useState, useRef, useEffect } from 'react';
import { useNavigate } from '@remix-run/react';
import { useStore } from '@nanostores/react';
import { authStore, logout } from '~/lib/stores/auth';
import { motion, AnimatePresence } from 'framer-motion';
import { classNames } from '~/utils/classNames';

export function UserMenu() {
  const navigate = useNavigate();
  const authState = useStore(authStore);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/auth');
  };

  const handleManageUsers = () => {
    setIsOpen(false);
    navigate('/admin/users');
  };

  const handleSettings = () => {
    setIsOpen(false);

    // Open settings modal or navigate to settings
  };

  if (!authState.isAuthenticated || !authState.user) {
    return null;
  }

  return (
    <div ref={menuRef} className="relative">
      {/* User Avatar Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={classNames(
          'flex items-center gap-2 px-3 py-2 rounded-lg',
          'hover:bg-bolt-elements-background-depth-2',
          'transition-colors',
        )}
      >
        <div className="w-8 h-8 rounded-full bg-bolt-elements-background-depth-2 flex items-center justify-center overflow-hidden border border-bolt-elements-borderColor">
          {authState.user.avatar ? (
            <img src={authState.user.avatar} alt={authState.user.firstName} className="w-full h-full object-cover" />
          ) : (
            <span className="text-sm font-medium text-bolt-elements-textPrimary">
              {authState.user.firstName[0].toUpperCase()}
            </span>
          )}
        </div>
        <div className="text-left hidden sm:block">
          <p className="text-sm font-medium text-bolt-elements-textPrimary">{authState.user.firstName}</p>
          <p className="text-xs text-bolt-elements-textSecondary">@{authState.user.username}</p>
        </div>
        <span
          className={classNames(
            'i-ph:caret-down text-bolt-elements-textSecondary transition-transform',
            isOpen ? 'rotate-180' : '',
          )}
        />
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className={classNames(
              'absolute right-0 mt-2 w-64',
              'bg-bolt-elements-background-depth-1',
              'border border-bolt-elements-borderColor',
              'rounded-lg shadow-lg',
              'overflow-hidden',
              'z-50',
            )}
          >
            {/* User Info */}
            <div className="p-4 border-b border-bolt-elements-borderColor">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-bolt-elements-background-depth-2 flex items-center justify-center overflow-hidden border border-bolt-elements-borderColor">
                  {authState.user.avatar ? (
                    <img
                      src={authState.user.avatar}
                      alt={authState.user.firstName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-lg font-medium text-bolt-elements-textPrimary">
                      {authState.user.firstName[0].toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-bolt-elements-textPrimary">{authState.user.firstName}</p>
                  <p className="text-sm text-bolt-elements-textSecondary">@{authState.user.username}</p>
                </div>
              </div>
            </div>

            {/* Menu Items */}
            <div className="py-2">
              <button
                onClick={handleSettings}
                className={classNames(
                  'w-full px-4 py-2 text-left',
                  'text-sm text-bolt-elements-textPrimary',
                  'hover:bg-bolt-elements-background-depth-2',
                  'transition-colors',
                  'flex items-center gap-3',
                )}
              >
                <span className="i-ph:gear text-lg" />
                <span>Settings</span>
              </button>

              <button
                onClick={handleManageUsers}
                className={classNames(
                  'w-full px-4 py-2 text-left',
                  'text-sm text-bolt-elements-textPrimary',
                  'hover:bg-bolt-elements-background-depth-2',
                  'transition-colors',
                  'flex items-center gap-3',
                )}
              >
                <span className="i-ph:users text-lg" />
                <span>Manage Users</span>
              </button>

              <div className="my-1 border-t border-bolt-elements-borderColor" />

              <button
                onClick={handleLogout}
                className={classNames(
                  'w-full px-4 py-2 text-left',
                  'text-sm text-red-500',
                  'hover:bg-red-500/10',
                  'transition-colors',
                  'flex items-center gap-3',
                )}
              >
                <span className="i-ph:sign-out text-lg" />
                <span>Sign Out</span>
              </button>
            </div>

            {/* Footer */}
            <div className="px-4 py-2 bg-bolt-elements-background-depth-2 border-t border-bolt-elements-borderColor">
              <p className="text-xs text-bolt-elements-textTertiary">
                Member since {new Date(authState.user.createdAt).toLocaleDateString()}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
