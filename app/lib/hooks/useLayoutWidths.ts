import { useState, useEffect, useCallback } from 'react';

interface LayoutWidths {
  chatWidth: number;
  workbenchWidth: number;
  workbenchLeft: number;
  chatPanelSize: number;
  setChatPanelSize: (size: number) => void;
  panelSizeKey: number;
}

const CHAT_MIN_WIDTH = 500;
const CHAT_MAX_WIDTH = 600;
const CHAT_TARGET_PERCENTAGE = 0.4;
const STORAGE_KEY = 'nut-chat-panel-size';
const DEFAULT_CHAT_PANEL_SIZE = 35; // percentage

function getStoredPanelSize(): number {
  if (typeof window === 'undefined') {
    return DEFAULT_CHAT_PANEL_SIZE;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);

    if (stored) {
      const parsed = parseFloat(stored);

      if (!isNaN(parsed) && parsed >= 20 && parsed <= 60) {
        return parsed;
      }
    }
  } catch {
    // localStorage might be unavailable
  }

  return DEFAULT_CHAT_PANEL_SIZE;
}

function storePanelSize(size: number): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, size.toString());
  } catch {
    // localStorage might be unavailable
  }
}

export function useLayoutWidths(hasSidebar: boolean = false): LayoutWidths {
  const [chatPanelSize, setChatPanelSizeState] = useState<number>(DEFAULT_CHAT_PANEL_SIZE);
  const [panelSizeKey, setPanelSizeKey] = useState<number>(0);
  const [widths, setWidths] = useState<LayoutWidths>({
    chatWidth: CHAT_MIN_WIDTH,
    workbenchWidth: 0,
    workbenchLeft: CHAT_MIN_WIDTH,
    chatPanelSize: DEFAULT_CHAT_PANEL_SIZE,
    setChatPanelSize: () => {},
    panelSizeKey: 0,
  });

  const setChatPanelSize = useCallback((size: number) => {
    setChatPanelSizeState(size);
    storePanelSize(size);
  }, []);

  // Load stored panel size on mount and trigger re-render of panels
  useEffect(() => {
    const storedSize = getStoredPanelSize();
    setChatPanelSizeState(storedSize);
    // Increment key to force ResizablePanelGroup to remount with correct size
    setPanelSizeKey((k) => k + 1);
  }, []);

  useEffect(() => {
    const calculateWidths = () => {
      const windowWidth = window.innerWidth;
      const availableWidth = windowWidth;

      const targetChatWidth = availableWidth * CHAT_TARGET_PERCENTAGE;

      const chatWidth = Math.min(Math.max(targetChatWidth, CHAT_MIN_WIDTH), CHAT_MAX_WIDTH);

      const workbenchWidth = Math.max(0, availableWidth - chatWidth);

      const workbenchLeft = chatWidth;

      setWidths({
        chatWidth,
        workbenchWidth,
        workbenchLeft,
        chatPanelSize,
        setChatPanelSize,
        panelSizeKey,
      });
    };

    calculateWidths();

    window.addEventListener('resize', calculateWidths);

    return () => {
      window.removeEventListener('resize', calculateWidths);
    };
  }, [hasSidebar, chatPanelSize, setChatPanelSize, panelSizeKey]);

  return widths;
}
