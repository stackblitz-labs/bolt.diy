import { getThemeCSSVariables, flattenThemeVariablesWithModes } from '~/lib/replay/themeHelper';
import { markThemeChanged } from '~/lib/stores/designSystemStore';

// Get iframe reference
export const getIframe = (): HTMLIFrameElement | null => {
  return document.querySelector('iframe');
};

// Get all iframes (for multi-device preview)
export const getAllIframes = (): HTMLIFrameElement[] => {
  return Array.from(document.querySelectorAll('iframe'));
};

// Send CSS variables to iframe
export const sendVariablesToIframe = (variables: Record<string, string>): void => {
  const iframe = getIframe();
  if (!iframe?.contentWindow) {
    return;
  }
  iframe.contentWindow.postMessage(
    {
      type: 'UPDATE_CSS_VARIABLES',
      variables,
      source: 'nut-preview',
    },
    '*',
  );
};

// Send CSS variables to all iframes (for multi-device preview)
export const sendVariablesToAllIframes = (variables: Record<string, string>): void => {
  const iframes = getAllIframes();
  iframes.forEach((iframe) => {
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage(
        {
          type: 'UPDATE_CSS_VARIABLES',
          variables,
          source: 'nut-preview',
        },
        '*',
      );
    }
  });
};

// Send theme to iframe
export const sendThemeToIframe = (themeName: string): void => {
  const iframe = getIframe();
  if (!iframe?.contentWindow) {
    console.warn('[ThemeUtils] No iframe found to send theme');
    return;
  }

  const cssVars = getThemeCSSVariables(themeName);
  if (!cssVars) {
    console.warn('[ThemeUtils] Theme not found:', themeName);
    return;
  }

  const allVars = flattenThemeVariablesWithModes(cssVars);
  console.log('[ThemeUtils] Sending theme update:', themeName, 'with', Object.keys(allVars).length, 'variables');

  iframe.contentWindow.postMessage(
    {
      type: 'UPDATE_CSS_VARIABLES',
      variables: allVars,
      source: 'nut-preview',
    },
    '*',
  );
};

// Send theme to all iframes (for multi-device preview)
export const sendThemeToAllIframes = (themeName: string): void => {
  const iframes = getAllIframes();
  if (iframes.length === 0) {
    console.warn('[ThemeUtils] No iframes found to send theme');
    return;
  }

  const cssVars = getThemeCSSVariables(themeName);
  if (!cssVars) {
    console.warn('[ThemeUtils] Theme not found:', themeName);
    return;
  }

  const allVars = flattenThemeVariablesWithModes(cssVars);
  console.log(
    '[ThemeUtils] Sending theme update to',
    iframes.length,
    'iframes:',
    themeName,
    'with',
    Object.keys(allVars).length,
    'variables',
  );

  iframes.forEach((iframe) => {
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage(
        {
          type: 'UPDATE_CSS_VARIABLES',
          variables: allVars,
          source: 'nut-preview',
        },
        '*',
      );
    }
  });
};

// Send theme mode to iframe
export const sendThemeModeToIframe = (mode: 'light' | 'dark'): void => {
  const iframe = getIframe();
  if (iframe?.contentWindow) {
    iframe.contentWindow.postMessage(
      {
        type: 'SET_THEME',
        theme: mode,
        source: 'nut-preview',
      },
      '*',
    );
  }
};

// Send theme mode to all iframes (for multi-device preview)
export const sendThemeModeToAllIframes = (mode: 'light' | 'dark'): void => {
  const iframes = getAllIframes();
  iframes.forEach((iframe) => {
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage(
        {
          type: 'SET_THEME',
          theme: mode,
          source: 'nut-preview',
        },
        '*',
      );
    }
  });
};

// Request current variables from iframe
export const requestCurrentVariables = (): Promise<Record<string, string> | null> => {
  return new Promise((resolve) => {
    const iframe = getIframe();
    if (!iframe?.contentWindow) {
      resolve(null);
      return;
    }

    const requestId = Date.now().toString();
    let resolved = false;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.id === requestId && event.data?.response && event.data?.source === '@@replay-nut') {
        resolved = true;
        window.removeEventListener('message', handleMessage);
        resolve(event.data.response as Record<string, string>);
      }
    };

    window.addEventListener('message', handleMessage);

    try {
      iframe.contentWindow.postMessage(
        {
          id: requestId,
          request: 'get-custom-variables',
          source: '@@replay-nut',
        },
        '*',
      );
    } catch (error) {
      console.warn('[ThemeUtils] Failed to request custom variables:', error);
      window.removeEventListener('message', handleMessage);
      resolve(null);
      return;
    }

    // Timeout after 5 seconds
    setTimeout(() => {
      if (!resolved) {
        window.removeEventListener('message', handleMessage);
        console.warn('[ThemeUtils] No response from iframe after 5s');
        resolve(null);
      }
    }, 5000);
  });
};

