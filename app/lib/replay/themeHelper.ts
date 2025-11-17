import { tweakcnThemeRegistry } from '~/lib/tweakcn';

export interface ThemeOption {
  name: string;
  title: string;
  description: string;
}

export interface ThemeCSSVariables {
  light?: Record<string, string>;
  dark?: Record<string, string>;
}

/**
 * Get all available themes from the tweakcn registry
 */
export function getAvailableThemes(): ThemeOption[] {
  return tweakcnThemeRegistry.items.map((item) => ({
    name: item.name,
    title: item.title,
    description: item.description,
  }));
}

/**
 * Get CSS variables for a specific theme
 */
export function getThemeCSSVariables(themeName: string): ThemeCSSVariables | null {
  const theme = tweakcnThemeRegistry.items.find((item) => item.name === themeName);

  if (!theme || !theme.cssVars) {
    return null;
  }

  return theme.cssVars;
}

/**
 * Convert theme CSS variables to a flat object for injection
 * This converts the nested cssVars structure into CSS custom properties
 * @deprecated Use flattenThemeVariablesWithModes instead for proper light/dark mode support
 */
export function flattenThemeVariables(
  cssVars: ThemeCSSVariables,
  mode: 'light' | 'dark' = 'light',
): Record<string, string> {
  const flattened: Record<string, string> = {};

  // Add mode-specific variables (light or dark)
  // Shared variables like fonts and radius are now in light
  const modeVars = cssVars[mode];
  if (modeVars) {
    Object.entries(modeVars).forEach(([key, value]) => {
      flattened[`--${key}`] = value;
    });
  }

  return flattened;
}

/**
 * Convert theme CSS variables to a flat object with both light and dark mode values
 * Uses the ".dark:" separator format that the ThemeProvider expects
 */
export function flattenThemeVariablesWithModes(cssVars: ThemeCSSVariables): Record<string, string> {
  const flattened: Record<string, string> = {};

  // Get all variable names from both light and dark modes
  const lightVars = cssVars.light || {};
  const darkVars = cssVars.dark || {};

  // Combine all unique variable names
  const allKeys = new Set([...Object.keys(lightVars), ...Object.keys(darkVars)]);

  // For each variable, combine light and dark values
  allKeys.forEach((key) => {
    const lightValue = lightVars[key];
    const darkValue = darkVars[key];

    if (lightValue && darkValue) {
      // Both light and dark values exist - use .dark: separator
      flattened[`--${key}`] = `${lightValue} .dark: ${darkValue}`;
    } else if (lightValue) {
      // Only light value exists (includes shared variables like fonts, radius)
      flattened[`--${key}`] = lightValue;
    } else if (darkValue) {
      // Only dark value exists - use -dark suffix
      flattened[`--${key}-dark`] = darkValue;
    }
  });

  return flattened;
}

/**
 * Normalize theme variables for comparison by:
 * 1. Sorting keys
 * 2. Normalizing whitespace
 * 3. Removing variables that might differ (like app-title)
 */
function normalizeThemeVariables(vars: Record<string, string>): Record<string, string> {
  const normalized: Record<string, string> = {};
  const excludeKeys = ['--app-title']; // Exclude app-specific variables

  Object.entries(vars)
    .filter(([key]) => !excludeKeys.includes(key))
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([key, value]) => {
      normalized[key] = String(value).trim().replace(/\s+/g, ' ');
    });

  return normalized;
}

/**
 * Compare two theme variable objects for exact match
 */
function compareThemeVariables(vars1: Record<string, string>, vars2: Record<string, string>): boolean {
  const normalized1 = normalizeThemeVariables(vars1);
  const normalized2 = normalizeThemeVariables(vars2);

  const keys1 = Object.keys(normalized1);
  const keys2 = Object.keys(normalized2);

  if (keys1.length !== keys2.length) {
    return false;
  }

  for (const key of keys1) {
    if (normalized1[key] !== normalized2[key]) {
      return false;
    }
  }

  return true;
}

/**
 * Find a matching theme name for the given theme variables
 * Returns the theme name if found, or null if no match
 */
export function findMatchingTheme(currentVariables: Record<string, string>): string | null {
  const availableThemes = getAvailableThemes();

  for (const theme of availableThemes) {
    const themeVars = getThemeCSSVariables(theme.name);
    if (!themeVars) {
      continue;
    }

    const flattenedThemeVars = flattenThemeVariablesWithModes(themeVars);
    if (compareThemeVariables(currentVariables, flattenedThemeVars)) {
      return theme.name;
    }
  }

  return null;
}
