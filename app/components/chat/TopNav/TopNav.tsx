import { useStore } from '@nanostores/react';
import { chatStore } from '~/lib/stores/chat';
import { workbenchStore } from '~/lib/stores/workbench';
import { ShareButton } from './ShareButton';
import { TopNavDownloadButton } from './TopNavDownloadButton';
import { TopNavDeployButton } from './TopNavDeployButton';
import { ArrowLeft, MoreHorizontal, Bug } from '~/components/ui/Icon';
import { Button } from '~/components/ui/button';
import { ClientAuth } from '~/components/auth/ClientAuth';
import useViewport from '~/lib/hooks';
import { ChatDescription } from '~/components/panels/SettingsPanel/components/ChatDescription.client';
import { DebugAppButton } from '~/components/ui/DebugControls';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { isAdmin } from '~/lib/utils';
import { userStore } from '~/lib/stores/auth';

export function TopNav() {
  const appId = useStore(chatStore.currentAppId);
  const repositoryId = useStore(workbenchStore.pendingRepositoryId);
  const isSmallViewport = useViewport(800);
  const user = useStore(userStore);
  const handleBack = () => {
    window.location.href = '/';
  };

  const showDebugButton = isAdmin(user) && appId;

  return (
    <nav className="flex items-center justify-between h-[60px] px-2 bg-bolt-elements-background-depth-2 gap-2">
      {/* Left section: Back button + Project title */}
      <div className="flex items-center gap-1 flex-1 min-w-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleBack}
          className="h-9 w-9 shrink-0 text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-3"
        >
          <ArrowLeft size={16} />
        </Button>

        {/* Separator */}
        <div className="w-px h-8 bg-bolt-elements-borderColor shrink-0" />
        <div className="flex-1 min-w-0 py-1">
          <ChatDescription />
        </div>
      </div>

      {/* Right section: Action buttons */}
      <div className="flex items-center gap-1 shrink-0">
        {isSmallViewport ? (
          /* Mobile: Dropdown menu */
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-3"
              >
                <MoreHorizontal size={16} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {showDebugButton && (
                <DropdownMenuItem
                  onClick={() => {
                    const url = `https://ui.honeycomb.io/replay/datasets/backend?query=${encodeURIComponent(
                      JSON.stringify({
                        time_range: 24 * 60 * 60,
                        granularity: 0,
                        breakdowns: [
                          'telemetry.category',
                          'telemetry.data.nut.job_kind',
                          'telemetry.data.error.errorBucket_start',
                        ],
                        calculations: [
                          { op: 'COUNT' },
                          { op: 'AVG', column: 'telemetry.data.success' },
                          { op: 'AVG', column: 'telemetry.data.fatal' },
                        ],
                        filters: [{ column: 'app', op: '=', value: appId }],
                        filter_combination: 'OR',
                        orders: [{ op: 'COUNT', order: 'descending' }],
                        havings: [],
                        limit: 100,
                      }),
                    )}`;
                    window.open(url, '_blank');
                  }}
                >
                  <Bug size={16} />
                  Open in Honeycomb
                </DropdownMenuItem>
              )}
              {appId && <ShareButton asMenuItem />}
              {repositoryId && <TopNavDownloadButton asMenuItem />}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          /* Desktop: Individual buttons */
          <>
            <DebugAppButton />
            {appId && <ShareButton />}
            {repositoryId && <TopNavDownloadButton />}
          </>
        )}
        {repositoryId && appId && <TopNavDeployButton />}
        {isSmallViewport && <ClientAuth />}
      </div>
    </nav>
  );
}
