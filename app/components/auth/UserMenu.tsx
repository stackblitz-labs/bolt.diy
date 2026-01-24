/**
 * User Menu Component
 *
 * Displays authenticated user information with dropdown menu.
 * Uses Better Auth's useSession hook for reactive session state.
 *
 * Based on specs/002-better-auth/tasks.md (T014)
 */

import { useSession, signOut } from '~/lib/auth/auth.client';
import { useNavigate } from '@remix-run/react';
import { useState, useEffect, useRef } from 'react';

import { classNames } from '~/utils/classNames';

interface UserMenuProps {
  className?: string;
}

/**
 * User Menu Component
 *
 * Shows user avatar, name, and dropdown menu when authenticated.
 * Shows sign-in link when not authenticated.
 */
export function UserMenu({ className }: UserMenuProps) {
  const { data: session, isPending } = useSession();
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  // Loading state
  if (isPending) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200" />
        <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
      </div>
    );
  }

  // Not authenticated
  if (!session) {
    return (
      <a href="/auth/login" className="text-sm font-medium text-gray-700 hover:text-gray-900">
        Sign in
      </a>
    );
  }

  // Authenticated - show user info with dropdown
  const handleSignOut = async () => {
    await signOut({
      fetchOptions: {
        onSuccess: () => {
          navigate('/');
        },
      },
    });
  };

  // Get user initials for avatar
  const getInitials = (name?: string | null, email?: string | null) => {
    if (name) {
      const parts = name.split(' ');

      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      }

      return name.substring(0, 2).toUpperCase();
    }

    if (email) {
      return email.substring(0, 2).toUpperCase();
    }

    return 'U';
  };

  const initials = getInitials(session.user.name, session.user.email);
  const displayName = session.user.name || session.user.email || 'User';

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className={classNames(
          'flex items-center gap-3 px-3 py-2 rounded-lg transition-all focus:outline-none',
          className ? className : 'hover:bg-bolt-elements-background-depth-2',
        )}
        type="button"
      >
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-sm font-semibold text-bolt-elements-textPrimary whitespace-nowrap">{displayName}</div>
            <div className="text-xs text-bolt-elements-textSecondary whitespace-nowrap">Premium Plan</div>
          </div>
          {session.user.image ? (
            <img
              src={session.user.image}
              alt={displayName}
              className="h-10 w-10 rounded-full border-2 border-bolt-elements-borderColor flex-shrink-0"
            />
          ) : (
            <div className="h-10 w-10 rounded-full bg-bolt-elements-button-primary-background border-2 border-bolt-elements-button-primary-background flex items-center justify-center text-bolt-elements-button-primary-text font-bold text-sm flex-shrink-0">
              {initials}
            </div>
          )}
        </div>
      </button>

      {/* Dropdown Menu */}
      {isDropdownOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-bolt-elements-background-depth-1 rounded-lg shadow-xl border border-bolt-elements-borderColor py-1 z-50">
          <div className="px-4 py-3 border-b border-bolt-elements-borderColor">
            <div className="flex items-center gap-3">
              {session.user.image ? (
                <img
                  src={session.user.image}
                  alt={displayName}
                  className="h-12 w-12 rounded-full border-2 border-bolt-elements-borderColor flex-shrink-0"
                />
              ) : (
                <div className="h-12 w-12 rounded-full bg-bolt-elements-button-primary-background border-2 border-bolt-elements-button-primary-background flex items-center justify-center text-bolt-elements-button-primary-text font-bold text-base flex-shrink-0">
                  {initials}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-bolt-elements-textPrimary truncate">{displayName}</div>
                <div className="text-xs text-bolt-elements-textSecondary mt-0.5">Premium Plan</div>
              </div>
            </div>
          </div>
          <div className="py-1">
            <button
              onClick={handleSignOut}
              className="w-full text-left px-4 py-2.5 text-sm font-medium text-bolt-elements-textPrimary bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-background-depth-3 flex items-center gap-3 transition-colors group"
              type="button"
            >
              <div className="i-ph:sign-out-bold text-lg text-bolt-elements-textSecondary group-hover:text-red-500 transition-colors" />
              <span className="group-hover:text-red-500 transition-colors">Logout</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