// Extract colors from variables
export const extractColorsFromVariables = (variables: Record<string, string>): string[] => {
  const colorKeys = ['--primary', '--secondary', '--accent', '--muted'];
  const colors: string[] = [];
  colorKeys.forEach((key) => {
    const value = variables[key];
    if (value) {
      // Extract HSL value (format: "217 91% 60%" or "217 91% 60% .dark: ...")
      const hslMatch = value.match(/^([\d.]+ [\d.]+% [\d.]+%)/);
      if (hslMatch) {
        colors.push(`hsl(${hslMatch[1]})`);
      }
    }
  });
  return colors;
};

// Parse variable value (handles .dark: separator)
export const parseVariableValue = (value: string | number | undefined | null): { light?: string; dark?: string } => {
  const stripQuotes = (val: string) => val.trim().replace(/^["']|["']$/g, '');

  const stringValue = value != null ? String(value) : '';

  if (stringValue.includes('.dark:')) {
    const [lightPart, darkPart] = stringValue.split('.dark:');
    return {
      light: stripQuotes(lightPart),
      dark: darkPart ? stripQuotes(darkPart) : undefined,
    };
  }
  return { light: stripQuotes(stringValue) };
};

// HSL to Hex conversion
export const hslToHex = (hsl: string): string => {
  const [h, s, l] = hsl.split(' ').map((v) => parseFloat(v));
  const hue = h / 360;
  const sat = s / 100;
  const light = l / 100;

  const toHex = (n: number) => {
    const hex = Math.round(n * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) {
      t += 1;
    }
    if (t > 1) {
      t -= 1;
    }
    if (t < 1 / 6) {
      return p + (q - p) * 6 * t;
    }
    if (t < 1 / 2) {
      return q;
    }
    if (t < 2 / 3) {
      return p + (q - p) * (2 / 3 - t) * 6;
    }
    return p;
  };

  const q = light < 0.5 ? light * (1 + sat) : light + sat - light * sat;
  const p = 2 * light - q;
  const r = hue2rgb(p, q, hue + 1 / 3);
  const g = hue2rgb(p, q, hue);
  const b = hue2rgb(p, q, hue - 1 / 3);

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

// Get theme colors for preview (returns HSL colors as CSS strings)
export const getThemeColors = (themeName: string): string[] => {
  const cssVars = getThemeCSSVariables(themeName);
  if (!cssVars) {
    return [];
  }
  const flattened = flattenThemeVariablesWithModes(cssVars);
  return extractColorsFromVariables(flattened);
};

// Hex to HSL conversion
export const hexToHsl = (hex: string): string => {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
};

// Diff current theme variables with new theme and mark changes
export const diffAndMarkThemeChanges = (currentVariables: Record<string, string>, newThemeName: string): number => {
  const newThemeVars = getThemeCSSVariables(newThemeName);
  if (!newThemeVars) {
    return 0;
  }

  const newThemeFlattened = flattenThemeVariablesWithModes(newThemeVars);
  let changeCount = 0;

  for (const key of Object.keys(newThemeFlattened)) {
    const currentValue = currentVariables[key];
    const newValue = newThemeFlattened[key];
    const currentValueStr = currentValue != null ? String(currentValue) : '';
    const newValueStr = newValue != null ? String(newValue) : '';

    if (currentValueStr !== newValueStr) {
      const currentParsed = parseVariableValue(currentValue);
      const newParsed = parseVariableValue(newValue);
      const currentLight = (currentParsed.light || '').trim();
      const newLight = (newParsed.light || '').trim();

      if (currentLight !== newLight && newLight !== '') {
        markThemeChanged(key, currentLight, newLight, false);
        changeCount++;
      }

      const currentDark = (currentParsed.dark || currentParsed.light || '').trim();
      const newDark = (newParsed.dark || '').trim();
      if (currentDark !== newDark && newDark !== '') {
        markThemeChanged(key, currentDark, newDark, true);
        if (currentLight === newLight) {
          changeCount++;
        }
      }
    }
  }
  return changeCount;
};
