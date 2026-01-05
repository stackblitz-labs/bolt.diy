import { useChatPresence } from '~/lib/hooks/useChatPresence';
import { useAuth } from '~/lib/hooks/useAuth';
import { classNames } from '~/utils/classNames';

export function ActiveUsers() {
  const { activeUsers } = useChatPresence();
  const { user } = useAuth();

  if (activeUsers.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 dark:border-gray-800">
      <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
        <span className="i-ph:users h-3 w-3" />
        <span>Active:</span>
      </div>
      <div className="flex items-center gap-2">
        {activeUsers.map((activeUser) => {
          const isCurrentUser = activeUser.id === user?.id;

          return (
            <div
              key={activeUser.id}
              className={classNames(
                'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs',
                'bg-gray-100 dark:bg-gray-800',
                activeUser.status === 'editing' && 'ring-2 ring-purple-500/50',
                isCurrentUser && 'ring-1 ring-blue-500/50 bg-blue-50 dark:bg-blue-900/20',
              )}
              title={`${activeUser.display_name || activeUser.username} - ${activeUser.status}${isCurrentUser ? ' (You)' : ''}`}
            >
              <div className="relative">
                <div
                  className={classNames(
                    'w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium',
                    isCurrentUser ? 'bg-blue-500' : 'bg-purple-500',
                  )}
                >
                  {(activeUser.display_name || activeUser.username)[0]?.toUpperCase() || 'U'}
                </div>
                {activeUser.status === 'editing' && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-purple-500 rounded-full border-2 border-white dark:border-gray-900" />
                )}
              </div>
              <span className="text-gray-700 dark:text-gray-300">
                {activeUser.display_name || activeUser.username}
                {isCurrentUser && ' (You)'}
              </span>
              {activeUser.status === 'editing' && <span className="i-ph:pencil-fill h-3 w-3 text-purple-500" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
