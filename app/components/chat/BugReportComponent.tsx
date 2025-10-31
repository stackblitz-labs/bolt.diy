import { TooltipProvider } from '@radix-ui/react-tooltip';
import WithTooltip from '~/components/ui/Tooltip';
import type { BugReport } from '~/lib/persistence/messageAppSummary';
import { BugReportStatus } from '~/lib/persistence/messageAppSummary';
import { chatStore, onChatResponse } from '~/lib/stores/chat';
import { toast } from 'react-toastify';
import { formatPascalCaseName } from '~/utils/names';
import { callNutAPI } from '~/lib/replay/NutAPI';
import type { ChatMessageParams } from './ChatComponent/components/ChatImplementer/ChatImplementer';
import { ChatMode } from '~/lib/replay/SendChatMessage';
import { Bug, CheckCircle, RotateCw, Hourglass, Loader2, Check, X } from '~/components/ui/Icon';

interface BugReportComponentProps {
  report: BugReport;
  handleSendMessage: (params: ChatMessageParams) => void;
}

export const BugReportComponent = ({ report, handleSendMessage }: BugReportComponentProps) => {
  const handleResolve = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const appId = chatStore.currentAppId.get();
    if (!appId) {
      toast.error('No app selected');
      return;
    }

    const { response } = await callNutAPI('resolve-bug-report', { appId, bugReportName: report.name });
    if (response) {
      onChatResponse(response, 'ResolveBugReport');
    }
  };

  const handleRetry = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const appId = chatStore.currentAppId.get();
    if (!appId) {
      toast.error('No app selected');
      return;
    }

    handleSendMessage({
      messageInput: `Retry fixing bug report "${formatPascalCaseName(report.name)}".`,
      chatMode: ChatMode.UserMessage,
      retryBugReportName: report.name,
    });
  };

  const { status, escalateTime } = report;

  return (
    <TooltipProvider>
      <div className="flex items-center gap-4 p-4 rounded-xl w-full h-full">
        <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-lg bg-red-500/10 border border-red-500/20">
          <Bug className="text-red-500" size={20} />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-bolt-elements-textHeading mb-1.5">
            {formatPascalCaseName(report.name)}
          </h3>
          <p className="text-sm text-bolt-elements-textSecondary leading-relaxed">{report.description}</p>
        </div>

        <div className="flex flex-col items-center justify-center h-full gap-2 flex-shrink-0">
          {status === BugReportStatus.WaitingForFeedback && (
            <>
              <WithTooltip tooltip="Mark this bug as fixed">
                <button
                  onClick={(e) => handleResolve(e)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-600 dark:text-green-400 transition-colors border border-green-500/20 hover:border-green-500/40 active:scale-95"
                >
                  <CheckCircle size={18} />
                </button>
              </WithTooltip>

              <WithTooltip tooltip="Retry fixing this bug">
                <button
                  onClick={(e) => handleRetry(e)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 transition-colors border border-blue-500/20 hover:border-blue-500/40 active:scale-95"
                >
                  <RotateCw size={18} />
                </button>
              </WithTooltip>
            </>
          )}

          {status === BugReportStatus.Open && (
            <WithTooltip tooltip={escalateTime ? 'Escalated to developer support' : 'Fixing in progress'}>
              <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor">
                {escalateTime ? (
                  <Hourglass className="text-bolt-elements-textSecondary" size={18} />
                ) : (
                  <Loader2 className="text-bolt-elements-textSecondary animate-spin" size={18} />
                )}
              </div>
            </WithTooltip>
          )}

          {status === BugReportStatus.Resolved && (
            <WithTooltip tooltip="Bug resolved">
              <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20">
                <Check size={18} />
              </div>
            </WithTooltip>
          )}

          {status === BugReportStatus.Failed && (
            <WithTooltip tooltip="Fix failed">
              <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                <X size={18} />
              </div>
            </WithTooltip>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
};
