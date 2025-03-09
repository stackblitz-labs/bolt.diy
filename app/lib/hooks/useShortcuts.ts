import { useStore } from '@nanostores/react';
import { useEffect } from 'react';
import { shortcutsStore, type Shortcuts } from '~/lib/stores/settings';
import { isMac } from '~/utils/os';

// List of keys that should not trigger shortcuts when typing in input/textarea
const INPUT_ELEMENTS = ['input', 'textarea'];

class ShortcutEventEmitter {
  #emitter = new EventTarget();

  dispatch(type: keyof Shortcuts) {
    this.#emitter.dispatchEvent(new Event(type));
  }

  on(type: keyof Shortcuts, cb: VoidFunction) {
    this.#emitter.addEventListener(type, cb);

    return () => {
      this.#emitter.removeEventListener(type, cb);
    };
  }
}

export const shortcutEventEmitter = new ShortcutEventEmitter();

export function useShortcuts(): void {
  const shortcuts = useStore(shortcutsStore);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      // Don't trigger shortcuts when typing in input fields
      if (
        document.activeElement &&
        INPUT_ELEMENTS.includes(document.activeElement.tagName.toLowerCase()) &&
        !event.altKey && // Allow Alt combinations even in input fields
        !event.metaKey && // Allow Cmd/Win combinations even in input fields
        !event.ctrlKey // Allow Ctrl combinations even in input fields
      ) {
        return;
      }

      // Debug logging in development only
      if (import.meta.env.DEV) {
        console.log('Key pressed:', {
          key: event.key,
          code: event.code,
          ctrlKey: event.ctrlKey,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
          metaKey: event.metaKey,
          target: event.target,
        });
      }

      // Handle shortcuts
      for (const [name, shortcut] of Object.entries(shortcuts)) {
        const keyMatches =
          shortcut.key.toLowerCase() === event.key.toLowerCase() || `Key${shortcut.key.toUpperCase()}` === event.code;

        // Handle ctrlOrMetaKey based on OS
        const ctrlOrMetaKeyMatches = shortcut.ctrlOrMetaKey
          ? (isMac && event.metaKey) || (!isMac && event.ctrlKey)
          : true;

        const modifiersMatch =
          ctrlOrMetaKeyMatches &&
          (shortcut.ctrlKey === undefined || shortcut.ctrlKey === event.ctrlKey) &&
          (shortcut.metaKey === undefined || shortcut.metaKey === event.metaKey) &&
          (shortcut.shiftKey === undefined || shortcut.shiftKey === event.shiftKey) &&
          (shortcut.altKey === undefined || shortcut.altKey === event.altKey);

        if (keyMatches && modifiersMatch) {
          // Prevent default browser behavior if specified
          if (shortcut.isPreventDefault) {
            event.preventDefault();
            event.stopPropagation();
          }

          shortcutEventEmitter.dispatch(name as keyof Shortcuts);
          shortcut.action();
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [shortcuts]);
}
