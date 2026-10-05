import type { Message } from 'ai';
import { memo, Fragment } from 'react';
import { Markdown } from './Markdown';
import { ToolInvocations } from './ToolInvocations';
import Popover from '~/components/ui/Popover';
import WithTooltip from '~/components/ui/Tooltip';
import {
  getMessageAnnotations,
  getMessageText,
  isToolPart,
  type AnyMessage,
  type AnyPart,
} from '~/lib/persistence/messageMigration';
import { workbenchStore } from '~/lib/stores/workbench';
import type { ToolCallAnnotation } from '~/types/context';
import type { ProviderInfo } from '~/types/model';
import { WORK_DIR } from '~/utils/constants';

interface AssistantMessageProps {
  content?: unknown;
  annotations?: unknown;
  messageId?: string;
  onRewind?: (messageId: string) => void;
  onFork?: (messageId: string) => void;
  append?: (message: Message) => void;
  chatMode?: 'discuss' | 'build';
  setChatMode?: (mode: 'discuss' | 'build') => void;
  model?: string;
  provider?: ProviderInfo;
  parts: AnyPart[] | undefined;
  addToolResult: ({ toolCallId, result }: { toolCallId: string; result: any }) => void;
}

function openArtifactInWorkbench(filePath: string) {
  filePath = normalizedFilePath(filePath);

  if (workbenchStore.currentView.get() !== 'code') {
    workbenchStore.currentView.set('code');
  }

  workbenchStore.setSelectedFile(`${WORK_DIR}/${filePath}`);
}

function normalizedFilePath(path: string) {
  let normalizedPath = path;

  if (normalizedPath.startsWith(WORK_DIR)) {
    normalizedPath = path.replace(WORK_DIR, '');
  }

  if (normalizedPath.startsWith('/')) {
    normalizedPath = normalizedPath.slice(1);
  }

  return normalizedPath;
}

export const AssistantMessage = memo(
  ({
    content,
    annotations,
    messageId,
    onRewind,
    onFork,
    append,
    chatMode,
    setChatMode,
    model,
    provider,
    parts,
    addToolResult,
  }: AssistantMessageProps) => {
    /*
     * Chat.client.tsx:649 deliberately replaces assistant `content` with the
     * parsed stream, where artifacts and actions have already been extracted.
     * So `content` wins when present and parts are only the fallback; swapping
     * the order would render raw <boltArtifact> tags into the bubble.
     */
    const messageText = typeof content === 'string' ? content : getMessageText({ parts });

    const filteredAnnotations = getMessageAnnotations({ annotations, parts } as AnyMessage);

    const chatSummaryAnnotation = filteredAnnotations.find((annotation) => annotation.type === 'chatSummary');
    const chatSummary: string | undefined = chatSummaryAnnotation?.summary;

    const codeContextAnnotation = filteredAnnotations.find((annotation) => annotation.type === 'codeContext');
    const codeContext: string[] | undefined = codeContextAnnotation?.files;

    const usageAnnotation = filteredAnnotations.find((annotation) => annotation.type === 'usage');

    const usage:
      | {
          completionTokens: number;
          promptTokens: number;
          totalTokens: number;
        }
      | undefined = usageAnnotation?.value as
      { completionTokens: number; promptTokens: number; totalTokens: number } | undefined;

    /*
     * Note the tool filter: `part.type === 'tool-invocation'` also type checks
     * against v5's `tool-${string}` discriminant, so it kept compiling while
     * silently returning an empty array once the discriminant changed, taking
     * the whole MCP panel with it. isToolPart matches both.
     */
    const toolInvocations = parts?.filter((part) => isToolPart(part));

    const toolCallAnnotations = filteredAnnotations.filter(
      (annotation) => annotation.type === 'toolCall',
    ) as ToolCallAnnotation[];

    return (
      <div className="overflow-hidden w-full">
        <>
          <div className=" flex gap-2 items-center text-sm text-bolt-elements-textSecondary mb-2">
            {(codeContext || chatSummary) && (
              <Popover side="right" align="start" trigger={<div className="i-ph:info" />}>
                {chatSummary && (
                  <div className="max-w-chat">
                    <div className="summary max-h-96 flex flex-col">
                      <h2 className="border border-bolt-elements-borderColor rounded-md p4">Summary</h2>
                      <div style={{ zoom: 0.7 }} className="overflow-y-auto m4">
                        <Markdown>{chatSummary}</Markdown>
                      </div>
                    </div>
                    {codeContext && (
                      <div className="code-context flex flex-col p4 border border-bolt-elements-borderColor rounded-md">
                        <h2>Context</h2>
                        <div className="flex gap-4 mt-4 bolt" style={{ zoom: 0.6 }}>
                          {codeContext.map((x) => {
                            const normalized = normalizedFilePath(x);
                            return (
                              <Fragment key={normalized}>
                                <code
                                  className="bg-bolt-elements-artifacts-inlineCode-background text-bolt-elements-artifacts-inlineCode-text px-1.5 py-1 rounded-md text-bolt-elements-item-contentAccent hover:underline cursor-pointer"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    openArtifactInWorkbench(normalized);
                                  }}
                                >
                                  {normalized}
                                </code>
                              </Fragment>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div className="context"></div>
              </Popover>
            )}
            <div className="flex w-full items-center justify-between">
              {usage && (
                <div>
                  Tokens: {usage.totalTokens} (prompt: {usage.promptTokens}, completion: {usage.completionTokens})
                </div>
              )}
              {(onRewind || onFork) && messageId && (
                <div className="flex gap-2 flex-col lg:flex-row ml-auto">
                  {onRewind && (
                    <WithTooltip tooltip="Revert to this message">
                      <button
                        onClick={() => onRewind(messageId)}
                        key="i-ph:arrow-u-up-left"
                        className="i-ph:arrow-u-up-left text-xl text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors"
                      />
                    </WithTooltip>
                  )}
                  {onFork && (
                    <WithTooltip tooltip="Fork chat from this message">
                      <button
                        onClick={() => onFork(messageId)}
                        key="i-ph:git-fork"
                        className="i-ph:git-fork text-xl text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors"
                      />
                    </WithTooltip>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
        <Markdown append={append} chatMode={chatMode} setChatMode={setChatMode} model={model} provider={provider} html>
          {messageText}
        </Markdown>
        {toolInvocations && toolInvocations.length > 0 && (
          <ToolInvocations
            toolInvocations={toolInvocations}
            toolCallAnnotations={toolCallAnnotations}
            addToolResult={addToolResult}
          />
        )}
      </div>
    );
  },
);
