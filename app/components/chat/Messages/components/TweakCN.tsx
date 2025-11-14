import React, { useState, useEffect } from 'react';

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

type TabType = 'colors' | 'typography' | 'other';

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onHover?: (value: string) => void;
  onHoverEnd?: () => void;
}

const ColorPicker: React.FC<ColorPickerProps> = ({ label, value, onChange, onHover, onHoverEnd }) => {
  const [hslValue, setHslValue] = useState(value);

  useEffect(() => {
    setHslValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setHslValue(newValue);
    onChange(newValue);
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

  const handleColorPickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const hex = e.target.value;
    const newHsl = hexToHsl(hex);
    setHslValue(newHsl);
    onChange(newHsl);
  };

  return (
    <div className="space-y-2">
      <label className="text-xs text-bolt-elements-textSecondary">{label}</label>
      <div className="flex items-center gap-2">
        <div className="relative w-12 h-10 flex-shrink-0">
          <div
            className="w-full h-full rounded border border-bolt-elements-borderColor cursor-pointer"
            style={{ backgroundColor: `hsl(${hslValue})` }}
          />
          <input
            type="color"
            value={hslToHex(hslValue)}
            onChange={handleColorPickerChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            title="Click to pick a color"
          />
        </div>
        <input
          type="text"
          value={hslValue}
          onChange={handleChange}
          onMouseEnter={() => onHover?.(hslValue)}
          onMouseLeave={onHoverEnd}
          onFocus={() => onHover?.(hslValue)}
          onBlur={onHoverEnd}
          className="flex-1 px-3 py-2 text-sm bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor rounded-md focus:outline-none focus:border-bolt-elements-borderColorActive focus:ring-1 focus:ring-bolt-elements-borderColorActive text-bolt-elements-textPrimary"
          placeholder="0 0% 0%"
        />
      </div>
    </div>
  );
};

interface TweakCNProps {
  selectedTheme?: string;
  hoveredTheme?: string | null;
  onThemeChange?: (theme: string) => void;
}

export const TweakCN: React.FC<TweakCNProps> = ({
  selectedTheme: externalSelectedTheme,
  hoveredTheme: externalHoveredTheme,
  onThemeChange: _onThemeChange,
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

  // Additional colors
  const [additionalColors, setAdditionalColors] = useState({
    success: '142 71% 45%',
    successForeground: '0 0% 100%',
    warning: '38 92% 50%',
    warningForeground: '0 0% 0%',
    danger: '0 84% 60%',
    dangerForeground: '0 0% 100%',
    sidebar: '240 5% 6%',
    sidebarForeground: '240 5% 90%',
    sidebarPrimary: '240 6% 10%',
    sidebarPrimaryForeground: '0 0% 98%',
    sidebarAccent: '240 4% 16%',
    sidebarAccentForeground: '240 6% 90%',
    sidebarBorder: '240 4% 16%',
    sidebarRing: '217 91% 60%',
  });

  // Color values from the current theme
  const [colors, setColors] = useState({
    primary: '38 92% 50%',
    primaryForeground: '0 0% 0%',
    secondary: '220 14% 96%',
    secondaryForeground: '215 14% 34%',
    accent: '48 100% 96%',
    accentForeground: '23 83% 31%',
    background: '0 0% 100%',
    foreground: '0 0% 15%',
    card: '0 0% 100%',
    cardForeground: '0 0% 15%',
    muted: '210 20% 98%',
    mutedForeground: '220 9% 46%',
    border: '220 13% 91%',
    destructive: '0 84% 60%',
    destructiveForeground: '0 0% 100%',
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

  // Apply theme when selected and load its values into the panel
  useEffect(() => {
    console.log('[TweakCN] Selected theme changed to:', selectedTheme);
    sendThemeToIframe(selectedTheme);

    // Load the theme's CSS variables into our state
    const cssVars = getThemeCSSVariables(selectedTheme);
    if (cssVars) {
      // Extract light mode colors (we'll use light mode for editing)
      const lightColors = cssVars.light || {};
      const themeVars = cssVars.theme || {};

      setColors({
        primary: lightColors.primary || '38 92% 50%',
        primaryForeground: lightColors['primary-foreground'] || '0 0% 0%',
        secondary: lightColors.secondary || '220 14% 96%',
        secondaryForeground: lightColors['secondary-foreground'] || '215 14% 34%',
        accent: lightColors.accent || '48 100% 96%',
        accentForeground: lightColors['accent-foreground'] || '23 83% 31%',
        background: lightColors.background || '0 0% 100%',
        foreground: lightColors.foreground || '0 0% 15%',
        card: lightColors.card || '0 0% 100%',
        cardForeground: lightColors['card-foreground'] || '0 0% 15%',
        muted: lightColors.muted || '210 20% 98%',
        mutedForeground: lightColors['muted-foreground'] || '220 9% 46%',
        border: lightColors.border || '220 13% 91%',
        destructive: lightColors.destructive || '0 84% 60%',
        destructiveForeground: lightColors['destructive-foreground'] || '0 0% 100%',
      });

      // Load font settings
      if (themeVars['font-sans']) {
        setSansSerifFont(themeVars['font-sans']);
      }
      if (themeVars['font-serif']) {
        setSerifFont(themeVars['font-serif']);
      }
      if (themeVars['font-mono']) {
        setMonoFont(themeVars['font-mono']);
      }
      if (themeVars.radius) {
        const radiusValue = parseFloat(themeVars.radius);
        if (!isNaN(radiusValue)) {
          setRadius(radiusValue);
        }
      }
    }
  }, [selectedTheme]);

  // Apply hovered theme preview
  useEffect(() => {
    if (hoveredTheme) {
      sendThemeToIframe(hoveredTheme);
    }
  }, [hoveredTheme]);

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

  // Handle color changes
  const handleColorChange = (colorKey: string, value: string) => {
    console.log('[TweakCN] Color changed:', colorKey, '=', value);

    // Update local state
    setColors((prev) => ({
      ...prev,
      [colorKey]: value,
    }));

    // Convert camelCase to kebab-case for CSS variable names
    const cssVarName = colorKey.replace(/([A-Z])/g, '-$1').toLowerCase();

    console.log('[TweakCN] Sending to iframe:', `--${cssVarName}`, '=', value);

    // Send to iframe immediately
    sendCustomizationToIframe({ [`--${cssVarName}`]: value });

    // Update custom theme state
    setCustomTheme((prev) => ({
      ...prev,
      [`--${cssVarName}`]: value,
    }));
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
                    value={colors.primary}
                    onChange={(value) => handleColorChange('primary', value)}
                  />
                  <ColorPicker
                    label="Primary Foreground"
                    value={colors.primaryForeground}
                    onChange={(value) => handleColorChange('primaryForeground', value)}
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
                    value={colors.secondary}
                    onChange={(value) => handleColorChange('secondary', value)}
                  />
                  <ColorPicker
                    label="Secondary Foreground"
                    value={colors.secondaryForeground}
                    onChange={(value) => handleColorChange('secondaryForeground', value)}
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
                    value={colors.accent}
                    onChange={(value) => handleColorChange('accent', value)}
                  />
                  <ColorPicker
                    label="Accent Foreground"
                    value={colors.accentForeground}
                    onChange={(value) => handleColorChange('accentForeground', value)}
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
                    value={colors.background}
                    onChange={(value) => handleColorChange('background', value)}
                  />
                  <ColorPicker
                    label="Foreground"
                    value={colors.foreground}
                    onChange={(value) => handleColorChange('foreground', value)}
                  />
                  <ColorPicker
                    label="Muted"
                    value={colors.muted}
                    onChange={(value) => handleColorChange('muted', value)}
                  />
                  <ColorPicker
                    label="Muted Foreground"
                    value={colors.mutedForeground}
                    onChange={(value) => handleColorChange('mutedForeground', value)}
                  />
                  <ColorPicker
                    label="Border"
                    value={colors.border}
                    onChange={(value) => handleColorChange('border', value)}
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
                    value={colors.card}
                    onChange={(value) => handleColorChange('card', value)}
                  />
                  <ColorPicker
                    label="Card Foreground"
                    value={colors.cardForeground}
                    onChange={(value) => handleColorChange('cardForeground', value)}
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
                    value={colors.destructive}
                    onChange={(value) => handleColorChange('destructive', value)}
                  />
                  <ColorPicker
                    label="Destructive Foreground"
                    value={colors.destructiveForeground}
                    onChange={(value) => handleColorChange('destructiveForeground', value)}
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
                    value={additionalColors.success}
                    onChange={(value) => {
                      setAdditionalColors({ ...additionalColors, success: value });
                      sendCustomizationToIframe({ '--success': value });
                    }}
                  />
                  <ColorPicker
                    label="Success Foreground"
                    value={additionalColors.successForeground}
                    onChange={(value) => {
                      setAdditionalColors({ ...additionalColors, successForeground: value });
                      sendCustomizationToIframe({ '--success-foreground': value });
                    }}
                  />
                  <ColorPicker
                    label="Warning"
                    value={additionalColors.warning}
                    onChange={(value) => {
                      setAdditionalColors({ ...additionalColors, warning: value });
                      sendCustomizationToIframe({ '--warning': value });
                    }}
                  />
                  <ColorPicker
                    label="Warning Foreground"
                    value={additionalColors.warningForeground}
                    onChange={(value) => {
                      setAdditionalColors({ ...additionalColors, warningForeground: value });
                      sendCustomizationToIframe({ '--warning-foreground': value });
                    }}
                  />
                  <ColorPicker
                    label="Danger"
                    value={additionalColors.danger}
                    onChange={(value) => {
                      setAdditionalColors({ ...additionalColors, danger: value });
                      sendCustomizationToIframe({ '--danger': value });
                    }}
                  />
                  <ColorPicker
                    label="Danger Foreground"
                    value={additionalColors.dangerForeground}
                    onChange={(value) => {
                      setAdditionalColors({ ...additionalColors, dangerForeground: value });
                      sendCustomizationToIframe({ '--danger-foreground': value });
                    }}
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
                    value={additionalColors.sidebar}
                    onChange={(value) => {
                      setAdditionalColors({ ...additionalColors, sidebar: value });
                      sendCustomizationToIframe({ '--sidebar': value });
                    }}
                  />
                  <ColorPicker
                    label="Sidebar Foreground"
                    value={additionalColors.sidebarForeground}
                    onChange={(value) => {
                      setAdditionalColors({ ...additionalColors, sidebarForeground: value });
                      sendCustomizationToIframe({ '--sidebar-foreground': value });
                    }}
                  />
                  <ColorPicker
                    label="Sidebar Primary"
                    value={additionalColors.sidebarPrimary}
                    onChange={(value) => {
                      setAdditionalColors({ ...additionalColors, sidebarPrimary: value });
                      sendCustomizationToIframe({ '--sidebar-primary': value });
                    }}
                  />
                  <ColorPicker
                    label="Sidebar Primary Foreground"
                    value={additionalColors.sidebarPrimaryForeground}
                    onChange={(value) => {
                      setAdditionalColors({ ...additionalColors, sidebarPrimaryForeground: value });
                      sendCustomizationToIframe({ '--sidebar-primary-foreground': value });
                    }}
                  />
                  <ColorPicker
                    label="Sidebar Accent"
                    value={additionalColors.sidebarAccent}
                    onChange={(value) => {
                      setAdditionalColors({ ...additionalColors, sidebarAccent: value });
                      sendCustomizationToIframe({ '--sidebar-accent': value });
                    }}
                  />
                  <ColorPicker
                    label="Sidebar Accent Foreground"
                    value={additionalColors.sidebarAccentForeground}
                    onChange={(value) => {
                      setAdditionalColors({ ...additionalColors, sidebarAccentForeground: value });
                      sendCustomizationToIframe({ '--sidebar-accent-foreground': value });
                    }}
                  />
                  <ColorPicker
                    label="Sidebar Border"
                    value={additionalColors.sidebarBorder}
                    onChange={(value) => {
                      setAdditionalColors({ ...additionalColors, sidebarBorder: value });
                      sendCustomizationToIframe({ '--sidebar-border': value });
                    }}
                  />
                  <ColorPicker
                    label="Sidebar Ring"
                    value={additionalColors.sidebarRing}
                    onChange={(value) => {
                      setAdditionalColors({ ...additionalColors, sidebarRing: value });
                      sendCustomizationToIframe({ '--sidebar-ring': value });
                    }}
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
                        setSpacingUnit(preset.value);
                        sendCustomizationToIframe({ '--spacing-unit': `${preset.value}px` });
                      }}
                      className={classNames(
                        'flex flex-col items-center justify-center p-3 rounded-lg border transition-all',
                        spacingUnit === preset.value
                          ? 'border-green-500 bg-bolt-elements-background-depth-2 ring-2 ring-green-500/20'
                          : 'border-bolt-elements-borderColor hover:border-bolt-elements-borderColorActive hover:bg-bolt-elements-background-depth-2',
                      )}
                    >
                      <div className="w-10 h-10 mb-2 flex items-center justify-center gap-1">
                        {[0, 1, 2].map((i) => (
                          <div
                            key={i}
                            className="bg-bolt-elements-textPrimary rounded-sm"
                            style={{
                              width: `${preset.value * 0.5}px`,
                              height: `${preset.value * 2}px`,
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
                        setBorderWidth(preset.value);
                        sendCustomizationToIframe({ '--border-width': `${preset.value}px` });
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
