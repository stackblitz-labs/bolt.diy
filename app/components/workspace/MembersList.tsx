import { useWorkspace } from '~/lib/hooks/useWorkspace';
import { classNames } from '~/utils/classNames';

export function MembersList() {
  const { members, currentWorkspace } = useWorkspace();
  const owner = currentWorkspace?.owner_id;

  if (!members || members.length === 0) {
    return (
      <div className="p-4 text-center text-bolt-elements-textSecondary">
        <p className="text-sm">No members yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {members.map((member) => (
        <div
          key={member.id}
          className={classNames(
            'flex items-center justify-between p-3 rounded-lg',
            'bg-bolt-elements-background-depth-1 border border-bolt-elements-border',
          )}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-bolt-elements-borderColorActive flex items-center justify-center text-sm font-medium">
              {member.user?.display_name?.[0]?.toUpperCase() || member.user?.username[0]?.toUpperCase() || 'U'}
            </div>
            <div>
              <p className="text-sm font-medium text-bolt-elements-textPrimary">
                {member.user?.display_name || member.user?.username || 'Unknown'}
                {owner === member.user_id && (
                  <span className="ml-2 text-xs text-bolt-elements-textSecondary">(Owner)</span>
                )}
              </p>
              <p className="text-xs text-bolt-elements-textSecondary">{member.user?.email}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
