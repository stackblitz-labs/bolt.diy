import { atom } from 'nanostores';

export interface DesignPanelHandlers {
  onSave?: () => void;
  onDiscard?: () => void;
  isSaving?: boolean;
}

export interface ThemeChange {
  oldValue: string;
  newValue: string;
}

export interface ThemeChanges {
  hasChanges: boolean;
  lightThemeChanges: Record<string, ThemeChange>;
  darkThemeChanges: Record<string, ThemeChange>;
  appSettingsChanges: Record<string, ThemeChange>; // For non-color variables like radius, spacing
  lastSaved: Date | null;
  currentTheme: 'light' | 'dark';
}

const STORAGE_KEY = 'nut_unsaved_theme_changes';

const loadPersistedChanges = (): ThemeChanges | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Convert lastSaved back to Date if it exists
      if (parsed.lastSaved) {
        parsed.lastSaved = new Date(parsed.lastSaved);
      }
      return parsed;
    }
  } catch (error) {
    console.warn('[DesignSystemStore] Failed to load persisted changes:', error);
  }
  return null;
};

const initialThemeChangesState: ThemeChanges = {
  hasChanges: false,
  lightThemeChanges: {},
  darkThemeChanges: {},
  appSettingsChanges: {},
  lastSaved: null,
  currentTheme: 'light',
};

// Initialize with persisted changes if available
const persistedChanges = loadPersistedChanges();
const initialState = persistedChanges && persistedChanges.hasChanges ? persistedChanges : initialThemeChangesState;

export const designPanelStore = {
  isVisible: atom(false),
  handlers: atom<DesignPanelHandlers>({}),
  themeChanges: atom<ThemeChanges>(initialState),
};

// Persist changes to localStorage
const persistChanges = (changes: ThemeChanges) => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    if (changes.hasChanges) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(changes));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (error) {
    console.warn('[DesignSystemStore] Failed to persist changes:', error);
  }
};

// Actions for themeChanges
export const markThemeChanged = (
  variableName: string,
  oldValue: string,
  newValue: string,
  isDark: boolean | 'app-settings' = false,
) => {
  const current = designPanelStore.themeChanges.get();

  const change: ThemeChange = { oldValue, newValue };

  let newState: ThemeChanges;
  if (isDark === 'app-settings') {
    // This is an app setting (like radius, spacing, font)
    newState = {
      ...current,
      hasChanges: true,
      appSettingsChanges: { ...current.appSettingsChanges, [variableName]: change },
    };
  } else {
    // This is a theme color variable
    newState = {
      ...current,
      hasChanges: true,
      lightThemeChanges: isDark ? current.lightThemeChanges : { ...current.lightThemeChanges, [variableName]: change },
      darkThemeChanges: isDark ? { ...current.darkThemeChanges, [variableName]: change } : current.darkThemeChanges,
      currentTheme: isDark ? 'dark' : 'light',
    };
  }

  designPanelStore.themeChanges.set(newState);
  persistChanges(newState);
};

export const markThemesSaved = () => {
  const newState: ThemeChanges = {
    hasChanges: false,
    lightThemeChanges: {},
    darkThemeChanges: {},
    appSettingsChanges: {},
    lastSaved: new Date(),
    currentTheme: 'light',
  };
  designPanelStore.themeChanges.set(newState);
  persistChanges(newState);
};

export const resetThemeChanges = () => {
  designPanelStore.themeChanges.set(initialThemeChangesState);
  persistChanges(initialThemeChangesState);
};

// Global reset function that can be called to trigger theme reset
export const triggerThemeReset = () => {
  // Reset the theme changes store
  resetThemeChanges();

  // Dispatch a custom event that the ThemeEditor can listen to
  window.dispatchEvent(new CustomEvent('theme-reset-requested'));
};
