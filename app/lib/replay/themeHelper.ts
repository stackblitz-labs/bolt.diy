import { tweakcnThemeRegistry } from '~/lib/tweakcn';

export interface ThemeOption {
  name: string;
  title: string;
  description: string;
}

export interface ThemeCSSVariables {
  light?: Record<string, string>;
  dark?: Record<string, string>;
  theme?: Record<string, string>;
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

  // Add theme-level variables (font-sans, radius, etc.)
  if (cssVars.theme) {
    Object.entries(cssVars.theme).forEach(([key, value]) => {
      flattened[`--${key}`] = value;
    });
  }

  // Add mode-specific variables (light or dark)
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

  // Add theme-level variables (font-sans, radius, etc.) - these apply to both modes
  if (cssVars.theme) {
    Object.entries(cssVars.theme).forEach(([key, value]) => {
      flattened[`--${key}`] = value;
    });
  }

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
      // Only light value exists
      flattened[`--${key}`] = lightValue;
    } else if (darkValue) {
      // Only dark value exists - use -dark suffix
      flattened[`--${key}-dark`] = darkValue;
    }
  });

  return flattened;
}
