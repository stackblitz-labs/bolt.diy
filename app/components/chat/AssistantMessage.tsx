import { memo, useState, useMemo } from 'react';
import Markdown from './Markdown';
import type { JSONValue } from 'ai';
import Popover from '~/components/ui/Popover';
import { workbenchStore } from '~/lib/stores/workbench';
import { WORK_DIR } from '~/utils/constants';

interface AssistantMessageProps {
  content: string;
  annotations?: JSONValue[];
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

export const AssistantMessage = memo(({ content, annotations }: AssistantMessageProps) => {
  const [showReasoning, setShowReasoning] = useState(false);
  const filteredAnnotations = (annotations?.filter(
    (annotation: JSONValue) => annotation && typeof annotation === 'object' && Object.keys(annotation).includes('type'),
  ) || []) as { type: string; value: any } & { [key: string]: any }[];

  // Use memoization to prevent unnecessary re-renders during streaming
  const memoizedContent = useMemo(() => content, [content]);

  let chatSummary: string | undefined = undefined;

  if (filteredAnnotations.find((annotation) => annotation.type === 'chatSummary')) {
    chatSummary = filteredAnnotations.find((annotation) => annotation.type === 'chatSummary')?.summary;
  }

  let codeContext: string[] | undefined = undefined;

  if (filteredAnnotations.find((annotation) => annotation.type === 'codeContext')) {
    codeContext = filteredAnnotations.find((annotation) => annotation.type === 'codeContext')?.files;
  }

  const reasoning: string | undefined = filteredAnnotations.find(
    (annotation) => annotation.type === 'reasoning',
  )?.value;

  const usage: {
    completionTokens: number;
    promptTokens: number;
    totalTokens: number;
  } = filteredAnnotations.find((annotation) => annotation.type === 'usage')?.value;

  return (
    <div className="overflow-hidden w-full">
      <>
        <div className="flex gap-2 items-center text-sm text-bolt-elements-textSecondary mb-2">
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
          {reasoning && (
            <button
              className="flex items-center gap-1 text-bolt-elements-item-contentAccent"
              onClick={() => setShowReasoning(!showReasoning)}
            >
              <span className="i-ph:brain" />
              <span>{showReasoning ? 'Hide reasoning' : 'Show reasoning'}</span>
            </button>
          )}
          {usage && (
            <div>
              Tokens: {usage.totalTokens} (prompt: {usage.promptTokens}, completion: {usage.completionTokens})
            </div>
          )}
        </div>
      </>
      {reasoning && showReasoning && (
        <div className="mb-4 p-3 bg-bolt-elements-artifacts-inlineCode-background rounded-md text-sm">
          <div className="text-bolt-elements-item-contentAccent font-medium mb-2">AI Reasoning:</div>
          <Markdown>{reasoning}</Markdown>
        </div>
      )}
      <Markdown html>{memoizedContent}</Markdown>
    </div>
  );
});
