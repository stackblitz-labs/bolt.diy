import { memo, Fragment } from 'react';
import { Markdown } from './Markdown';
import type { JSONValue } from 'ai';
import Popover from '~/components/ui/Popover';
import { workbenchStore } from '~/lib/stores/workbench';
import { WORK_DIR } from '~/utils/constants';
import WithTooltip from '~/components/ui/Tooltip';
import type { Message } from 'ai';
import type { ProviderInfo } from '~/types/model';
import type {
  TextUIPart,
  ReasoningUIPart,
  ToolInvocationUIPart,
  SourceUIPart,
  FileUIPart,
  StepStartUIPart,
} from '@ai-sdk/ui-utils';
import { ToolInvocations } from './ToolInvocations';
import type { ToolCallAnnotation } from '~/types/context';

interface AssistantMessageProps {
  content: string;
  annotations?: JSONValue[];
  messageId?: string;
  onRewind?: (messageId: string) => void;
  onFork?: (messageId: string) => void;
  append?: (message: Message) => void;
  chatMode?: 'discuss' | 'build';
  setChatMode?: (mode: 'discuss' | 'build') => void;
  model?: string;
  provider?: ProviderInfo;
  parts:
    | (TextUIPart | ReasoningUIPart | ToolInvocationUIPart | SourceUIPart | FileUIPart | StepStartUIPart)[]
    | undefined;
  addToolResult: ({ toolCallId, result }: { toolCallId: string; result: any }) => void;
  timestamp?: Date;
}

function formatTime(date?: Date): string {
  if (!date) {
    return '';
  }

  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function AiAvatar() {
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-md text-white"
      style={{ background: 'var(--bolt-brand-gradient)' }}
    >
      <div className="i-ph:robot text-sm" />
    </div>
  );
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
    timestamp,
  }: AssistantMessageProps) => {
    const filteredAnnotations = (annotations?.filter(
      (annotation: JSONValue) =>
        annotation && typeof annotation === 'object' && Object.keys(annotation).includes('type'),
    ) || []) as { type: string; value: any } & { [key: string]: any }[];

    let chatSummary: string | undefined = undefined;

    if (filteredAnnotations.find((annotation) => annotation.type === 'chatSummary')) {
      chatSummary = filteredAnnotations.find((annotation) => annotation.type === 'chatSummary')?.summary;
    }

    let codeContext: string[] | undefined = undefined;

    if (filteredAnnotations.find((annotation) => annotation.type === 'codeContext')) {
      codeContext = filteredAnnotations.find((annotation) => annotation.type === 'codeContext')?.files;
    }

    const usage: {
      completionTokens: number;
      promptTokens: number;
      totalTokens: number;
    } = filteredAnnotations.find((annotation) => annotation.type === 'usage')?.value;

    const toolInvocations = parts?.filter((part) => part.type === 'tool-invocation');
    const toolCallAnnotations = filteredAnnotations.filter(
      (annotation) => annotation.type === 'toolCall',
    ) as ToolCallAnnotation[];

    const timeStr = formatTime(timestamp);

    return (
      <div className="flex gap-4 group">
        <div className="mt-1">
          <AiAvatar />
        </div>
        <div className="space-y-1 max-w-[90%] flex-1">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-xs font-bold text-bolt-elements-textPrimary">SiteBuilder AI</span>
            {timeStr && <span className="text-[10px] text-bolt-elements-textTertiary">{timeStr}</span>}
            {/* Info icon with context/summary hidden for cleaner UI */}
            {(codeContext || chatSummary) && false && (
              <Popover
                side="right"
                align="start"
                trigger={
                  <div className="i-ph:info text-bolt-elements-textTertiary hover:text-bolt-elements-textSecondary cursor-pointer" />
                }
              >
                {chatSummary && (
                  <div className="max-w-chat">
                    <div className="summary max-h-96 flex flex-col">
                      <h2 className="border border-bolt-elements-borderColor rounded-md p4">Summary</h2>
                      <div style={{ zoom: 0.7 }} className="overflow-y-auto m4">
                        <Markdown>{chatSummary as string}</Markdown>
                      </div>
                    </div>
                    {(codeContext?.length ?? 0) > 0 && (
                      <div className="code-context flex flex-col p4 border border-bolt-elements-borderColor rounded-md">
                        <h2>Context</h2>
                        <div className="flex gap-4 mt-4 bolt" style={{ zoom: 0.6 }}>
                          {codeContext?.map((x) => {
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
            {(onRewind || onFork) && messageId && (
              <div className="flex gap-2 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                {onRewind && (
                  <WithTooltip tooltip="Revert to this message">
                    <button
                      onClick={() => onRewind(messageId)}
                      key="i-ph:arrow-u-up-left"
                      className="i-ph:arrow-u-up-left text-lg text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary transition-colors"
                    />
                  </WithTooltip>
                )}
                {onFork && (
                  <WithTooltip tooltip="Fork chat from this message">
                    <button
                      onClick={() => onFork(messageId)}
                      key="i-ph:git-fork"
                      className="i-ph:git-fork text-lg text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary transition-colors"
                    />
                  </WithTooltip>
                )}
              </div>
            )}
          </div>
          <div
            className="p-4 rounded-2xl rounded-tl-none text-sm text-bolt-elements-textSecondary leading-relaxed border"
            style={{
              background: 'var(--bolt-chat-ai-bubble-bg)',
              borderColor: 'var(--bolt-chat-ai-bubble-border)',
              boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
            }}
          >
            {/* Token usage information hidden for cleaner UI */}
            {usage && false && (
              <div className="text-[10px] text-bolt-elements-textTertiary mb-2">
                Tokens: {usage.totalTokens} (prompt: {usage.promptTokens}, completion: {usage.completionTokens})
              </div>
            )}
            <Markdown
              append={append}
              chatMode={chatMode}
              setChatMode={setChatMode}
              model={model}
              provider={provider}
              html
            >
              {content}
            </Markdown>
            {toolInvocations && toolInvocations.length > 0 && (
              <ToolInvocations
                toolInvocations={toolInvocations}
                toolCallAnnotations={toolCallAnnotations}
                addToolResult={addToolResult}
              />
            )}
          </div>
        </div>
      </div>
    );
  },
);
