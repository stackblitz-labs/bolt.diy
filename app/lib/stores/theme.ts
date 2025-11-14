import { atom } from 'nanostores';
import { logStore } from './logs';

export type Theme = 'dark' | 'light' | 'system';

export const kTheme = 'bolt_theme';

export function themeIsDark() {
  const theme = themeStore.get();
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return theme === 'dark';
}

export const DEFAULT_THEME = 'light';

export const themeStore = atom<Theme>(initStore());

function initStore() {
  if (!import.meta.env.SSR) {
    const persistedTheme = localStorage.getItem(kTheme) as Theme | undefined;
    const themeAttribute = document.querySelector('html')?.getAttribute('data-theme');

    return persistedTheme ?? (themeAttribute as Theme) ?? DEFAULT_THEME;
  }

  return DEFAULT_THEME;
}

function getEffectiveTheme(theme: Theme): 'dark' | 'light' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme;
}

let systemThemeListener: ((e: MediaQueryListEvent) => void) | null = null;

function setupSystemThemeListener() {
  if (systemThemeListener) {
    return;
  }
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  systemThemeListener = (e: MediaQueryListEvent) => {
    if (themeStore.get() === 'system') {
      document.querySelector('html')?.setAttribute('data-theme', e.matches ? 'dark' : 'light');
    }
  };
  mediaQuery.addEventListener('change', systemThemeListener);
}

export function setTheme(theme: Theme) {
  themeStore.set(theme);
  logStore.logSystem(`Theme changed to ${theme} mode`);
  localStorage.setItem(kTheme, theme);
  const effectiveTheme = getEffectiveTheme(theme);
  document.querySelector('html')?.setAttribute('data-theme', effectiveTheme);

  // Setup system theme listener if theme is 'system'
  if (theme === 'system') {
    setupSystemThemeListener();
  }
}

// Initialize theme on load
if (!import.meta.env.SSR) {
  const initialTheme = themeStore.get();
  const effectiveTheme = getEffectiveTheme(initialTheme);
  document.querySelector('html')?.setAttribute('data-theme', effectiveTheme);
  if (initialTheme === 'system') {
    setupSystemThemeListener();
  }
}

export function toggleTheme() {
  const currentTheme = themeStore.get();
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  setTheme(newTheme);
}
