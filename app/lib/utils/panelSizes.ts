const CHAT_PANEL_SIZE_KEY = 'nut-chat-panel-size';

/**
 * Get the saved chat panel size from localStorage
 * Returns the saved size (40-60) or null if not set
 */
export function getSavedChatPanelSize(): number | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const saved = localStorage.getItem(CHAT_PANEL_SIZE_KEY);
    if (saved) {
      const size = parseFloat(saved);
      // Validate size is within reasonable bounds
      if (size >= 30 && size <= 60) {
        return size;
      }
    }
  } catch (error) {
    console.warn('Failed to load saved panel size:', error);
  }

  return null;
}

/**
 * Save the chat panel size to localStorage
 */
export function saveChatPanelSize(size: number): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    // Validate size before saving
    if (size >= 30 && size <= 60) {
      localStorage.setItem(CHAT_PANEL_SIZE_KEY, size.toString());
    }
  } catch (error) {
    console.warn('Failed to save panel size:', error);
  }
}

/**
 * Get the default chat panel size (saved or fallback)
 */
export function getDefaultChatPanelSize(): number {
  return getSavedChatPanelSize() ?? 40;
}

