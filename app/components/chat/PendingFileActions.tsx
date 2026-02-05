import React, { useMemo, useState } from 'react';
import { useStore } from '@nanostores/react';
import { workbenchStore } from '~/lib/stores/workbench';
import { classNames } from '~/utils/classNames';
import { diffFiles, extractRelativePath } from '~/utils/diff';

export function PendingFileActions() {
  const pending = useStore(workbenchStore.pendingFileActions);
  const files = useStore(workbenchStore.files);
  const entries = useMemo(() => Object.values(pending), [pending]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium text-bolt-elements-textPrimary">
          Pending file changes ({entries.length})
        </div>
        <div className="flex gap-2">
          <button
            className={classNames(
              'px-2 py-1.5 rounded-md text-xs font-medium',
              'bg-bolt-elements-button-primary-background',
              'hover:bg-bolt-elements-button-primary-backgroundHover',
              'text-bolt-elements-button-primary-text',
            )}
            onClick={() => workbenchStore.applyAllPendingFileActions()}
          >
            Apply all
          </button>
          <button
            className={classNames(
              'px-2 py-1.5 rounded-md text-xs font-medium',
              'bg-bolt-elements-button-secondary-background',
              'hover:bg-bolt-elements-button-secondary-backgroundHover',
              'text-bolt-elements-button-secondary-text',
            )}
            onClick={() => workbenchStore.discardAllPendingFileActions()}
          >
            Discard all
          </button>
        </div>
      </div>
      <div className="mt-3 space-y-3">
        {entries.map((entry) => {
          const file = files[entry.filePath];
          const currentContent = file?.type === 'file' ? file.content : '';
          const relativePath = extractRelativePath(entry.filePath || entry.actionFilePath);
          const diff = diffFiles(relativePath, currentContent || '', entry.content || '');
          const isExpanded = !!expanded[entry.actionId];

          return (
            <div
              key={entry.actionId}
              className="rounded-md border border-bolt-elements-borderColor bg-bolt-elements-background-depth-3 p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-mono text-bolt-elements-textSecondary">{relativePath}</div>
                <div className="flex gap-2">
                  <button
                    className={classNames(
                      'px-2 py-1 rounded-md text-xs font-medium',
                      'bg-bolt-elements-button-primary-background',
                      'hover:bg-bolt-elements-button-primary-backgroundHover',
                      'text-bolt-elements-button-primary-text',
                    )}
                    onClick={() => workbenchStore.applyPendingFileAction(entry.actionId)}
                  >
                    Apply
                  </button>
                  <button
                    className={classNames(
                      'px-2 py-1 rounded-md text-xs font-medium',
                      'bg-bolt-elements-button-secondary-background',
                      'hover:bg-bolt-elements-button-secondary-backgroundHover',
                      'text-bolt-elements-button-secondary-text',
                    )}
                    onClick={() => workbenchStore.discardPendingFileAction(entry.actionId)}
                  >
                    Discard
                  </button>
                  <button
                    className={classNames(
                      'px-2 py-1 rounded-md text-xs font-medium',
                      'bg-bolt-elements-background-depth-2',
                      'hover:bg-bolt-elements-background-depth-4',
                      'text-bolt-elements-textSecondary',
                    )}
                    onClick={() =>
                      setExpanded((prev) => ({
                        ...prev,
                        [entry.actionId]: !prev[entry.actionId],
                      }))
                    }
                  >
                    {isExpanded ? 'Hide diff' : 'View diff'}
                  </button>
                </div>
              </div>
              {isExpanded && (
                <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-bolt-elements-background-depth-2 p-3 text-xs text-bolt-elements-textPrimary whitespace-pre-wrap">
                  {diff || 'No changes detected.'}
                </pre>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
