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
  handleSendMessage?: (params: ChatMessageParams) => void;
}

export const BugReportComponent = ({ report, handleSendMessage }: BugReportComponentProps) => {
  const handleResolve = async () => {
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

  const handleRetry = async () => {
    const appId = chatStore.currentAppId.get();
    if (!appId) {
      toast.error('No app selected');
      return;
    }

    handleSendMessage?.({
      messageInput: `Retry fixing bug report "${formatPascalCaseName(report.name)}".`,
      chatMode: ChatMode.UserMessage,
      retryBugReportName: report.name,
    });
  };

  const { status, escalateTime } = report;

  return (
    <div>
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 bg-red-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
          <Bug className="text-red-500" size={18} />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-bolt-elements-textPrimary mb-1">
            {formatPascalCaseName(report.name)}
          </h3>
          <p className="text-sm text-bolt-elements-textSecondary">{report.description}</p>
        </div>

        <div className="flex flex-col gap-2 flex-shrink-0">
          {status === BugReportStatus.WaitingForFeedback && (
            <>
              <TooltipProvider>
                <WithTooltip tooltip="Mark this bug as fixed">
                  <button
                    onClick={handleResolve}
                    className="w-7 h-7 flex items-center justify-center bg-green-500/10 hover:bg-green-500/20 text-green-600 dark:text-green-400 rounded-lg transition-all duration-200 hover:scale-110 border border-green-500/20 hover:border-green-500/30"
                  >
                    <CheckCircle size={16} />
                  </button>
                </WithTooltip>
              </TooltipProvider>

              <TooltipProvider>
                <WithTooltip tooltip="Retry fixing this bug">
                  <button
                    onClick={handleRetry}
                    className="w-7 h-7 flex items-center justify-center bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-lg transition-all duration-200 hover:scale-110 border border-blue-500/20 hover:border-blue-500/30"
                  >
                    <RotateCw size={16} />
                  </button>
                </WithTooltip>
              </TooltipProvider>
            </>
          )}

          {status === BugReportStatus.Open && (
            <TooltipProvider>
              <WithTooltip tooltip={escalateTime ? 'Escalated to developer support' : 'Fixing in progress'}>
                <div className="w-7 h-7 flex items-center justify-center">
                  {escalateTime ? (
                    <Hourglass className="text-bolt-elements-textSecondary" size={16} />
                  ) : (
                    <Loader2 className="text-bolt-elements-textSecondary animate-spin" size={16} />
                  )}
                </div>
              </WithTooltip>
            </TooltipProvider>
          )}

          {status === BugReportStatus.Resolved && (
            <TooltipProvider>
              <WithTooltip tooltip="Bug resolved">
                <div className="w-7 h-7 flex items-center justify-center bg-green-500/10 text-green-600 dark:text-green-400 rounded-lg border border-green-500/20">
                  <Check size={16} />
                </div>
              </WithTooltip>
            </TooltipProvider>
          )}

          {status === BugReportStatus.Failed && (
            <TooltipProvider>
              <WithTooltip tooltip="Fix failed">
                <div className="w-7 h-7 flex items-center justify-center bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg border border-red-500/20">
                  <X size={16} />
                </div>
              </WithTooltip>
            </TooltipProvider>
          )}
        </div>
      </div>
    </div>
  );
};
