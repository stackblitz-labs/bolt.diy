import { atom } from 'nanostores';
import { logStore } from './logs';
import { getThemeMode, THEMES, type Theme } from '~/types/theme';

export type { Theme } from '~/types/theme';

export const kTheme = 'bolt_theme';

export function themeIsDark() {
  return getThemeMode(themeStore.get()) === 'dark';
}

export const DEFAULT_THEME = 'light';

export const themeStore = atom<Theme>(initStore());

function isTheme(value: string | null): value is Theme | 'dark' {
  return value === 'dark' || THEMES.some(({ id }) => id === value);
}

function initStore() {
  if (!import.meta.env.SSR) {
    const storedTheme = localStorage.getItem(kTheme);
    const persistedTheme = isTheme(storedTheme) ? storedTheme : undefined;
    const themeAttribute = document.querySelector('html')?.getAttribute('data-theme');

    return persistedTheme ?? (themeAttribute as Theme) ?? DEFAULT_THEME;
  }

  return DEFAULT_THEME;
}

export function toggleTheme() {
  const currentTheme = themeStore.get();
  const targetMode = getThemeMode(currentTheme) === 'dark' ? 'light' : 'dark';
  const savedTheme = localStorage.getItem(`bolt_theme_${targetMode}`);

  const newTheme =
    isTheme(savedTheme) && getThemeMode(savedTheme) === targetMode
      ? savedTheme
      : targetMode === 'dark'
        ? 'dark-dracula'
        : 'light';

  setTheme(newTheme);
}

export function setTheme(newTheme: Theme | 'dark') {
  // Update the theme store
  themeStore.set(newTheme);

  // Update localStorage
  localStorage.setItem(kTheme, newTheme);
  localStorage.setItem(`bolt_theme_${getThemeMode(newTheme)}`, newTheme);

  // Update the HTML attribute
  const root = document.querySelector('html');
  root?.setAttribute('data-theme', getThemeMode(newTheme));
  root?.setAttribute('data-color-theme', newTheme === 'dark' ? 'dark-dracula' : newTheme);

  // Update user profile if it exists
  try {
    const userProfile = localStorage.getItem('bolt_user_profile');

    if (userProfile) {
      const profile = JSON.parse(userProfile);
      profile.theme = newTheme;
      localStorage.setItem('bolt_user_profile', JSON.stringify(profile));
    }
  } catch (error) {
    console.error('Error updating user profile theme:', error);
  }

  logStore.logSystem(`Theme changed to ${newTheme}`);
}
