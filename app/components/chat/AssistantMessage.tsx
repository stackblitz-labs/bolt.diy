import { memo, useEffect, useState } from 'react';
import { Markdown } from './Markdown';
import type { JSONValue } from 'ai';
import Popover from '~/components/ui/Popover';
import { workbenchStore } from '~/lib/stores/workbench';
import { WORK_DIR } from '~/utils/constants';

interface AssistantMessageProps {
  content: string;
  annotations?: JSONValue[];
  isLast?: boolean;
  isStreaming?: boolean;
  onSuggestionClick?: (task: string) => void;
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
  ({ content, annotations, isLast, isStreaming, onSuggestionClick }: AssistantMessageProps) => {
    const [summary, setSummary] = useState<string | undefined>(undefined);
    const [pendingTasks, setPendingTasks] = useState<string[]>([]);
    useEffect(() => {
      if (!isStreaming && isLast) {
        let tokens = summary?.split('**Pending**:') || [];

        if (tokens.length <= 1) {
          return;
        }

        tokens = tokens[1].split('**Technical Constraints**:') || [];

        if (tokens.length <= 1) {
          return;
        }

        let tasks = tokens[0].split('\n');
        tasks = tasks.map((x) => {
          x = x.trim();

          if (x.startsWith('-')) {
            x = x.slice(1);
            x.trim();
          }

          return x;
        });
        tasks = tasks.filter((x) => x.length > 3 && x.length < 250);
        setPendingTasks(tasks);
      }
    }, [isStreaming, isLast]);

    const filteredAnnotations = (annotations?.filter(
      (annotation: JSONValue) =>
        annotation && typeof annotation === 'object' && Object.keys(annotation).includes('type'),
    ) || []) as { type: string; value: any } & { [key: string]: any }[];

    let chatSummary: string | undefined = undefined;

    if (filteredAnnotations.find((annotation) => annotation.type === 'chatSummary')) {
      chatSummary = filteredAnnotations.find((annotation) => annotation.type === 'chatSummary')?.summary;

      if (chatSummary && !summary) {
        setSummary(chatSummary);
      }
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
                              <>
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
                              </>
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
            {usage && (
              <div>
                Tokens: {usage.totalTokens} (prompt: {usage.promptTokens}, completion: {usage.completionTokens})
              </div>
            )}
          </div>
        </>
        <Markdown html>{content}</Markdown>
        {isLast && pendingTasks.length > 0 && (
          <div className="flex gap-2 flex-col mt-6">
            <div className="text-gray-600 dark:text-gray-400 text-sm font-medium px-4 py-2">
              What do you want to do next?
            </div>
            {pendingTasks.map((task, index) => (
              <button
                key={index}
                onClick={() => {
                  console.log('Clicked task', task);
                  onSuggestionClick?.(`let focus on the task: ${task}`);
                }}
                className="flex gap-2 items-center bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-500/20 rounded-lg px-4 py-2 transition-colors"
              >
                <span className="inline-block i-lucide:message-square h-4 w-4" />
                <span className="text-sm">{task}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  },
);
