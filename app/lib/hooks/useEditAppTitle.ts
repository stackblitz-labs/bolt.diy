import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { chatStore } from '~/lib/stores/chat';
import { database } from '~/lib/persistence/apps';

interface EditAppTitleOptions {
  initialTitle?: string;
  customAppId?: string;
}

type EditAppTitleHook = {
  editing: boolean;
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleBlur: () => Promise<void>;
  handleSubmit: (event: React.FormEvent) => Promise<void>;
  handleKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => Promise<void>;
  currentTitle: string;
  toggleEditMode: () => void;
};

/**
 * Hook to manage the state and behavior for editing app titles.
 *
 * Offers functions to:
 * - Switch between edit and view modes.
 * - Manage input changes, blur, and form submission events.
 * - Save updates to IndexedDB and optionally to the global application state.
 */
export function useEditAppTitle({
  initialTitle = chatStore.appTitle.get(),
  customAppId,
}: EditAppTitleOptions): EditAppTitleHook {
  const currentAppId = chatStore.currentAppId.get();

  const [editing, setEditing] = useState(false);
  const [currentTitle, setCurrentTitle] = useState(initialTitle);

  const [appId, setAppId] = useState<string>();

  useEffect(() => {
    setAppId(customAppId || currentAppId);
  }, [customAppId, currentAppId]);

  useEffect(() => {
    setCurrentTitle(initialTitle);
  }, [initialTitle]);

  const toggleEditMode = useCallback(() => setEditing((prev) => !prev), []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentTitle(e.target.value);
  }, []);

  const fetchLatestTitle = useCallback(async () => {
    if (!appId) {
      return initialTitle;
    }

    try {
      const title = await database.getAppTitle(appId);
      return title || initialTitle;
    } catch (error) {
      console.error('Failed to fetch latest description:', error);
      return initialTitle;
    }
  }, [appId, initialTitle]);

  const handleBlur = useCallback(async () => {
    const latestTitle = await fetchLatestTitle();
    setCurrentTitle(latestTitle);
    toggleEditMode();
  }, [fetchLatestTitle, toggleEditMode]);

  const isValidTitle = useCallback((title: string): boolean => {
    const trimmedTitle = title.trim();

    if (trimmedTitle === initialTitle) {
      toggleEditMode();
      return false; // No change, skip validation
    }

    const lengthValid = trimmedTitle.length > 0 && trimmedTitle.length <= 200;

    if (!lengthValid) {
      toast.error('Title must be between 1 and 100 characters.');
      return false;
    }

    return true;
  }, []);

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();

      if (!currentTitle) {
        return;
      }

      if (!isValidTitle(currentTitle)) {
        return;
      }

      try {
        if (!appId) {
          toast.error('App Id is not available');
          return;
        }

        await database.updateAppTitle(appId, currentTitle);
        toast.success('App title updated successfully');

        if (appId == currentAppId) {
          chatStore.appTitle.set(currentTitle);
        }
      } catch (error) {
        toast.error('Failed to update chat title: ' + (error as Error).message);
      }

      toggleEditMode();
    },
    [currentTitle, appId, customAppId],
  );

  const handleKeyDown = useCallback(
    async (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        await handleBlur();
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        await handleSubmit(e);
      }
    },
    [handleBlur, handleSubmit, currentTitle],
  );

  return {
    editing,
    handleChange,
    handleBlur,
    handleSubmit,
    handleKeyDown,
    currentTitle: currentTitle!,
    toggleEditMode,
  };
}
