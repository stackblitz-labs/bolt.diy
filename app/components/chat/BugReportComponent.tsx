import { TooltipProvider } from '@radix-ui/react-tooltip';
import { motion } from 'framer-motion';
import WithTooltip from '~/components/ui/Tooltip';
import type { BugReport } from '~/lib/persistence/messageAppSummary';
import { BugReportStatus } from '~/lib/persistence/messageAppSummary';
import { chatStore, onChatResponse } from '~/lib/stores/chat';
import { toast } from 'react-toastify';
import { formatPascalCaseName } from '~/utils/names';
import { callNutAPI } from '~/lib/replay/NutAPI';
import type { ChatMessageParams } from './ChatComponent/components/ChatImplementer/ChatImplementer';
import { ChatMode } from '~/lib/replay/SendChatMessage';

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
    <motion.div
      className="bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-xl p-4 mb-3 mx-4 mt-3"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 bg-red-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
          <div className="i-ph:bug text-red-500 text-lg"></div>
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
                    <div className="i-ph:check-circle text-base"></div>
                  </button>
                </WithTooltip>
              </TooltipProvider>

              <TooltipProvider>
                <WithTooltip tooltip="Retry fixing this bug">
                  <button
                    onClick={handleRetry}
                    className="w-7 h-7 flex items-center justify-center bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-lg transition-all duration-200 hover:scale-110 border border-blue-500/20 hover:border-blue-500/30"
                  >
                    <div className="i-ph:arrow-clockwise text-base"></div>
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
                    <div className="i-ph:hourglass text-bolt-elements-textSecondary text-base"></div>
                  ) : (
                    <div className="i-ph:spinner text-bolt-elements-textSecondary text-base animate-spin"></div>
                  )}
                </div>
              </WithTooltip>
            </TooltipProvider>
          )}

          {status === BugReportStatus.Resolved && (
            <TooltipProvider>
              <WithTooltip tooltip="Bug resolved">
                <div className="w-7 h-7 flex items-center justify-center bg-green-500/10 text-green-600 dark:text-green-400 rounded-lg border border-green-500/20">
                  <div className="i-ph:check text-base"></div>
                </div>
              </WithTooltip>
            </TooltipProvider>
          )}

          {status === BugReportStatus.Failed && (
            <TooltipProvider>
              <WithTooltip tooltip="Fix failed">
                <div className="w-7 h-7 flex items-center justify-center bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg border border-red-500/20">
                  <div className="i-ph:x text-base"></div>
                </div>
              </WithTooltip>
            </TooltipProvider>
          )}
        </div>
      </div>
    </motion.div>
  );
};
