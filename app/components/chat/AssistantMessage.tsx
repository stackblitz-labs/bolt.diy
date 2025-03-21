import { memo, useState } from 'react';
import { Markdown } from './Markdown';
import type { JSONValue, ToolInvocation } from 'ai';
import Popover from '~/components/ui/Popover';
import { workbenchStore } from '~/lib/stores/workbench';
import { WORK_DIR } from '~/utils/constants';

interface AssistantMessageProps {
  content: string;
  annotations?: JSONValue[];
  toolInvocations?: ToolInvocation[];
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

export const AssistantMessage = memo(({ content, annotations, toolInvocations }: AssistantMessageProps) => {
  const [expandedTools, setExpandedTools] = useState<Record<number, boolean>>({});

  const toggleTool = (idx: number) => {
    setExpandedTools((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  const filteredAnnotations = (annotations?.filter(
    (annotation: JSONValue) => annotation && typeof annotation === 'object' && Object.keys(annotation).includes('type'),
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
      {toolInvocations && toolInvocations.length > 0 && (
        <div className="mt-4 border-t border-bolt-elements-borderColor pt-4">
          {toolInvocations.map((tool, idx) => (
            <div
              key={idx}
              className="mb-4 bg-bolt-elements-artifacts-inlineCode-background p-3 rounded-md border border-bolt-elements-borderColor"
            >
              <div
                className="font-semibold text-sm mb-1 flex items-center justify-between cursor-pointer text-bolt-elements-textPrimary"
                onClick={() => toggleTool(idx)}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-bolt-elements-item-contentAccent">🔧</span> {tool.toolName}
                </div>
                <div className="flex items-center gap-1 text-xs text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors">
                  {expandedTools[idx] ? (
                    <>
                      <span className="i-ph:caret-up text-bolt-elements-item-contentAccent" />
                      <span>Hide</span>
                    </>
                  ) : (
                    <>
                      <span className="i-ph:caret-down text-bolt-elements-item-contentAccent" />
                      <span>Show</span>
                    </>
                  )}
                </div>
              </div>
              {tool.args && expandedTools[idx] && (
                <div className="text-xs mb-2 text-bolt-elements-textPrimary">
                  <div className="font-semibold mb-1">Arguments:</div>
                  <pre className="whitespace-pre-wrap overflow-x-auto p-2 bg-bolt-elements-artifacts-inlineCode-background/50 rounded border border-bolt-elements-borderColor/30">
                    {JSON.stringify(tool.args, null, 2)}
                  </pre>
                </div>
              )}
              {expandedTools[idx] && (
                <div className="text-xs mb-2 text-bolt-elements-textPrimary">
                  <div className="font-semibold mb-1">Result:</div>
                  <pre className="whitespace-pre-wrap overflow-x-auto overflow-y-auto max-h-60 p-2 bg-bolt-elements-artifacts-inlineCode-background/50 rounded border border-bolt-elements-borderColor/30">
                    {tool.state === 'result' ? (
                      tool.result
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="i-ph:spinner animate-spin"></span>
                        <span>Waiting...</span>
                      </div>
                    )}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Markdown html>{content}</Markdown>
    </div>
  );
});
