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

const initialThemeChangesState: ThemeChanges = {
  hasChanges: false,
  lightThemeChanges: {},
  darkThemeChanges: {},
  appSettingsChanges: {},
  lastSaved: null,
  currentTheme: 'light',
};

export const designPanelStore = {
  isVisible: atom(false),
  handlers: atom<DesignPanelHandlers>({}),
  themeChanges: atom<ThemeChanges>(initialThemeChangesState),
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

  if (isDark === 'app-settings') {
    // This is an app setting (like radius, spacing, font)
    designPanelStore.themeChanges.set({
      ...current,
      hasChanges: true,
      appSettingsChanges: { ...current.appSettingsChanges, [variableName]: change },
    });
  } else {
    // This is a theme color variable
    designPanelStore.themeChanges.set({
      ...current,
      hasChanges: true,
      lightThemeChanges: isDark ? current.lightThemeChanges : { ...current.lightThemeChanges, [variableName]: change },
      darkThemeChanges: isDark ? { ...current.darkThemeChanges, [variableName]: change } : current.darkThemeChanges,
      currentTheme: isDark ? 'dark' : 'light',
    });
  }
};

export const markThemesSaved = () => {
  designPanelStore.themeChanges.set({
    hasChanges: false,
    lightThemeChanges: {},
    darkThemeChanges: {},
    appSettingsChanges: {},
    lastSaved: new Date(),
    currentTheme: 'light',
  });
};

export const resetThemeChanges = () => {
  designPanelStore.themeChanges.set(initialThemeChangesState);
};

// Global reset function that can be called to trigger theme reset
export const triggerThemeReset = () => {
  // Reset the theme changes store
  resetThemeChanges();

  // Dispatch a custom event that the ThemeEditor can listen to
  window.dispatchEvent(new CustomEvent('theme-reset-requested'));
};
