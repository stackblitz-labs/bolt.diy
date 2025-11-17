import React, { useState, useEffect, useRef } from 'react';

import { Layout, Type, Settings, Search } from '~/components/ui/Icon';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '~/components/ui/collapsible';

import { getThemeCSSVariables, flattenThemeVariablesWithModes } from '~/lib/replay/themeHelper';

import { classNames } from '~/utils/classNames';

import { ChevronDown } from 'lucide-react';

import { markThemeChanged, resetThemeChanges } from '~/lib/stores/themeChanges';

type TabType = 'colors' | 'typography' | 'other';

interface ColorPickerProps {
  label: string;
  lightValue: string;
  darkValue?: string;
  onLightChange: (value: string) => void;
  onDarkChange: (value: string) => void;
  onHover?: (value: string) => void;
  onHoverEnd?: () => void;
  onLightFocus?: () => void;
  onDarkFocus?: () => void;
  onLightBlur?: () => void;
  onDarkBlur?: () => void;
}

const ColorPicker: React.FC<ColorPickerProps> = ({
  label,
  lightValue,
  darkValue,
  onLightChange,
  onDarkChange,
  onHover,
  onHoverEnd,
  onLightFocus,
  onDarkFocus,
  onLightBlur,
  onDarkBlur,
}) => {
  const [lightHslValue, setLightHslValue] = useState(lightValue);
  const [darkHslValue, setDarkHslValue] = useState(darkValue || lightValue);

  useEffect(() => {
    setLightHslValue(lightValue);
  }, [lightValue]);

  useEffect(() => {
    setDarkHslValue(darkValue || lightValue);
  }, [darkValue, lightValue]);

  const handleLightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLightHslValue(newValue);
    onLightChange(newValue);
  };

  const handleDarkChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setDarkHslValue(newValue);
    onDarkChange(newValue);
  };

  // Convert HSL to hex for color picker
  const hslToHex = (hsl: string) => {
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

  // Convert hex to HSL
  const hexToHsl = (hex: string) => {
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

  const handleLightColorPickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const hex = e.target.value;
    const newHsl = hexToHsl(hex);
    setLightHslValue(newHsl);
    onLightChange(newHsl);
  };

  const handleDarkColorPickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const hex = e.target.value;
    const newHsl = hexToHsl(hex);
    setDarkHslValue(newHsl);
    onDarkChange(newHsl);
  };

  return (
    <div className="space-y-2">
      <label className="text-xs text-bolt-elements-textSecondary">{label}</label>
      <div className="grid grid-cols-1 @[500px]:grid-cols-2 gap-2">
        {/* Light Mode */}
        <div className="flex items-center gap-2">
          <div className="relative w-10 h-10 flex-shrink-0">
            <div
              className="w-full h-full rounded border border-bolt-elements-borderColor cursor-pointer"
              style={{ backgroundColor: `hsl(${lightHslValue})` }}
            />
            <input
              type="color"
              value={hslToHex(lightHslValue)}
              onChange={handleLightColorPickerChange}
              onFocus={onLightFocus}
              onBlur={onLightBlur}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              title="Click to pick light mode color"
            />
          </div>
          <div className="flex-1 flex flex-col min-w-0">
            <span className="text-xs text-bolt-elements-textSecondary mb-1">Light</span>
            <input
              type="text"
              value={lightHslValue}
              onChange={handleLightChange}
              onMouseEnter={() => onHover?.(lightHslValue)}
              onMouseLeave={onHoverEnd}
              onFocus={() => {
                onHover?.(lightHslValue);
                onLightFocus?.();
              }}
              onBlur={() => {
                onHoverEnd?.();
                onLightBlur?.();
              }}
              className="px-2 py-1.5 text-xs bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor rounded-md focus:outline-none focus:border-bolt-elements-borderColorActive focus:ring-1 focus:ring-bolt-elements-borderColorActive text-bolt-elements-textPrimary w-full"
              placeholder="0 0% 0%"
            />
          </div>
        </div>
        {/* Dark Mode */}
        <div className="flex items-center gap-2">
          <div className="relative w-10 h-10 flex-shrink-0">
            <div
              className="w-full h-full rounded border border-bolt-elements-borderColor cursor-pointer"
              style={{ backgroundColor: `hsl(${darkHslValue})` }}
            />
            <input
              type="color"
              value={hslToHex(darkHslValue)}
              onChange={handleDarkColorPickerChange}
              onFocus={onDarkFocus}
              onBlur={onDarkBlur}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              title="Click to pick dark mode color"
            />
          </div>
          <div className="flex-1 flex flex-col min-w-0">
            <span className="text-xs text-bolt-elements-textSecondary mb-1">Dark</span>
            <input
              type="text"
              value={darkHslValue}
              onChange={handleDarkChange}
              onMouseEnter={() => onHover?.(darkHslValue)}
              onMouseLeave={onHoverEnd}
              onFocus={() => {
                onHover?.(darkHslValue);
                onDarkFocus?.();
              }}
              onBlur={() => {
                onHoverEnd?.();
                onDarkBlur?.();
              }}
              className="px-2 py-1.5 text-xs bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor rounded-md focus:outline-none focus:border-bolt-elements-borderColorActive focus:ring-1 focus:ring-bolt-elements-borderColorActive text-bolt-elements-textPrimary w-full"
              placeholder="0 0% 0%"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

interface TweakCNProps {
  selectedTheme?: string;
  hoveredTheme?: string | null;
  onThemeChange?: (theme: string) => void;
  onThemeModeChange?: (mode: 'light' | 'dark') => void;
}

export const TweakCN: React.FC<TweakCNProps> = ({
  selectedTheme: externalSelectedTheme,
  hoveredTheme: externalHoveredTheme,
  onThemeChange: _onThemeChange,
  onThemeModeChange,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('colors');
  const [internalSelectedTheme, setInternalSelectedTheme] = useState<string>('modern-minimal');
  const [internalHoveredTheme, setInternalHoveredTheme] = useState<string | null>(null);

  // Use external theme if provided, otherwise use internal
  const selectedTheme = externalSelectedTheme || internalSelectedTheme;
  const hoveredTheme = externalHoveredTheme !== undefined ? externalHoveredTheme : internalHoveredTheme;

  // Theme customization state
  const [customTheme, setCustomTheme] = useState<Record<string, string>>({});
  const [_hoveredCustomization, setHoveredCustomization] = useState<Record<string, string> | null>(null);

  // Store original values for tracking changes
  const originalValuesRef = useRef<{
    colors: Record<string, { light: string; dark?: string }>;
    fonts: { sans: string; serif: string; mono: string };
    radius: number;
    spacingUnit: number;
    borderWidth: number;
    additionalColors: Record<string, { light: string; dark?: string }>;
  } | null>(null);

  // Font selections
  const [sansSerifFont, setSansSerifFont] = useState('Inter, sans-serif');
  const [serifFont, setSerifFont] = useState('Source Serif 4, serif');
  const [monoFont, setMonoFont] = useState('JetBrains Mono, monospace');

  const [radius, setRadius] = useState(0.625);

  // Typography settings
  const [lineHeight, setLineHeight] = useState<'tight' | 'normal' | 'relaxed'>('normal');
  const [fontWeight, setFontWeight] = useState<'normal' | 'medium' | 'semibold' | 'bold'>('normal');
  const [letterSpacingPreset, setLetterSpacingPreset] = useState<'tight' | 'normal' | 'widest'>('normal');

  // Spacing
  const [spacingUnit, setSpacingUnit] = useState(4); // 4px default (0.25rem)

  // Border
  const [borderWidth, setBorderWidth] = useState(1);

  // Font size presets
  const [fontSizeBase, setFontSizeBase] = useState(16);

  // Additional colors - store both light and dark
  const [additionalColors, setAdditionalColors] = useState<Record<string, { light: string; dark?: string }>>({
    success: { light: '142 71% 45%' },
    successForeground: { light: '0 0% 100%' },
    warning: { light: '38 92% 50%' },
    warningForeground: { light: '0 0% 0%' },
    danger: { light: '0 84% 60%' },
    dangerForeground: { light: '0 0% 100%' },
    sidebar: { light: '240 5% 6%' },
    sidebarForeground: { light: '240 5% 90%' },
    sidebarPrimary: { light: '240 6% 10%' },
    sidebarPrimaryForeground: { light: '0 0% 98%' },
    sidebarAccent: { light: '240 4% 16%' },
    sidebarAccentForeground: { light: '240 6% 90%' },
    sidebarBorder: { light: '240 4% 16%' },
    sidebarRing: { light: '217 91% 60%' },
  });

  // Color values from the current theme - store both light and dark
  const [colors, setColors] = useState<Record<string, { light: string; dark?: string }>>({
    primary: { light: '38 92% 50%' },
    primaryForeground: { light: '0 0% 0%' },
    secondary: { light: '220 14% 96%' },
    secondaryForeground: { light: '215 14% 34%' },
    accent: { light: '48 100% 96%' },
    accentForeground: { light: '23 83% 31%' },
    background: { light: '0 0% 100%' },
    foreground: { light: '0 0% 15%' },
    card: { light: '0 0% 100%' },
    cardForeground: { light: '0 0% 15%' },
    muted: { light: '210 20% 98%' },
    mutedForeground: { light: '220 9% 46%' },
    border: { light: '220 13% 91%' },
    destructive: { light: '0 84% 60%' },
    destructiveForeground: { light: '0 0% 100%' },
  });

  // Font search state
  const [sansSerifSearch, setSansSerifSearch] = useState('');
  const [serifSearch, setSerifSearch] = useState('');
  const [monoSearch, setMonoSearch] = useState('');

  // Comprehensive font options organized by category
  const sansSerifFonts = [
    'Inter, sans-serif',
    'Roboto, sans-serif',
    'Open Sans, sans-serif',
    'Lato, sans-serif',
    'Montserrat, sans-serif',
    'Source Sans Pro, sans-serif',
    'Raleway, sans-serif',
    'PT Sans, sans-serif',
    'Nunito, sans-serif',
    'Poppins, sans-serif',
    'Ubuntu, sans-serif',
    'Oswald, sans-serif',
    'Mulish, sans-serif',
    'Work Sans, sans-serif',
    'Rubik, sans-serif',
    'Manrope, sans-serif',
    'DM Sans, sans-serif',
    'Outfit, sans-serif',
    'Plus Jakarta Sans, sans-serif',
    'Space Grotesk, sans-serif',
    'Archivo, sans-serif',
    'Barlow, sans-serif',
    'Karla, sans-serif',
    'Public Sans, sans-serif',
    'Red Hat Display, sans-serif',
    'Quicksand, sans-serif',
    'Josefin Sans, sans-serif',
    'Varela Round, sans-serif',
    'Nunito Sans, sans-serif',
    'Assistant, sans-serif',
    'Heebo, sans-serif',
    'Maven Pro, sans-serif',
    'IBM Plex Sans, sans-serif',
    'Cabin, sans-serif',
    'Lexend, sans-serif',
    'Mukta, sans-serif',
    'Titillium Web, sans-serif',
    'Exo 2, sans-serif',
    'Hind, sans-serif',
    'Oxygen, sans-serif',
    'ABeeZee, sans-serif',
    'Advent Pro, sans-serif',
    'Alata, sans-serif',
    'Almarai, sans-serif',
    'Antic, sans-serif',
    'Architects Daughter, cursive',
    'Asap, sans-serif',
    'Bebas Neue, sans-serif',
    'Cairo, sans-serif',
    'Comfortaa, sans-serif',
    'Dosis, sans-serif',
    'Figtree, sans-serif',
    'Hind Siliguri, sans-serif',
    'Jost, sans-serif',
    'Kanit, sans-serif',
    'M PLUS Rounded 1c, sans-serif',
    'Noto Sans, sans-serif',
    'Overpass, sans-serif',
    'Play, sans-serif',
    'Prompt, sans-serif',
    'Questrial, sans-serif',
    'Rajdhani, sans-serif',
    'Saira, sans-serif',
    'Signika, sans-serif',
    'Tajawal, sans-serif',
    'Urbanist, sans-serif',
    'Yantramanav, sans-serif',
  ];

  const serifFonts = [
    'Merriweather, serif',
    'PT Serif, serif',
    'Playfair Display, serif',
    'Lora, serif',
    'Source Serif 4, serif',
    'Noto Serif, serif',
    'Crimson Text, serif',
    'Libre Baskerville, serif',
    'EB Garamond, serif',
    'Bitter, serif',
    'Arvo, serif',
    'Vollkorn, serif',
    'Cardo, serif',
    'Old Standard TT, serif',
    'Cormorant Garamond, serif',
    'Neuton, serif',
    'Spectral, serif',
    'Alegreya, serif',
    'PT Serif Caption, serif',
    'Frank Ruhl Libre, serif',
    'IBM Plex Serif, serif',
    'Crimson Pro, serif',
    'Literata, serif',
    'Brygada 1918, serif',
    'Georgia, serif',
    'Times New Roman, serif',
    'Garamond, serif',
    'Baskerville, serif',
    'Palatino, serif',
    'Cambria, serif',
    'Alice, serif',
    'Arapey, serif',
    'BioRhyme, serif',
    'Bree Serif, serif',
    'Caudex, serif',
    'Cinzel, serif',
    'Copse, serif',
    'Domine, serif',
    'Gelasio, serif',
    'Glegoo, serif',
    'Judson, serif',
    'Kameron, serif',
    'Ledger, serif',
    'Lusitana, serif',
    'Noticia Text, serif',
    'Poly, serif',
    'Podkova, serif',
    'Prociono, serif',
    'Quattrocento, serif',
    'Rokkitt, serif',
    'Rufina, serif',
    'Sanchez, serif',
    'Tinos, serif',
    'Ultra, serif',
    'Vidaloka, serif',
    'Yeseva One, serif',
  ];

  const monoFonts = [
    'Roboto Mono, monospace',
    'JetBrains Mono, monospace',
    'Source Code Pro, monospace',
    'Fira Code, monospace',
    'Ubuntu Mono, monospace',
    'Inconsolata, monospace',
    'Space Mono, monospace',
    'IBM Plex Mono, monospace',
    'Courier Prime, monospace',
    'PT Mono, monospace',
    'Anonymous Pro, monospace',
    'Overpass Mono, monospace',
    'Cousine, monospace',
    'Share Tech Mono, monospace',
    'DM Mono, monospace',
    'Red Hat Mono, monospace',
    'Azeret Mono, monospace',
    'B612 Mono, monospace',
    'Courier New, monospace',
    'Monaco, monospace',
    'Consolas, monospace',
    'Menlo, monospace',
    'Cascadia Code, monospace',
    'Noto Sans Mono, monospace',
    'Oxygen Mono, monospace',
    'VT323, monospace',
    'Major Mono Display, monospace',
    'Cutive Mono, monospace',
    'Nova Mono, monospace',
    'Syne Mono, monospace',
    'Xanh Mono, monospace',
  ];

  // Filter fonts based on search
  const filteredSansSerifFonts = sansSerifFonts.filter((font) =>
    font.toLowerCase().includes(sansSerifSearch.toLowerCase()),
  );
  const filteredSerifFonts = serifFonts.filter((font) => font.toLowerCase().includes(serifSearch.toLowerCase()));
  const filteredMonoFonts = monoFonts.filter((font) => font.toLowerCase().includes(monoSearch.toLowerCase()));

  // Get iframe reference
  const getIframe = () => {
    return document.querySelector('iframe');
  };

  // Function to send theme to iframe
  const sendThemeToIframe = (themeName: string) => {
    const iframe = getIframe();
    if (!iframe?.contentWindow) {
      console.warn('[BuildMockup] No iframe found to send theme');
      return;
    }

    const cssVars = getThemeCSSVariables(themeName);
    if (!cssVars) {
      console.warn('[BuildMockup] Theme not found:', themeName);
      return;
    }

    // Flatten variables with both light and dark mode values
    const allVars = flattenThemeVariablesWithModes(cssVars);

    console.log('[BuildMockup] Sending theme update:', themeName, 'with', Object.keys(allVars).length, 'variables');

    // Send CSS variables via postMessage
    iframe.contentWindow.postMessage(
      {
        type: 'UPDATE_CSS_VARIABLES',
        variables: allVars,
        source: 'nut-preview',
      },
      '*',
    );
  };

  // Helper to parse CSS variable values (handles .dark: separator)
  const parseVariableValue = (value: string | number | undefined | null): { light?: string; dark?: string } => {
    // Strip quotes from the value if present
    const stripQuotes = (val: string) => val.trim().replace(/^["']|["']$/g, '');

    // Ensure value is a string
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

  // Helper to load theme variables from iframe for custom theme
  const loadCustomThemeFromIframe = () => {
    const iframe = getIframe();
    if (!iframe?.contentWindow) {
      return;
    }

    const requestId = Date.now().toString();
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.id === requestId && event.data?.response && event.data?.source === '@@replay-nut') {
        window.removeEventListener('message', handleMessage);

        const currentVariables = event.data.response as Record<string, string>;
        if (currentVariables && Object.keys(currentVariables).length > 0) {
          // Parse variables and load into state
          // Shared variables (fonts, radius) are now treated as light variables
          const lightColors: Record<string, string> = {};
          const darkColors: Record<string, string> = {};

          // Helper to strip quotes from values
          const stripQuotes = (val: string) => val.trim().replace(/^["']|["']$/g, '');

          Object.entries(currentVariables).forEach(([key, value]) => {
            if (key.endsWith('-dark')) {
              const baseKey = key.slice(0, -5);
              darkColors[baseKey.replace('--', '')] = stripQuotes(value);
            } else {
              const parsed = parseVariableValue(value);
              const baseKey = key.replace('--', '');
              if (parsed.light) {
                lightColors[baseKey] = parsed.light;
              }
              if (parsed.dark) {
                darkColors[baseKey] = parsed.dark;
              }
            }
          });

          // Update colors state with both light and dark values
          const newColors: Record<string, { light: string; dark?: string }> = {
            primary: {
              light: lightColors.primary || '38 92% 50%',
              dark: darkColors.primary,
            },
            primaryForeground: {
              light: lightColors['primary-foreground'] || '0 0% 0%',
              dark: darkColors['primary-foreground'],
            },
            secondary: {
              light: lightColors.secondary || '220 14% 96%',
              dark: darkColors.secondary,
            },
            secondaryForeground: {
              light: lightColors['secondary-foreground'] || '215 14% 34%',
              dark: darkColors['secondary-foreground'],
            },
            accent: {
              light: lightColors.accent || '48 100% 96%',
              dark: darkColors.accent,
            },
            accentForeground: {
              light: lightColors['accent-foreground'] || '23 83% 31%',
              dark: darkColors['accent-foreground'],
            },
            background: {
              light: lightColors.background || '0 0% 100%',
              dark: darkColors.background,
            },
            foreground: {
              light: lightColors.foreground || '0 0% 15%',
              dark: darkColors.foreground,
            },
            card: {
              light: lightColors.card || '0 0% 100%',
              dark: darkColors.card,
            },
            cardForeground: {
              light: lightColors['card-foreground'] || '0 0% 15%',
              dark: darkColors['card-foreground'],
            },
            muted: {
              light: lightColors.muted || '210 20% 98%',
              dark: darkColors.muted,
            },
            mutedForeground: {
              light: lightColors['muted-foreground'] || '220 9% 46%',
              dark: darkColors['muted-foreground'],
            },
            border: {
              light: lightColors.border || '220 13% 91%',
              dark: darkColors.border,
            },
            destructive: {
              light: lightColors.destructive || '0 84% 60%',
              dark: darkColors.destructive,
            },
            destructiveForeground: {
              light: lightColors['destructive-foreground'] || '0 0% 100%',
              dark: darkColors['destructive-foreground'],
            },
          };

          setColors(newColors);

          // Update fonts and radius from light variables (shared variables are now in light)
          if (lightColors['font-sans']) {
            setSansSerifFont(lightColors['font-sans']);
          }
          if (lightColors['font-serif']) {
            setSerifFont(lightColors['font-serif']);
          }
          if (lightColors['font-mono']) {
            setMonoFont(lightColors['font-mono']);
          }
          if (lightColors.radius) {
            const radiusValue = parseFloat(lightColors.radius);
            if (!isNaN(radiusValue)) {
              setRadius(radiusValue);
            }
          }

          // Update additional colors state with both light and dark values
          const newAdditionalColors: Record<string, { light: string; dark?: string }> = {
            success: {
              light: lightColors.success || '142 71% 45%',
              dark: darkColors.success,
            },
            successForeground: {
              light: lightColors['success-foreground'] || '0 0% 100%',
              dark: darkColors['success-foreground'],
            },
            warning: {
              light: lightColors.warning || '38 92% 50%',
              dark: darkColors.warning,
            },
            warningForeground: {
              light: lightColors['warning-foreground'] || '0 0% 0%',
              dark: darkColors['warning-foreground'],
            },
            danger: {
              light: lightColors.danger || '0 84% 60%',
              dark: darkColors.danger,
            },
            dangerForeground: {
              light: lightColors['danger-foreground'] || '0 0% 100%',
              dark: darkColors['danger-foreground'],
            },
            sidebar: {
              light: lightColors.sidebar || '240 5% 6%',
              dark: darkColors.sidebar,
            },
            sidebarForeground: {
              light: lightColors['sidebar-foreground'] || '240 5% 90%',
              dark: darkColors['sidebar-foreground'],
            },
            sidebarPrimary: {
              light: lightColors['sidebar-primary'] || '240 6% 10%',
              dark: darkColors['sidebar-primary'],
            },
            sidebarPrimaryForeground: {
              light: lightColors['sidebar-primary-foreground'] || '0 0% 98%',
              dark: darkColors['sidebar-primary-foreground'],
            },
            sidebarAccent: {
              light: lightColors['sidebar-accent'] || '240 4% 16%',
              dark: darkColors['sidebar-accent'],
            },
            sidebarAccentForeground: {
              light: lightColors['sidebar-accent-foreground'] || '240 6% 90%',
              dark: darkColors['sidebar-accent-foreground'],
            },
            sidebarBorder: {
              light: lightColors['sidebar-border'] || '240 4% 16%',
              dark: darkColors['sidebar-border'],
            },
            sidebarRing: {
              light: lightColors['sidebar-ring'] || '217 91% 60%',
              dark: darkColors['sidebar-ring'],
            },
          };

          setAdditionalColors(newAdditionalColors);

          // Store original values with both light and dark
          originalValuesRef.current = {
            colors: { ...newColors },
            fonts: {
              sans: lightColors['font-sans'] || 'Inter, sans-serif',
              serif: lightColors['font-serif'] || 'Source Serif 4, serif',
              mono: lightColors['font-mono'] || 'JetBrains Mono, monospace',
            },
            radius: lightColors.radius ? parseFloat(lightColors.radius) : 0.625,
            spacingUnit: 4,
            borderWidth: 1,
            additionalColors: { ...newAdditionalColors },
          };
        }
      }
    };

    window.addEventListener('message', handleMessage);
    iframe.contentWindow.postMessage(
      {
        id: requestId,
        request: 'get-custom-variables',
        source: '@@replay-nut',
      },
      '*',
    );

    setTimeout(() => {
      window.removeEventListener('message', handleMessage);
    }, 5000);
  };

  // Helper to diff current theme variables with new theme and mark changes
  const diffAndMarkThemeChanges = (currentVariables: Record<string, string>, newThemeName: string): number => {
    const newThemeVars = getThemeCSSVariables(newThemeName);
    if (!newThemeVars) {
      return 0;
    }

    const newThemeFlattened = flattenThemeVariablesWithModes(newThemeVars);
    let changeCount = 0;

    // Helper to parse variable value (handles .dark: separator)
    const parseVariableValue = (value: string | number | undefined | null): { light?: string; dark?: string } => {
      const stripQuotes = (val: string) => val.trim().replace(/^["']|["']$/g, '');

      // Ensure value is a string
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

    // Compare each variable
    const allKeys = new Set([...Object.keys(currentVariables), ...Object.keys(newThemeFlattened)]);

    for (const key of allKeys) {
      const currentValue = currentVariables[key];
      const newValue = newThemeFlattened[key];

      // Convert to strings for comparison
      const currentValueStr = currentValue != null ? String(currentValue) : '';
      const newValueStr = newValue != null ? String(newValue) : '';

      if (currentValueStr !== newValueStr) {
        const currentParsed = parseVariableValue(currentValue);
        const newParsed = parseVariableValue(newValue);

        // Mark light mode change if different
        if (currentParsed.light !== newParsed.light) {
          markThemeChanged(key, currentParsed.light || '', newParsed.light || '', false);
          changeCount++;
        }

        // Mark dark mode change if different
        if (currentParsed.dark !== newParsed.dark) {
          markThemeChanged(key, currentParsed.dark || currentParsed.light || '', newParsed.dark || '', true);
          if (currentParsed.light === newParsed.light) {
            // Only count if light wasn't already counted
            changeCount++;
          }
        }
      }
    }

    return changeCount;
  };

  // Apply theme when selected and load its values into the panel
  useEffect(() => {
    console.log('[TweakCN] Selected theme changed to:', selectedTheme);

    // If custom theme, load current values from iframe
    if (selectedTheme === 'custom') {
      loadCustomThemeFromIframe();
      return;
    }

    // Get current variables from iframe before resetting and applying new theme
    const iframe = getIframe();
    if (iframe?.contentWindow) {
      const requestId = Date.now().toString();
      const handleMessage = (event: MessageEvent) => {
        if (event.data?.id === requestId && event.data?.response && event.data?.source === '@@replay-nut') {
          window.removeEventListener('message', handleMessage);

          const currentVariables = event.data.response as Record<string, string>;

          // Reset theme changes first
          resetThemeChanges();

          // Diff and mark all changes before applying new theme
          if (currentVariables && Object.keys(currentVariables).length > 0) {
            const changeCount = diffAndMarkThemeChanges(currentVariables, selectedTheme);
            console.log(`[TweakCN] Theme change will modify ${changeCount} variables`);
          }

          // Now apply the new theme
          sendThemeToIframe(selectedTheme);
          loadThemeIntoState(selectedTheme);
        }
      };

      window.addEventListener('message', handleMessage);

      // Try to request current variables, but handle gracefully if not supported
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
        console.warn('[TweakCN] Failed to request custom variables:', error);
        // If request fails, just apply theme without diffing
        resetThemeChanges();
        sendThemeToIframe(selectedTheme);
        loadThemeIntoState(selectedTheme);
        return;
      }

      setTimeout(() => {
        window.removeEventListener('message', handleMessage);
        // Fallback: if no response, just apply theme without diffing
        resetThemeChanges();
        sendThemeToIframe(selectedTheme);
        loadThemeIntoState(selectedTheme);
      }, 5000);
    } else {
      // No iframe, just reset and apply theme
      resetThemeChanges();
      sendThemeToIframe(selectedTheme);
      loadThemeIntoState(selectedTheme);
    }
  }, [selectedTheme]);

  // Helper to load theme into state (extracted for reuse)
  const loadThemeIntoState = (themeName: string) => {
    const cssVars = getThemeCSSVariables(themeName);
    if (!cssVars) {
      return;
    }

    // Extract both light and dark mode colors
    // Shared variables (fonts, radius) are now in light
    const lightColors = cssVars.light || {};
    const darkColors = cssVars.dark || {};

    const newColors: Record<string, { light: string; dark?: string }> = {
      primary: {
        light: lightColors.primary || '38 92% 50%',
        dark: darkColors.primary,
      },
      primaryForeground: {
        light: lightColors['primary-foreground'] || '0 0% 0%',
        dark: darkColors['primary-foreground'],
      },
      secondary: {
        light: lightColors.secondary || '220 14% 96%',
        dark: darkColors.secondary,
      },
      secondaryForeground: {
        light: lightColors['secondary-foreground'] || '215 14% 34%',
        dark: darkColors['secondary-foreground'],
      },
      accent: {
        light: lightColors.accent || '48 100% 96%',
        dark: darkColors.accent,
      },
      accentForeground: {
        light: lightColors['accent-foreground'] || '23 83% 31%',
        dark: darkColors['accent-foreground'],
      },
      background: {
        light: lightColors.background || '0 0% 100%',
        dark: darkColors.background,
      },
      foreground: {
        light: lightColors.foreground || '0 0% 15%',
        dark: darkColors.foreground,
      },
      card: {
        light: lightColors.card || '0 0% 100%',
        dark: darkColors.card,
      },
      cardForeground: {
        light: lightColors['card-foreground'] || '0 0% 15%',
        dark: darkColors['card-foreground'],
      },
      muted: {
        light: lightColors.muted || '210 20% 98%',
        dark: darkColors.muted,
      },
      mutedForeground: {
        light: lightColors['muted-foreground'] || '220 9% 46%',
        dark: darkColors['muted-foreground'],
      },
      border: {
        light: lightColors.border || '220 13% 91%',
        dark: darkColors.border,
      },
      destructive: {
        light: lightColors.destructive || '0 84% 60%',
        dark: darkColors.destructive,
      },
      destructiveForeground: {
        light: lightColors['destructive-foreground'] || '0 0% 100%',
        dark: darkColors['destructive-foreground'],
      },
    };

    setColors(newColors);

    // Load font settings from light variables (shared variables are now in light)
    const newSansFont = lightColors['font-sans'] || 'Inter, sans-serif';
    const newSerifFont = lightColors['font-serif'] || 'Source Serif 4, serif';
    const newMonoFont = lightColors['font-mono'] || 'JetBrains Mono, monospace';
    const newRadius = lightColors.radius ? parseFloat(lightColors.radius) : 0.625;

    setSansSerifFont(newSansFont);
    setSerifFont(newSerifFont);
    setMonoFont(newMonoFont);
    if (!isNaN(newRadius)) {
      setRadius(newRadius);
    }

    // Store original values for change tracking with both light and dark
    const newAdditionalColors: Record<string, { light: string; dark?: string }> = {
      success: {
        light: lightColors.success || '142 71% 45%',
        dark: darkColors.success,
      },
      successForeground: {
        light: lightColors['success-foreground'] || '0 0% 100%',
        dark: darkColors['success-foreground'],
      },
      warning: {
        light: lightColors.warning || '38 92% 50%',
        dark: darkColors.warning,
      },
      warningForeground: {
        light: lightColors['warning-foreground'] || '0 0% 0%',
        dark: darkColors['warning-foreground'],
      },
      danger: {
        light: lightColors.danger || '0 84% 60%',
        dark: darkColors.danger,
      },
      dangerForeground: {
        light: lightColors['danger-foreground'] || '0 0% 100%',
        dark: darkColors['danger-foreground'],
      },
      sidebar: {
        light: lightColors.sidebar || '240 5% 6%',
        dark: darkColors.sidebar,
      },
      sidebarForeground: {
        light: lightColors['sidebar-foreground'] || '240 5% 90%',
        dark: darkColors['sidebar-foreground'],
      },
      sidebarPrimary: {
        light: lightColors['sidebar-primary'] || '240 6% 10%',
        dark: darkColors['sidebar-primary'],
      },
      sidebarPrimaryForeground: {
        light: lightColors['sidebar-primary-foreground'] || '0 0% 98%',
        dark: darkColors['sidebar-primary-foreground'],
      },
      sidebarAccent: {
        light: lightColors['sidebar-accent'] || '240 4% 16%',
        dark: darkColors['sidebar-accent'],
      },
      sidebarAccentForeground: {
        light: lightColors['sidebar-accent-foreground'] || '240 6% 90%',
        dark: darkColors['sidebar-accent-foreground'],
      },
      sidebarBorder: {
        light: lightColors['sidebar-border'] || '240 4% 16%',
        dark: darkColors['sidebar-border'],
      },
      sidebarRing: {
        light: lightColors['sidebar-ring'] || '217 91% 60%',
        dark: darkColors['sidebar-ring'],
      },
    };

    setAdditionalColors(newAdditionalColors);

    originalValuesRef.current = {
      colors: { ...newColors },
      fonts: {
        sans: newSansFont,
        serif: newSerifFont,
        mono: newMonoFont,
      },
      radius: newRadius,
      spacingUnit: 4, // Default spacing unit
      borderWidth: 1, // Default border width
      additionalColors: { ...newAdditionalColors },
    };
  };

  // Apply hovered theme preview
  useEffect(() => {
    if (hoveredTheme) {
      sendThemeToIframe(hoveredTheme);
    } else if (selectedTheme) {
      // When hover ends (becomes null), revert to selected theme
      sendThemeToIframe(selectedTheme);
      // Re-apply customizations if any
      if (Object.keys(customTheme).length > 0) {
        sendCustomizationToIframe(customTheme);
      }
    }
  }, [hoveredTheme, selectedTheme, customTheme]);

  // Handle theme selection
  const _handleThemeSelect = (themeName: string) => {
    if (_onThemeChange) {
      _onThemeChange(themeName);
    } else {
      setInternalSelectedTheme(themeName);
    }
    setInternalHoveredTheme(null);
  };

  // Helper function to send customization updates
  const sendCustomizationToIframe = (variables: Record<string, string>) => {
    const iframe = getIframe();
    if (!iframe?.contentWindow) {
      return;
    }

    console.log('[ThemeCustomization] Sending customization update:', Object.keys(variables).length, 'variables');
    iframe.contentWindow.postMessage(
      {
        type: 'UPDATE_CSS_VARIABLES',
        variables,
        source: 'nut-preview',
      },
      '*',
    );
  };

  // Handle font selection with hover preview
  const handleFontSelect = (fontType: 'sans' | 'serif' | 'mono', font: string, isHover: boolean = false) => {
    const varName = fontType === 'sans' ? '--font-sans' : fontType === 'serif' ? '--font-serif' : '--font-mono';

    if (isHover) {
      setHoveredCustomization({ [varName]: font });
      sendCustomizationToIframe({ [varName]: font });
    } else {
      // Get original value for tracking
      const originalValue =
        fontType === 'sans'
          ? originalValuesRef.current?.fonts.sans || ''
          : fontType === 'serif'
            ? originalValuesRef.current?.fonts.serif || ''
            : originalValuesRef.current?.fonts.mono || '';

      // Track change in store (app-settings category)
      markThemeChanged(varName, originalValue, font, 'app-settings');

      if (fontType === 'sans') {
        setSansSerifFont(font);
      } else if (fontType === 'serif') {
        setSerifFont(font);
      } else {
        setMonoFont(font);
      }

      setCustomTheme({ ...customTheme, [varName]: font });
      sendCustomizationToIframe({ [varName]: font });
    }
  };

  // Handle slider changes with hover preview
  const handleSliderChange = (key: string, value: number, isHover: boolean = false) => {
    const varName = `--${key}`;
    const varValue = `${value}rem`;

    if (isHover) {
      setHoveredCustomization({ [varName]: varValue });
      sendCustomizationToIframe({ [varName]: varValue });
    } else {
      // Get original value for tracking
      const originalValue =
        key === 'radius'
          ? `${originalValuesRef.current?.radius || 0.625}rem`
          : key === 'spacing-unit'
            ? `${originalValuesRef.current?.spacingUnit || 4}px`
            : key === 'border-width'
              ? `${originalValuesRef.current?.borderWidth || 1}px`
              : '';

      // Track change in store (app-settings category)
      markThemeChanged(varName, originalValue, varValue, 'app-settings');

      if (key === 'radius') {
        setRadius(value);
      }

      setCustomTheme({ ...customTheme, [varName]: varValue });
      sendCustomizationToIframe({ [varName]: varValue });
    }
  };

  // Reset to base theme when hover ends
  const handleHoverEnd = () => {
    setHoveredCustomization(null);
    // Re-send the current theme
    sendThemeToIframe(selectedTheme);
    // Re-apply customizations
    if (Object.keys(customTheme).length > 0) {
      sendCustomizationToIframe(customTheme);
    }
  };

  // Handle color changes for light mode
  const handleLightColorChange = (colorKey: string, value: string) => {
    console.log('[TweakCN] Light color changed:', colorKey, '=', value);

    const cssVarName = colorKey.replace(/([A-Z])/g, '-$1').toLowerCase();
    const currentColor = colors[colorKey] || { light: value };
    const darkValue = currentColor.dark;

    // Get original value for tracking
    const originalColor = originalValuesRef.current?.colors[colorKey];
    const originalLightValue = originalColor?.light || '';

    // Track change in store (light mode)
    markThemeChanged(`--${cssVarName}`, originalLightValue, value, false);

    // Update local state
    setColors((prev) => ({
      ...prev,
      [colorKey]: { ...prev[colorKey], light: value },
    }));

    // Send to iframe - use .dark: separator if dark value exists
    const cssVarValue = darkValue ? `${value} .dark: ${darkValue}` : value;
    sendCustomizationToIframe({ [`--${cssVarName}`]: cssVarValue });

    // Update custom theme state
    setCustomTheme((prev) => ({
      ...prev,
      [`--${cssVarName}`]: cssVarValue,
    }));
  };

  // Handle color changes for dark mode
  const handleDarkColorChange = (colorKey: string, value: string) => {
    console.log('[TweakCN] Dark color changed:', colorKey, '=', value);

    const cssVarName = colorKey.replace(/([A-Z])/g, '-$1').toLowerCase();
    const currentColor = colors[colorKey] || { light: '0 0% 0%' };
    const lightValue = currentColor.light;

    // Get original value for tracking
    const originalColor = originalValuesRef.current?.colors[colorKey];
    const originalDarkValue = originalColor?.dark || originalColor?.light || '';

    // Track change in store (dark mode)
    markThemeChanged(`--${cssVarName}`, originalDarkValue, value, true);

    // Update local state
    setColors((prev) => ({
      ...prev,
      [colorKey]: { ...prev[colorKey], dark: value },
    }));

    // Send to iframe - use .dark: separator format
    const cssVarValue = `${lightValue} .dark: ${value}`;
    sendCustomizationToIframe({ [`--${cssVarName}`]: cssVarValue });

    // Update custom theme state
    setCustomTheme((prev) => ({
      ...prev,
      [`--${cssVarName}`]: cssVarValue,
    }));
  };

  // Handle additional color changes for light mode
  const handleAdditionalLightColorChange = (colorKey: string, value: string) => {
    const cssVarName = colorKey.replace(/([A-Z])/g, '-$1').toLowerCase();
    const currentColor = additionalColors[colorKey] || { light: value };
    const darkValue = currentColor.dark;

    // Get original value for tracking
    const originalColor = originalValuesRef.current?.additionalColors[colorKey];
    const originalLightValue = originalColor?.light || '';

    // Track change in store (light mode)
    markThemeChanged(`--${cssVarName}`, originalLightValue, value, false);

    // Update local state
    setAdditionalColors((prev) => ({
      ...prev,
      [colorKey]: { ...prev[colorKey], light: value },
    }));

    // Send to iframe - use .dark: separator if dark value exists
    const cssVarValue = darkValue ? `${value} .dark: ${darkValue}` : value;
    sendCustomizationToIframe({ [`--${cssVarName}`]: cssVarValue });
  };

  // Handle additional color changes for dark mode
  const handleAdditionalDarkColorChange = (colorKey: string, value: string) => {
    const cssVarName = colorKey.replace(/([A-Z])/g, '-$1').toLowerCase();
    const currentColor = additionalColors[colorKey] || { light: '0 0% 0%' };
    const lightValue = currentColor.light;

    // Get original value for tracking
    const originalColor = originalValuesRef.current?.additionalColors[colorKey];
    const originalDarkValue = originalColor?.dark || originalColor?.light || '';

    // Track change in store (dark mode)
    markThemeChanged(`--${cssVarName}`, originalDarkValue, value, true);

    // Update local state
    setAdditionalColors((prev) => ({
      ...prev,
      [colorKey]: { ...prev[colorKey], dark: value },
    }));

    // Send to iframe - use .dark: separator format
    const cssVarValue = `${lightValue} .dark: ${value}`;
    sendCustomizationToIframe({ [`--${cssVarName}`]: cssVarValue });
  };

  const tabs = [
    { id: 'colors' as const, label: 'Colors', icon: Layout },
    { id: 'typography' as const, label: 'Typography', icon: Type },
    { id: 'other' as const, label: 'Other', icon: Settings },
  ];

  return (
    <div className="flex flex-col h-full" onClick={(e) => e.stopPropagation()}>
      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-bolt-elements-background-depth-2 rounded-none">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={classNames(
                'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'bg-bolt-elements-background-depth-3 text-bolt-elements-textPrimary'
                  : 'text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-3/50',
              )}
            >
              <Icon size={16} />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {activeTab === 'colors' && (
          <div className="space-y-4">
            {/* Primary Colors Section */}
            <Collapsible defaultOpen>
              <div className="space-y-3">
                <CollapsibleTrigger className="flex w-full items-center justify-between">
                  <h3 className="text-sm font-semibold text-bolt-elements-textPrimary">Primary Colors</h3>
                  <ChevronDown className="h-4 w-4 text-bolt-elements-textSecondary transition-transform duration-200 data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3">
                  <ColorPicker
                    label="Primary"
                    lightValue={colors.primary.light}
                    darkValue={colors.primary.dark}
                    onLightChange={(value) => handleLightColorChange('primary', value)}
                    onDarkChange={(value) => handleDarkColorChange('primary', value)}
                    onLightFocus={() => onThemeModeChange?.('light')}
                    onDarkFocus={() => onThemeModeChange?.('dark')}
                  />
                  <ColorPicker
                    label="Primary Foreground"
                    lightValue={colors.primaryForeground.light}
                    darkValue={colors.primaryForeground.dark}
                    onLightChange={(value) => handleLightColorChange('primaryForeground', value)}
                    onDarkChange={(value) => handleDarkColorChange('primaryForeground', value)}
                    onLightFocus={() => onThemeModeChange?.('light')}
                    onDarkFocus={() => onThemeModeChange?.('dark')}
                  />
                </CollapsibleContent>
              </div>
            </Collapsible>

            {/* Secondary Colors Section */}
            <Collapsible defaultOpen>
              <div className="space-y-3">
                <CollapsibleTrigger className="flex w-full items-center justify-between">
                  <h3 className="text-sm font-semibold text-bolt-elements-textPrimary">Secondary Colors</h3>
                  <ChevronDown className="h-4 w-4 text-bolt-elements-textSecondary transition-transform duration-200 data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3">
                  <ColorPicker
                    label="Secondary"
                    lightValue={colors.secondary.light}
                    darkValue={colors.secondary.dark}
                    onLightChange={(value) => handleLightColorChange('secondary', value)}
                    onDarkChange={(value) => handleDarkColorChange('secondary', value)}
                    onLightFocus={() => onThemeModeChange?.('light')}
                    onDarkFocus={() => onThemeModeChange?.('dark')}
                  />
                  <ColorPicker
                    label="Secondary Foreground"
                    lightValue={colors.secondaryForeground.light}
                    darkValue={colors.secondaryForeground.dark}
                    onLightChange={(value) => handleLightColorChange('secondaryForeground', value)}
                    onDarkChange={(value) => handleDarkColorChange('secondaryForeground', value)}
                    onLightFocus={() => onThemeModeChange?.('light')}
                    onDarkFocus={() => onThemeModeChange?.('dark')}
                  />
                </CollapsibleContent>
              </div>
            </Collapsible>

            {/* Accent Colors Section */}
            <Collapsible defaultOpen>
              <div className="space-y-3">
                <CollapsibleTrigger className="flex w-full items-center justify-between">
                  <h3 className="text-sm font-semibold text-bolt-elements-textPrimary">Accent Colors</h3>
                  <ChevronDown className="h-4 w-4 text-bolt-elements-textSecondary transition-transform duration-200 data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3">
                  <ColorPicker
                    label="Accent"
                    lightValue={colors.accent.light}
                    darkValue={colors.accent.dark}
                    onLightChange={(value) => handleLightColorChange('accent', value)}
                    onDarkChange={(value) => handleDarkColorChange('accent', value)}
                    onLightFocus={() => onThemeModeChange?.('light')}
                    onDarkFocus={() => onThemeModeChange?.('dark')}
                  />
                  <ColorPicker
                    label="Accent Foreground"
                    lightValue={colors.accentForeground.light}
                    darkValue={colors.accentForeground.dark}
                    onLightChange={(value) => handleLightColorChange('accentForeground', value)}
                    onDarkChange={(value) => handleDarkColorChange('accentForeground', value)}
                    onLightFocus={() => onThemeModeChange?.('light')}
                    onDarkFocus={() => onThemeModeChange?.('dark')}
                  />
                </CollapsibleContent>
              </div>
            </Collapsible>

            {/* Base Colors Section */}
            <Collapsible defaultOpen>
              <div className="space-y-3">
                <CollapsibleTrigger className="flex w-full items-center justify-between">
                  <h3 className="text-sm font-semibold text-bolt-elements-textPrimary">Base Colors</h3>
                  <ChevronDown className="h-4 w-4 text-bolt-elements-textSecondary transition-transform duration-200 data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3">
                  <ColorPicker
                    label="Background"
                    lightValue={colors.background.light}
                    darkValue={colors.background.dark}
                    onLightChange={(value) => handleLightColorChange('background', value)}
                    onDarkChange={(value) => handleDarkColorChange('background', value)}
                    onLightFocus={() => onThemeModeChange?.('light')}
                    onDarkFocus={() => onThemeModeChange?.('dark')}
                  />
                  <ColorPicker
                    label="Foreground"
                    lightValue={colors.foreground.light}
                    darkValue={colors.foreground.dark}
                    onLightChange={(value) => handleLightColorChange('foreground', value)}
                    onDarkChange={(value) => handleDarkColorChange('foreground', value)}
                    onLightFocus={() => onThemeModeChange?.('light')}
                    onDarkFocus={() => onThemeModeChange?.('dark')}
                  />
                  <ColorPicker
                    label="Muted"
                    lightValue={colors.muted.light}
                    darkValue={colors.muted.dark}
                    onLightChange={(value) => handleLightColorChange('muted', value)}
                    onDarkChange={(value) => handleDarkColorChange('muted', value)}
                    onLightFocus={() => onThemeModeChange?.('light')}
                    onDarkFocus={() => onThemeModeChange?.('dark')}
                  />
                  <ColorPicker
                    label="Muted Foreground"
                    lightValue={colors.mutedForeground.light}
                    darkValue={colors.mutedForeground.dark}
                    onLightChange={(value) => handleLightColorChange('mutedForeground', value)}
                    onDarkChange={(value) => handleDarkColorChange('mutedForeground', value)}
                    onLightFocus={() => onThemeModeChange?.('light')}
                    onDarkFocus={() => onThemeModeChange?.('dark')}
                  />
                  <ColorPicker
                    label="Border"
                    lightValue={colors.border.light}
                    darkValue={colors.border.dark}
                    onLightChange={(value) => handleLightColorChange('border', value)}
                    onDarkChange={(value) => handleDarkColorChange('border', value)}
                    onLightFocus={() => onThemeModeChange?.('light')}
                    onDarkFocus={() => onThemeModeChange?.('dark')}
                  />
                </CollapsibleContent>
              </div>
            </Collapsible>

            {/* Card Colors Section */}
            <Collapsible defaultOpen>
              <div className="space-y-3">
                <CollapsibleTrigger className="flex w-full items-center justify-between">
                  <h3 className="text-sm font-semibold text-bolt-elements-textPrimary">Card Colors</h3>
                  <ChevronDown className="h-4 w-4 text-bolt-elements-textSecondary transition-transform duration-200 data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3">
                  <ColorPicker
                    label="Card"
                    lightValue={colors.card.light}
                    darkValue={colors.card.dark}
                    onLightChange={(value) => handleLightColorChange('card', value)}
                    onDarkChange={(value) => handleDarkColorChange('card', value)}
                    onLightFocus={() => onThemeModeChange?.('light')}
                    onDarkFocus={() => onThemeModeChange?.('dark')}
                  />
                  <ColorPicker
                    label="Card Foreground"
                    lightValue={colors.cardForeground.light}
                    darkValue={colors.cardForeground.dark}
                    onLightChange={(value) => handleLightColorChange('cardForeground', value)}
                    onDarkChange={(value) => handleDarkColorChange('cardForeground', value)}
                    onLightFocus={() => onThemeModeChange?.('light')}
                    onDarkFocus={() => onThemeModeChange?.('dark')}
                  />
                </CollapsibleContent>
              </div>
            </Collapsible>

            {/* Destructive Colors Section */}
            <Collapsible defaultOpen>
              <div className="space-y-3">
                <CollapsibleTrigger className="flex w-full items-center justify-between">
                  <h3 className="text-sm font-semibold text-bolt-elements-textPrimary">Destructive Colors</h3>
                  <ChevronDown className="h-4 w-4 text-bolt-elements-textSecondary transition-transform duration-200 data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3">
                  <ColorPicker
                    label="Destructive"
                    lightValue={colors.destructive.light}
                    darkValue={colors.destructive.dark}
                    onLightChange={(value) => handleLightColorChange('destructive', value)}
                    onDarkChange={(value) => handleDarkColorChange('destructive', value)}
                    onLightFocus={() => onThemeModeChange?.('light')}
                    onDarkFocus={() => onThemeModeChange?.('dark')}
                  />
                  <ColorPicker
                    label="Destructive Foreground"
                    lightValue={colors.destructiveForeground.light}
                    darkValue={colors.destructiveForeground.dark}
                    onLightChange={(value) => handleLightColorChange('destructiveForeground', value)}
                    onDarkChange={(value) => handleDarkColorChange('destructiveForeground', value)}
                    onLightFocus={() => onThemeModeChange?.('light')}
                    onDarkFocus={() => onThemeModeChange?.('dark')}
                  />
                </CollapsibleContent>
              </div>
            </Collapsible>

            {/* Status Colors Section */}
            <Collapsible defaultOpen>
              <div className="space-y-3">
                <CollapsibleTrigger className="flex w-full items-center justify-between">
                  <h3 className="text-sm font-semibold text-bolt-elements-textPrimary">Status Colors</h3>
                  <ChevronDown className="h-4 w-4 text-bolt-elements-textSecondary transition-transform duration-200 data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3">
                  <ColorPicker
                    label="Success"
                    lightValue={additionalColors.success.light}
                    darkValue={additionalColors.success.dark}
                    onLightChange={(value) => handleAdditionalLightColorChange('success', value)}
                    onDarkChange={(value) => handleAdditionalDarkColorChange('success', value)}
                    onLightFocus={() => onThemeModeChange?.('light')}
                    onDarkFocus={() => onThemeModeChange?.('dark')}
                  />
                  <ColorPicker
                    label="Success Foreground"
                    lightValue={additionalColors.successForeground.light}
                    darkValue={additionalColors.successForeground.dark}
                    onLightChange={(value) => handleAdditionalLightColorChange('successForeground', value)}
                    onDarkChange={(value) => handleAdditionalDarkColorChange('successForeground', value)}
                    onLightFocus={() => onThemeModeChange?.('light')}
                    onDarkFocus={() => onThemeModeChange?.('dark')}
                  />
                  <ColorPicker
                    label="Warning"
                    lightValue={additionalColors.warning.light}
                    darkValue={additionalColors.warning.dark}
                    onLightChange={(value) => handleAdditionalLightColorChange('warning', value)}
                    onDarkChange={(value) => handleAdditionalDarkColorChange('warning', value)}
                    onLightFocus={() => onThemeModeChange?.('light')}
                    onDarkFocus={() => onThemeModeChange?.('dark')}
                  />
                  <ColorPicker
                    label="Warning Foreground"
                    lightValue={additionalColors.warningForeground.light}
                    darkValue={additionalColors.warningForeground.dark}
                    onLightChange={(value) => handleAdditionalLightColorChange('warningForeground', value)}
                    onDarkChange={(value) => handleAdditionalDarkColorChange('warningForeground', value)}
                    onLightFocus={() => onThemeModeChange?.('light')}
                    onDarkFocus={() => onThemeModeChange?.('dark')}
                  />
                  <ColorPicker
                    label="Danger"
                    lightValue={additionalColors.danger.light}
                    darkValue={additionalColors.danger.dark}
                    onLightChange={(value) => handleAdditionalLightColorChange('danger', value)}
                    onDarkChange={(value) => handleAdditionalDarkColorChange('danger', value)}
                    onLightFocus={() => onThemeModeChange?.('light')}
                    onDarkFocus={() => onThemeModeChange?.('dark')}
                  />
                  <ColorPicker
                    label="Danger Foreground"
                    lightValue={additionalColors.dangerForeground.light}
                    darkValue={additionalColors.dangerForeground.dark}
                    onLightChange={(value) => handleAdditionalLightColorChange('dangerForeground', value)}
                    onDarkChange={(value) => handleAdditionalDarkColorChange('dangerForeground', value)}
                    onLightFocus={() => onThemeModeChange?.('light')}
                    onDarkFocus={() => onThemeModeChange?.('dark')}
                  />
                </CollapsibleContent>
              </div>
            </Collapsible>

            {/* Sidebar Colors Section */}
            <Collapsible defaultOpen>
              <div className="space-y-3">
                <CollapsibleTrigger className="flex w-full items-center justify-between">
                  <h3 className="text-sm font-semibold text-bolt-elements-textPrimary">Sidebar Colors</h3>
                  <ChevronDown className="h-4 w-4 text-bolt-elements-textSecondary transition-transform duration-200 data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3">
                  <ColorPicker
                    label="Sidebar"
                    lightValue={additionalColors.sidebar.light}
                    darkValue={additionalColors.sidebar.dark}
                    onLightChange={(value) => handleAdditionalLightColorChange('sidebar', value)}
                    onDarkChange={(value) => handleAdditionalDarkColorChange('sidebar', value)}
                    onLightFocus={() => onThemeModeChange?.('light')}
                    onDarkFocus={() => onThemeModeChange?.('dark')}
                  />
                  <ColorPicker
                    label="Sidebar Foreground"
                    lightValue={additionalColors.sidebarForeground.light}
                    darkValue={additionalColors.sidebarForeground.dark}
                    onLightChange={(value) => handleAdditionalLightColorChange('sidebarForeground', value)}
                    onDarkChange={(value) => handleAdditionalDarkColorChange('sidebarForeground', value)}
                    onLightFocus={() => onThemeModeChange?.('light')}
                    onDarkFocus={() => onThemeModeChange?.('dark')}
                  />
                  <ColorPicker
                    label="Sidebar Primary"
                    lightValue={additionalColors.sidebarPrimary.light}
                    darkValue={additionalColors.sidebarPrimary.dark}
                    onLightChange={(value) => handleAdditionalLightColorChange('sidebarPrimary', value)}
                    onDarkChange={(value) => handleAdditionalDarkColorChange('sidebarPrimary', value)}
                    onLightFocus={() => onThemeModeChange?.('light')}
                    onDarkFocus={() => onThemeModeChange?.('dark')}
                  />
                  <ColorPicker
                    label="Sidebar Primary Foreground"
                    lightValue={additionalColors.sidebarPrimaryForeground.light}
                    darkValue={additionalColors.sidebarPrimaryForeground.dark}
                    onLightChange={(value) => handleAdditionalLightColorChange('sidebarPrimaryForeground', value)}
                    onDarkChange={(value) => handleAdditionalDarkColorChange('sidebarPrimaryForeground', value)}
                    onLightFocus={() => onThemeModeChange?.('light')}
                    onDarkFocus={() => onThemeModeChange?.('dark')}
                  />
                  <ColorPicker
                    label="Sidebar Accent"
                    lightValue={additionalColors.sidebarAccent.light}
                    darkValue={additionalColors.sidebarAccent.dark}
                    onLightChange={(value) => handleAdditionalLightColorChange('sidebarAccent', value)}
                    onDarkChange={(value) => handleAdditionalDarkColorChange('sidebarAccent', value)}
                    onLightFocus={() => onThemeModeChange?.('light')}
                    onDarkFocus={() => onThemeModeChange?.('dark')}
                  />
                  <ColorPicker
                    label="Sidebar Accent Foreground"
                    lightValue={additionalColors.sidebarAccentForeground.light}
                    darkValue={additionalColors.sidebarAccentForeground.dark}
                    onLightChange={(value) => handleAdditionalLightColorChange('sidebarAccentForeground', value)}
                    onDarkChange={(value) => handleAdditionalDarkColorChange('sidebarAccentForeground', value)}
                    onLightFocus={() => onThemeModeChange?.('light')}
                    onDarkFocus={() => onThemeModeChange?.('dark')}
                  />
                  <ColorPicker
                    label="Sidebar Border"
                    lightValue={additionalColors.sidebarBorder.light}
                    darkValue={additionalColors.sidebarBorder.dark}
                    onLightChange={(value) => handleAdditionalLightColorChange('sidebarBorder', value)}
                    onDarkChange={(value) => handleAdditionalDarkColorChange('sidebarBorder', value)}
                    onLightFocus={() => onThemeModeChange?.('light')}
                    onDarkFocus={() => onThemeModeChange?.('dark')}
                  />
                  <ColorPicker
                    label="Sidebar Ring"
                    lightValue={additionalColors.sidebarRing.light}
                    darkValue={additionalColors.sidebarRing.dark}
                    onLightChange={(value) => handleAdditionalLightColorChange('sidebarRing', value)}
                    onDarkChange={(value) => handleAdditionalDarkColorChange('sidebarRing', value)}
                    onLightFocus={() => onThemeModeChange?.('light')}
                    onDarkFocus={() => onThemeModeChange?.('dark')}
                  />
                </CollapsibleContent>
              </div>
            </Collapsible>
          </div>
        )}

        {activeTab === 'typography' && (
          <div className="space-y-4">
            {/* Font Family Section */}
            <Collapsible defaultOpen>
              <div className="space-y-3">
                <CollapsibleTrigger className="flex w-full items-center justify-between">
                  <h3 className="text-sm font-semibold text-bolt-elements-textPrimary">Font Family</h3>
                  <ChevronDown className="h-4 w-4 text-bolt-elements-textSecondary transition-transform duration-200 data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3">
                  {/* Sans-serif Font */}
                  <div className="space-y-2">
                    <label className="text-xs text-bolt-elements-textSecondary">Sans-serif Font</label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="w-full flex items-center justify-between px-3 py-2 text-sm bg-bolt-elements-background-depth-3 hover:bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-md text-bolt-elements-textPrimary">
                          <span style={{ fontFamily: sansSerifFont }}>{sansSerifFont.split(',')[0]}</span>
                          <span className="text-xs text-bolt-elements-textSecondary">▼</span>
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-80 max-h-96 overflow-hidden p-0">
                        <div className="p-2 border-b border-bolt-elements-borderColor sticky top-0 bg-bolt-elements-background-depth-3">
                          <div className="relative">
                            <Search
                              className="absolute left-3 top-1/2 -translate-y-1/2 text-bolt-elements-textSecondary"
                              size={14}
                            />
                            <input
                              type="text"
                              value={sansSerifSearch}
                              onChange={(e) => setSansSerifSearch(e.target.value)}
                              placeholder="Search fonts..."
                              className="w-full pl-9 pr-3 py-2 text-sm bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-md focus:outline-none focus:border-bolt-elements-borderColorActive focus:ring-1 focus:ring-bolt-elements-borderColorActive text-bolt-elements-textPrimary"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        </div>
                        <div className="max-h-80 overflow-y-auto">
                          {filteredSansSerifFonts.length > 0 ? (
                            filteredSansSerifFonts.map((font) => (
                              <DropdownMenuItem
                                key={font}
                                onClick={() => {
                                  handleFontSelect('sans', font);
                                  setSansSerifSearch('');
                                }}
                                onMouseEnter={() => handleFontSelect('sans', font, true)}
                                onMouseLeave={handleHoverEnd}
                                className="px-3 py-2.5 cursor-pointer"
                              >
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-medium text-sm" style={{ fontFamily: font }}>
                                    {font.split(',')[0]}
                                  </span>
                                  <span className="text-xs text-bolt-elements-textSecondary">sans-serif</span>
                                </div>
                              </DropdownMenuItem>
                            ))
                          ) : (
                            <div className="px-3 py-8 text-center text-sm text-bolt-elements-textSecondary">
                              No fonts found
                            </div>
                          )}
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Serif Font */}
                  <div className="space-y-2">
                    <label className="text-xs text-bolt-elements-textSecondary">Serif Font</label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="w-full flex items-center justify-between px-3 py-2 text-sm bg-bolt-elements-background-depth-3 hover:bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-md text-bolt-elements-textPrimary">
                          <span style={{ fontFamily: serifFont }}>{serifFont.split(',')[0]}</span>
                          <span className="text-xs text-bolt-elements-textSecondary">▼</span>
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-80 max-h-96 overflow-hidden p-0">
                        <div className="p-2 border-b border-bolt-elements-borderColor sticky top-0 bg-bolt-elements-background-depth-3">
                          <div className="relative">
                            <Search
                              className="absolute left-3 top-1/2 -translate-y-1/2 text-bolt-elements-textSecondary"
                              size={14}
                            />
                            <input
                              type="text"
                              value={serifSearch}
                              onChange={(e) => setSerifSearch(e.target.value)}
                              placeholder="Search fonts..."
                              className="w-full pl-9 pr-3 py-2 text-sm bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-md focus:outline-none focus:border-bolt-elements-borderColorActive focus:ring-1 focus:ring-bolt-elements-borderColorActive text-bolt-elements-textPrimary"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        </div>
                        <div className="max-h-80 overflow-y-auto">
                          {filteredSerifFonts.length > 0 ? (
                            filteredSerifFonts.map((font) => (
                              <DropdownMenuItem
                                key={font}
                                onClick={() => {
                                  handleFontSelect('serif', font);
                                  setSerifSearch('');
                                }}
                                onMouseEnter={() => handleFontSelect('serif', font, true)}
                                onMouseLeave={handleHoverEnd}
                                className="px-3 py-2.5 cursor-pointer"
                              >
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-medium text-sm" style={{ fontFamily: font }}>
                                    {font.split(',')[0]}
                                  </span>
                                  <span className="text-xs text-bolt-elements-textSecondary">serif</span>
                                </div>
                              </DropdownMenuItem>
                            ))
                          ) : (
                            <div className="px-3 py-8 text-center text-sm text-bolt-elements-textSecondary">
                              No fonts found
                            </div>
                          )}
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Monospace Font */}
                  <div className="space-y-2">
                    <label className="text-xs text-bolt-elements-textSecondary">Monospace Font</label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="w-full flex items-center justify-between px-3 py-2 text-sm bg-bolt-elements-background-depth-3 hover:bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-md text-bolt-elements-textPrimary">
                          <span style={{ fontFamily: monoFont }}>{monoFont.split(',')[0]}</span>
                          <span className="text-xs text-bolt-elements-textSecondary">▼</span>
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-80 max-h-96 overflow-hidden p-0">
                        <div className="p-2 border-b border-bolt-elements-borderColor sticky top-0 bg-bolt-elements-background-depth-3">
                          <div className="relative">
                            <Search
                              className="absolute left-3 top-1/2 -translate-y-1/2 text-bolt-elements-textSecondary"
                              size={14}
                            />
                            <input
                              type="text"
                              value={monoSearch}
                              onChange={(e) => setMonoSearch(e.target.value)}
                              placeholder="Search fonts..."
                              className="w-full pl-9 pr-3 py-2 text-sm bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-md focus:outline-none focus:border-bolt-elements-borderColorActive focus:ring-1 focus:ring-bolt-elements-borderColorActive text-bolt-elements-textPrimary"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        </div>
                        <div className="max-h-80 overflow-y-auto">
                          {filteredMonoFonts.length > 0 ? (
                            filteredMonoFonts.map((font) => (
                              <DropdownMenuItem
                                key={font}
                                onClick={() => {
                                  handleFontSelect('mono', font);
                                  setMonoSearch('');
                                }}
                                onMouseEnter={() => handleFontSelect('mono', font, true)}
                                onMouseLeave={handleHoverEnd}
                                className="px-3 py-2.5 cursor-pointer"
                              >
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-medium text-sm" style={{ fontFamily: font }}>
                                    {font.split(',')[0]}
                                  </span>
                                  <span className="text-xs text-bolt-elements-textSecondary">monospace</span>
                                </div>
                              </DropdownMenuItem>
                            ))
                          ) : (
                            <div className="px-3 py-8 text-center text-sm text-bolt-elements-textSecondary">
                              No fonts found
                            </div>
                          )}
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          </div>
        )}

        {activeTab === 'other' && (
          <div className="space-y-4">
            {/* Border Radius */}
            <Collapsible defaultOpen>
              <div className="space-y-3">
                <CollapsibleTrigger className="flex w-full items-center justify-between">
                  <h3 className="text-sm font-semibold text-bolt-elements-textPrimary">Border Radius</h3>
                  <ChevronDown className="h-4 w-4 text-bolt-elements-textSecondary transition-transform duration-200 data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="grid grid-cols-3 gap-2">
                  {[
                    { value: 0, label: 'None' },
                    { value: 0.375, label: 'SM' },
                    { value: 0.5, label: 'MD' },
                    { value: 0.75, label: 'LG' },
                    { value: 1, label: 'XL' },
                    { value: 9999, label: 'Full' },
                  ].map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => {
                        setRadius(preset.value);
                        handleSliderChange('radius', preset.value);
                      }}
                      className={classNames(
                        'flex flex-col items-center justify-center p-3 rounded-lg border transition-all',
                        radius === preset.value
                          ? 'border-green-500 bg-bolt-elements-background-depth-2 ring-2 ring-green-500/20'
                          : 'border-bolt-elements-borderColor hover:border-bolt-elements-borderColorActive hover:bg-bolt-elements-background-depth-2',
                      )}
                    >
                      <div className="w-10 h-10 mb-2 flex items-center justify-center">
                        <div
                          className="w-8 h-8 border-2 border-bolt-elements-textPrimary"
                          style={{
                            borderRadius:
                              preset.value === 9999 ? '50%' : preset.value === 0 ? '0' : `${preset.value * 0.25}rem`,
                          }}
                        />
                      </div>
                      <span className="text-xs font-medium text-bolt-elements-textPrimary">{preset.label}</span>
                    </button>
                  ))}
                </CollapsibleContent>
              </div>
            </Collapsible>

            {/* Spacing Unit */}
            <Collapsible defaultOpen>
              <div className="space-y-3">
                <CollapsibleTrigger className="flex w-full items-center justify-between">
                  <h3 className="text-sm font-semibold text-bolt-elements-textPrimary">Spacing Unit</h3>
                  <ChevronDown className="h-4 w-4 text-bolt-elements-textSecondary transition-transform duration-200 data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="grid grid-cols-3 gap-2">
                  {[
                    { value: 4, label: 'Small' },
                    { value: 5, label: 'Medium' },
                    { value: 6, label: 'Large' },
                  ].map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => {
                        const originalValue = `${originalValuesRef.current?.spacingUnit || 4}px`;
                        const newValue = `${preset.value}px`;
                        markThemeChanged('--spacing-unit', originalValue, newValue, 'app-settings');
                        setSpacingUnit(preset.value);
                        sendCustomizationToIframe({ '--spacing-unit': newValue });
                      }}
                      className={classNames(
                        'flex flex-col items-center justify-center p-3 rounded-lg border transition-all',
                        spacingUnit === preset.value
                          ? 'border-green-500 bg-bolt-elements-background-depth-2 ring-2 ring-green-500/20'
                          : 'border-bolt-elements-borderColor hover:border-bolt-elements-borderColorActive hover:bg-bolt-elements-background-depth-2',
                      )}
                    >
                      <div className="w-10 h-10 mb-2 flex items-center justify-center gap-0.5">
                        {[0, 1, 2].map((i) => (
                          <div
                            key={i}
                            className="bg-bolt-elements-textPrimary rounded-sm"
                            style={{
                              width: `${Math.max(2, preset.value * 0.75)}px`,
                              height: `${preset.value * 3}px`,
                            }}
                          />
                        ))}
                      </div>
                      <span className="text-xs font-medium text-bolt-elements-textPrimary">{preset.label}</span>
                      <span className="text-xs text-bolt-elements-textSecondary">{preset.value}px</span>
                    </button>
                  ))}
                </CollapsibleContent>
              </div>
            </Collapsible>

            {/* Border Width */}
            <Collapsible defaultOpen>
              <div className="space-y-3">
                <CollapsibleTrigger className="flex w-full items-center justify-between">
                  <h3 className="text-sm font-semibold text-bolt-elements-textPrimary">Border Width</h3>
                  <ChevronDown className="h-4 w-4 text-bolt-elements-textSecondary transition-transform duration-200 data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="grid grid-cols-4 gap-2">
                  {[
                    { value: 1, label: 'Thin' },
                    { value: 2, label: 'Medium' },
                    { value: 3, label: 'Thick' },
                    { value: 4, label: 'Extra' },
                  ].map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => {
                        const originalValue = `${originalValuesRef.current?.borderWidth || 1}px`;
                        const newValue = `${preset.value}px`;
                        markThemeChanged('--border-width', originalValue, newValue, 'app-settings');
                        setBorderWidth(preset.value);
                        sendCustomizationToIframe({ '--border-width': newValue });
                      }}
                      className={classNames(
                        'flex flex-col items-center justify-center p-3 rounded-lg border transition-all',
                        borderWidth === preset.value
                          ? 'border-green-500 bg-bolt-elements-background-depth-2 ring-2 ring-green-500/20'
                          : 'border-bolt-elements-borderColor hover:border-bolt-elements-borderColorActive hover:bg-bolt-elements-background-depth-2',
                      )}
                      style={{ borderWidth: `${preset.value}px` }}
                    >
                      <div className="w-10 h-10 mb-2 flex items-center justify-center">
                        <div
                          className="w-8 h-8 rounded border-bolt-elements-textPrimary"
                          style={{ borderWidth: `${preset.value}px` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-bolt-elements-textPrimary">{preset.label}</span>
                    </button>
                  ))}
                </CollapsibleContent>
              </div>
            </Collapsible>
          </div>
        )}
      </div>
    </div>
  );
};
