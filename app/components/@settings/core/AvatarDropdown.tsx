import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { motion } from 'framer-motion';
import { useStore } from '@nanostores/react';
import { classNames } from '~/utils/classNames';
import { profileStore } from '~/lib/stores/profile';
import type { TabType, Profile } from './types';

interface AvatarDropdownProps {
  onSelectTab: (tab: TabType) => void;
}

export const AvatarDropdown = ({ onSelectTab }: AvatarDropdownProps) => {
  const profile = useStore(profileStore) as Profile;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <motion.button
          className="w-10 h-10 rounded-full bg-transparent flex items-center justify-center focus:outline-none"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {profile?.avatar ? (
            <img
              src={profile.avatar}
              alt={profile?.username || 'Profile'}
              className="w-full h-full rounded-full object-cover"
              loading="eager"
              decoding="sync"
            />
          ) : (
            <div className="w-full h-full rounded-full flex items-center justify-center bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-500">
              <div className="i-ph:user w-6 h-6" />
            </div>
          )}
        </motion.button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={classNames(
            'min-w-[240px] z-[250]',
            'bg-white dark:bg-[#141414]',
            'rounded-lg shadow-lg',
            'border border-gray-200/50 dark:border-gray-800/50',
            'animate-in fade-in-0 zoom-in-95',
            'py-1',
          )}
          sideOffset={5}
          align="end"
        >
          <div
            className={classNames(
              'px-4 py-3 flex items-center gap-3',
              'border-b border-gray-200/50 dark:border-gray-800/50',
            )}
          >
            <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-white dark:bg-gray-800 shadow-sm">
              {profile?.avatar ? (
                <img
                  src={profile.avatar}
                  alt={profile?.username || 'Profile'}
                  className={classNames('w-full h-full', 'object-cover', 'transform-gpu', 'image-rendering-crisp')}
                  loading="eager"
                  decoding="sync"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500 font-medium text-lg">
                  <div className="i-ph:user w-6 h-6" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm text-gray-900 dark:text-white truncate">
                {profile?.username || 'Guest User'}
              </div>
              {profile?.bio && <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{profile.bio}</div>}
            </div>
          </div>

          <DropdownMenu.Item
            className={classNames(
              'flex items-center gap-2 px-4 py-2.5',
              'text-sm text-gray-700 dark:text-gray-200',
              'hover:bg-purple-50 dark:hover:bg-purple-500/10',
              'hover:text-purple-500 dark:hover:text-purple-400',
              'cursor-pointer transition-all duration-200',
              'outline-none',
              'group',
            )}
            onClick={() => onSelectTab('profile')}
          >
            <div className="i-ph:user-circle w-4 h-4 text-gray-400 group-hover:text-purple-500 dark:group-hover:text-purple-400 transition-colors" />
            Edit Profile
          </DropdownMenu.Item>

          <DropdownMenu.Item
            className={classNames(
              'flex items-center gap-2 px-4 py-2.5',
              'text-sm text-gray-700 dark:text-gray-200',
              'hover:bg-purple-50 dark:hover:bg-purple-500/10',
              'hover:text-purple-500 dark:hover:text-purple-400',
              'cursor-pointer transition-all duration-200',
              'outline-none',
              'group',
            )}
            onClick={() => onSelectTab('settings')}
          >
            <div className="i-ph:gear-six w-4 h-4 text-gray-400 group-hover:text-purple-500 dark:group-hover:text-purple-400 transition-colors" />
            Settings
          </DropdownMenu.Item>

          <div className="my-1 border-t border-gray-200/50 dark:border-gray-800/50" />

          <DropdownMenu.Item
            className={classNames(
              'flex items-center gap-2 px-4 py-2.5',
              'text-sm text-gray-700 dark:text-gray-200',
              'hover:bg-purple-50 dark:hover:bg-purple-500/10',
              'hover:text-purple-500 dark:hover:text-purple-400',
              'cursor-pointer transition-all duration-200',
              'outline-none',
              'group',
            )}
            onClick={() =>
              window.open('https://github.com/stackblitz-labs/bolt.diy/issues/new?template=bug_report.yml', '_blank')
            }
          >
            <div className="i-ph:bug w-4 h-4 text-gray-400 group-hover:text-purple-500 dark:group-hover:text-purple-400 transition-colors" />
            Report Bug
          </DropdownMenu.Item>

          <DropdownMenu.Item
            className={classNames(
              'flex items-center gap-2 px-4 py-2.5',
              'text-sm text-gray-700 dark:text-gray-200',
              'hover:bg-purple-50 dark:hover:bg-purple-500/10',
              'hover:text-purple-500 dark:hover:text-purple-400',
              'cursor-pointer transition-all duration-200',
              'outline-none',
              'group',
            )}
            onClick={async () => {
              try {
                const { downloadDebugLog } = await import('~/utils/debugLogger');
                await downloadDebugLog();
              } catch (error) {
                console.error('Failed to download debug log:', error);
              }
            }}
          >
            <div className="i-ph:download w-4 h-4 text-gray-400 group-hover:text-purple-500 dark:group-hover:text-purple-400 transition-colors" />
            Download Debug Log
          </DropdownMenu.Item>

          <DropdownMenu.Item
            className={classNames(
              'flex items-center gap-2 px-4 py-2.5',
              'text-sm text-gray-700 dark:text-gray-200',
              'hover:bg-purple-50 dark:hover:bg-purple-500/10',
              'hover:text-purple-500 dark:hover:text-purple-400',
              'cursor-pointer transition-all duration-200',
              'outline-none',
              'group',
            )}
            onClick={() => window.open('https://stackblitz-labs.github.io/bolt.diy/', '_blank')}
          >
            <div className="i-ph:question w-4 h-4 text-gray-400 group-hover:text-purple-500 dark:group-hover:text-purple-400 transition-colors" />
            Help & Documentation
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};
