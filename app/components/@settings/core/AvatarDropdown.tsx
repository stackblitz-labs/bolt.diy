import { useStore } from '@nanostores/react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { motion } from 'framer-motion';
import type { TabType, Profile } from './types';
import { DEFAULT_AVATAR, profileStore } from '~/lib/stores/profile';
import { classNames } from '~/utils/classNames';

interface AvatarDropdownProps {
  onSelectTab: (tab: TabType) => void;
  onOpenDocs: () => void;
}

export const AvatarDropdown = ({ onSelectTab, onOpenDocs }: AvatarDropdownProps) => {
  const profile = useStore(profileStore) as Profile;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <motion.button
          type="button"
          aria-label={`Open profile menu for ${profile?.username || 'Guest User'}`}
          className="flex h-12 w-full min-w-0 items-center justify-start gap-3 rounded-lg bg-transparent px-2 text-left transition-colors hover:bg-bolt-elements-background-depth-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <span className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-bolt-elements-background-depth-4 text-bolt-elements-textSecondary">
            <img
              src={profile?.avatar || DEFAULT_AVATAR}
              alt=""
              className="h-full w-full object-cover"
              loading="eager"
              decoding="sync"
            />
          </span>
          <span className="min-w-0 truncate text-sm font-medium text-bolt-elements-textPrimary">
            {profile?.username?.trim() || 'Guest User'}
          </span>
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
              <img
                src={profile?.avatar || DEFAULT_AVATAR}
                alt={profile?.username || 'Profile'}
                className={classNames('w-full h-full', 'object-cover', 'transform-gpu', 'image-rendering-crisp')}
                loading="eager"
                decoding="sync"
              />
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
            onClick={onOpenDocs}
          >
            <div className="i-ph:question w-4 h-4 text-gray-400 group-hover:text-purple-500 dark:group-hover:text-purple-400 transition-colors" />
            Help & Documentation
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};
