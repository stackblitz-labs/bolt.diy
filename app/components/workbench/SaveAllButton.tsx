import { useStore } from '@nanostores/react';
import { memo, useCallback, useEffect, useState, useRef } from 'react';
import { toast } from 'react-toastify';
import * as Tooltip from '@radix-ui/react-tooltip';
import { workbenchStore } from '~/lib/stores/workbench';
import { classNames } from '~/utils/classNames';

interface SaveAllButtonProps {
  className?: string;
  variant?: 'icon' | 'button';
  showCount?: boolean;
  autoSave?: boolean;
  autoSaveInterval?: number;
}

export const SaveAllButton = memo(
  ({
    className = '',
    variant = 'icon',
    showCount = true,
    autoSave = false,
    autoSaveInterval = 30000,
  }: SaveAllButtonProps) => {
    const unsavedFiles = useStore(workbenchStore.unsavedFiles);
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [timeUntilAutoSave, setTimeUntilAutoSave] = useState<number | null>(null);
    const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
    const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

    const unsavedCount = unsavedFiles.size;
    const hasUnsavedFiles = unsavedCount > 0;

    // Log unsaved files state changes
    useEffect(() => {
      console.log('[SaveAllButton] Unsaved files changed:', {
        count: unsavedCount,
        files: Array.from(unsavedFiles),
        hasUnsavedFiles,
      });
    }, [unsavedFiles, unsavedCount, hasUnsavedFiles]);

    // Auto-save logic
    useEffect(() => {
      if (!autoSave || !hasUnsavedFiles) {
        if (autoSaveTimerRef.current) {
          clearTimeout(autoSaveTimerRef.current);
          autoSaveTimerRef.current = null;
        }

        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }

        setTimeUntilAutoSave(null);

        return;
      }

      // Set up auto-save timer
      console.log('[SaveAllButton] Setting up auto-save timer for', autoSaveInterval, 'ms');
      autoSaveTimerRef.current = setTimeout(async () => {
        if (hasUnsavedFiles && !isSaving) {
          console.log('[SaveAllButton] Auto-save triggered');
          await handleSaveAll(true);
        }
      }, autoSaveInterval);

      // Set up countdown timer
      const startTime = Date.now();
      setTimeUntilAutoSave(Math.ceil(autoSaveInterval / 1000));

      countdownTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, autoSaveInterval - elapsed);
        setTimeUntilAutoSave(Math.ceil(remaining / 1000));

        if (remaining <= 0 && countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
      }, 1000);
    }, [autoSave, hasUnsavedFiles, autoSaveInterval, isSaving]);

    // Cleanup effect
    useEffect(() => {
      return () => {
        if (autoSaveTimerRef.current) {
          clearTimeout(autoSaveTimerRef.current);
        }

        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
        }
      };
    }, []);

    const handleSaveAll = useCallback(
      async (isAutoSave = false) => {
        if (!hasUnsavedFiles || isSaving) {
          console.log('[SaveAllButton] Skipping save:', { hasUnsavedFiles, isSaving });
          return;
        }

        console.log('[SaveAllButton] Starting save:', {
          unsavedCount,
          isAutoSave,
          files: Array.from(unsavedFiles),
        });

        setIsSaving(true);

        const startTime = performance.now();
        const savedFiles: string[] = [];
        const failedFiles: string[] = [];

        try {
          // Save each file individually with detailed logging
          for (const filePath of unsavedFiles) {
            try {
              console.log(`[SaveAllButton] Saving file: ${filePath}`);
              await workbenchStore.saveFile(filePath);
              savedFiles.push(filePath);
              console.log(`[SaveAllButton] Successfully saved: ${filePath}`);
            } catch (error) {
              console.error(`[SaveAllButton] Failed to save ${filePath}:`, error);
              failedFiles.push(filePath);
            }
          }

          const endTime = performance.now();
          const duration = Math.round(endTime - startTime);
          setLastSaved(new Date());

          // Check final state
          const remainingUnsaved = workbenchStore.unsavedFiles.get();
          console.log('[SaveAllButton] Save complete:', {
            savedCount: savedFiles.length,
            failedCount: failedFiles.length,
            remainingUnsaved: Array.from(remainingUnsaved),
            duration,
          });

          // Show appropriate feedback
          if (failedFiles.length === 0) {
            const message = isAutoSave
              ? `Auto-saved ${savedFiles.length} file${savedFiles.length > 1 ? 's' : ''}`
              : `Saved ${savedFiles.length} file${savedFiles.length > 1 ? 's' : ''}`;

            toast.success(message, {
              position: 'bottom-right',
              autoClose: 2000,
            });
          } else {
            toast.warning(`Saved ${savedFiles.length} files, ${failedFiles.length} failed`, {
              position: 'bottom-right',
              autoClose: 3000,
            });
          }
        } catch (error) {
          console.error('[SaveAllButton] Critical error during save:', error);
          toast.error('Failed to save files', {
            position: 'bottom-right',
            autoClose: 3000,
          });
        } finally {
          setIsSaving(false);
        }
      },
      [hasUnsavedFiles, isSaving, unsavedCount, unsavedFiles],
    );

    // Keyboard shortcut
    useEffect(() => {
      const handleKeyPress = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 's') {
          e.preventDefault();
          handleSaveAll(false);
        }
      };

      window.addEventListener('keydown', handleKeyPress);

      return () => window.removeEventListener('keydown', handleKeyPress);
    }, [handleSaveAll]);

    const formatLastSaved = () => {
      if (!lastSaved) {
        return null;
      }

      const now = new Date();
      const diff = Math.floor((now.getTime() - lastSaved.getTime()) / 1000);

      if (diff < 60) {
        return `${diff}s ago`;
      }

      if (diff < 3600) {
        return `${Math.floor(diff / 60)}m ago`;
      }

      return `${Math.floor(diff / 3600)}h ago`;
    };

    // Icon-only variant for header
    if (variant === 'icon') {
      return (
        <Tooltip.Provider delayDuration={300}>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button
                onClick={() => handleSaveAll(false)}
                disabled={!hasUnsavedFiles || isSaving}
                className={classNames(
                  'relative p-1.5 rounded-md transition-colors',
                  hasUnsavedFiles
                    ? 'text-bolt-elements-item-contentDefault hover:text-bolt-elements-item-contentActive hover:bg-bolt-elements-item-backgroundActive'
                    : 'text-bolt-elements-textTertiary cursor-not-allowed opacity-50',
                  className,
                )}
              >
                <div className="relative">
                  <div className={isSaving ? 'animate-spin' : ''}>
                    <div className="i-ph:floppy-disk text-lg" />
                  </div>
                  {hasUnsavedFiles && showCount && !isSaving && (
                    <div className="absolute -top-1 -right-1 min-w-[12px] h-[12px] bg-red-500 text-white rounded-full flex items-center justify-center text-[8px] font-bold">
                      {unsavedCount}
                    </div>
                  )}
                </div>
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                className="bg-bolt-elements-background-depth-3 text-bolt-elements-textPrimary px-3 py-2 rounded-lg shadow-lg border border-bolt-elements-borderColor z-[9999]"
                sideOffset={5}
              >
                <div className="text-xs space-y-1">
                  <div className="font-semibold">
                    {hasUnsavedFiles ? `${unsavedCount} unsaved file${unsavedCount > 1 ? 's' : ''}` : 'All files saved'}
                  </div>
                  {lastSaved && <div className="text-bolt-elements-textTertiary">Last saved: {formatLastSaved()}</div>}
                  {autoSave && hasUnsavedFiles && timeUntilAutoSave && (
                    <div className="text-bolt-elements-textTertiary">Auto-save in: {timeUntilAutoSave}s</div>
                  )}
                  <div className="border-t border-bolt-elements-borderColor pt-1 mt-1">
                    <kbd className="text-xs">Ctrl+Shift+S</kbd> to save all
                  </div>
                </div>
                <Tooltip.Arrow className="fill-bolt-elements-background-depth-3" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
      );
    }

    // Button variant
    return (
      <Tooltip.Provider delayDuration={300}>
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <button
              onClick={() => handleSaveAll(false)}
              disabled={!hasUnsavedFiles || isSaving}
              className={classNames(
                'inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                hasUnsavedFiles
                  ? 'bg-accent-500 hover:bg-accent-600 text-white'
                  : 'bg-bolt-elements-background-depth-1 text-bolt-elements-textTertiary border border-bolt-elements-borderColor cursor-not-allowed opacity-60',
                className,
              )}
            >
              <div className={isSaving ? 'animate-spin' : ''}>
                <div className="i-ph:floppy-disk" />
              </div>
              <span>
                {isSaving ? 'Saving...' : `Save All${showCount && hasUnsavedFiles ? ` (${unsavedCount})` : ''}`}
              </span>
              {autoSave && timeUntilAutoSave && hasUnsavedFiles && (
                <span className="text-xs opacity-75">({timeUntilAutoSave}s)</span>
              )}
            </button>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content
              className="bg-bolt-elements-background-depth-3 text-bolt-elements-textPrimary px-3 py-2 rounded-lg shadow-lg border border-bolt-elements-borderColor z-[9999]"
              sideOffset={5}
            >
              <div className="text-xs">
                <kbd>Ctrl+Shift+S</kbd> to save all
              </div>
              <Tooltip.Arrow className="fill-bolt-elements-background-depth-3" />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>
    );
  },
);

SaveAllButton.displayName = 'SaveAllButton';
