import { useEffect, useMemo, useState } from 'react';
import { IconButton } from '~/components/ui/IconButton';
import { Dialog, DialogDescription, DialogRoot, DialogTitle } from '~/components/ui/Dialog';
import { classNames } from '~/utils/classNames';

const MAX_MEMORY_CHARS = 2000;

interface ProjectMemoryDialogProps {
  memory?: string;
  onSave: (value: string) => void;
}

export function ProjectMemoryDialog({ memory = '', onSave }: ProjectMemoryDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState(memory);

  useEffect(() => {
    if (isOpen) {
      setDraft(memory);
    }
  }, [isOpen, memory]);

  const trimmedDraft = useMemo(() => draft.trim(), [draft]);
  const remainingChars = MAX_MEMORY_CHARS - draft.length;

  const handleSave = () => {
    onSave(trimmedDraft.slice(0, MAX_MEMORY_CHARS));
    setIsOpen(false);
  };

  const handleClear = () => {
    setDraft('');
    onSave('');
    setIsOpen(false);
  };

  return (
    <>
      <IconButton
        title="Project Memory"
        className={classNames(
          'transition-all flex items-center gap-1',
          memory
            ? 'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent'
            : 'bg-bolt-elements-item-backgroundDefault text-bolt-elements-item-contentDefault',
        )}
        onClick={() => setIsOpen(true)}
      >
        <div className="i-ph:bookmark-simple text-xl" />
        {memory ? <span>Memory</span> : <span />}
      </IconButton>
      <DialogRoot open={isOpen} onOpenChange={setIsOpen}>
        <Dialog>
          <div className="flex flex-col gap-4">
            <div>
              <DialogTitle className="text-xl font-bold text-bolt-elements-textPrimary">Project Memory</DialogTitle>
              <DialogDescription className="text-sm text-bolt-elements-textSecondary">
                Notes saved here are injected into every prompt for this chat. Use this for tech stack decisions,
                conventions, and constraints you want the model to remember.
              </DialogDescription>
            </div>
            <div className="flex flex-col gap-2">
              <textarea
                className="min-h-[160px] w-full rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 p-3 text-sm text-bolt-elements-textPrimary focus:outline-none focus:ring-2 focus:ring-bolt-elements-focus"
                placeholder="e.g. Use React + Vite. Follow our eslint rules. Never modify backend files without asking."
                value={draft}
                onChange={(event) => {
                  const nextValue = event.target.value;

                  if (nextValue.length <= MAX_MEMORY_CHARS) {
                    setDraft(nextValue);
                  } else {
                    setDraft(nextValue.slice(0, MAX_MEMORY_CHARS));
                  }
                }}
              />
              <div className="flex items-center justify-between text-xs text-bolt-elements-textTertiary">
                <span>{remainingChars} characters remaining</span>
                {trimmedDraft.length === 0 && memory && (
                  <span className="text-bolt-elements-button-danger-text">Memory cleared</span>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={handleClear}
                className="px-3 py-1.5 rounded-md text-sm font-medium bg-bolt-elements-button-secondary-background text-bolt-elements-button-secondary-text hover:bg-bolt-elements-button-secondary-backgroundHover"
              >
                Clear
              </button>
              <button
                onClick={handleSave}
                className="px-3 py-1.5 rounded-md text-sm font-medium bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text hover:bg-bolt-elements-button-primary-backgroundHover"
              >
                Save
              </button>
            </div>
          </div>
        </Dialog>
      </DialogRoot>
    </>
  );
}
