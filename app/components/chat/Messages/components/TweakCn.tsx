import React, { useState, useEffect, useRef } from 'react';
import { MultiSelect } from '~/components/ui/multiselect';
import { ColorPicker } from '~/components/ui/ColorPicker';
import { Layout, Type, Settings } from '~/components/ui/Icon';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '~/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { RadiusSelector, SpacingSelector, BorderWidthSelector } from '~/components/ui/PresetSelector';
import { classNames } from '~/utils/classNames';
import { markThemeChanged, resetThemeChanges } from '~/lib/stores/designSystemStore';
import { getThemeCSSVariables } from '~/lib/replay/themeHelper';
import {
  sansSerifFonts,
  serifFonts,
  monoFonts,
  defaultColors,
  defaultAdditionalColors,
  colorKeyToCssVar,
} from '~/lib/theme/config';
import {
  sendThemeToIframe,
  sendVariablesToIframe,
  parseVariableValue,
  getIframe,
  diffAndMarkThemeChanges,
} from '~/lib/theme/iframeUtils';

type TabType = 'colors' | 'typography' | 'other';

interface ColorValue {
  light: string;
  dark?: string;
}

interface TweakCnProps {
  selectedTheme?: string;
  hoveredTheme?: string | null;
  originalVariables?: Record<string, string> | null;
  onThemeChange?: (theme: string) => void;
  onThemeModeChange?: (mode: 'light' | 'dark') => void;
  activeTabOverride?: TabType;
}

export const TweakCn: React.FC<TweakCnProps> = ({
  selectedTheme: externalSelectedTheme,
  hoveredTheme: externalHoveredTheme,
  originalVariables,
  onThemeChange: _onThemeChange,
  onThemeModeChange,
  activeTabOverride,
}) => {
  const [internalActiveTab, setInternalActiveTab] = useState<TabType>('colors');
  const activeTab = activeTabOverride !== undefined ? activeTabOverride : internalActiveTab;

  const selectedTheme = externalSelectedTheme || 'modern-minimal';
  const hoveredTheme = externalHoveredTheme !== undefined ? externalHoveredTheme : null;

  const [customTheme, setCustomTheme] = useState<Record<string, string>>({});
  const [_hoveredCustomization, setHoveredCustomization] = useState<Record<string, string> | null>(null);

  const originalValuesRef = useRef<{
    colors: Record<string, ColorValue>;
    fonts: { sans: string[]; serif: string[]; mono: string[] };
    radius: number;
    spacingUnit: number;
    borderWidth: number;
    additionalColors: Record<string, ColorValue>;
  } | null>(null);

  const [sansSerifFont, setSansSerifFont] = useState(['Inter']);
  const [serifFont, setSerifFont] = useState(['Source Serif 4']);
  const [monoFont, setMonoFont] = useState(['JetBrains Mono']);
  const [radius, setRadius] = useState(0.625);
  const [spacingUnit, setSpacingUnit] = useState(4);
  const [borderWidth, setBorderWidth] = useState(1);

  const [additionalColors, setAdditionalColors] = useState<Record<string, ColorValue>>(defaultAdditionalColors);
  const [colors, setColors] = useState<Record<string, ColorValue>>(defaultColors);

  // Load custom theme from iframe
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
          loadVariablesIntoState(currentVariables);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    iframe.contentWindow.postMessage({ id: requestId, request: 'get-custom-variables', source: '@@replay-nut' }, '*');
    setTimeout(() => window.removeEventListener('message', handleMessage), 5000);
  };

  // Load variables into state
  const loadVariablesIntoState = (currentVariables: Record<string, string>) => {
    const stripQuotes = (val: string) => val.trim().replace(/^["']|["']$/g, '');
    const lightColors: Record<string, string> = {};
    const darkColors: Record<string, string> = {};

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

    const newColors: Record<string, ColorValue> = {};
    Object.keys(defaultColors).forEach((key) => {
      const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      newColors[key] = {
        light: lightColors[cssKey] || (defaultColors as Record<string, ColorValue>)[key].light,
        dark: darkColors[cssKey],
      };
    });
    setColors(newColors);

    if (lightColors['font-sans']) {
      setSansSerifFont(lightColors['font-sans'].split(',').map((f) => f.trim()));
    }
    if (lightColors['font-serif']) {
      setSerifFont(lightColors['font-serif'].split(',').map((f) => f.trim()));
    }
    if (lightColors['font-mono']) {
      setMonoFont(lightColors['font-mono'].split(',').map((f) => f.trim()));
    }
    if (lightColors.radius) {
      setRadius(parseFloat(lightColors.radius) || 0.625);
    }

    const newAdditionalColors: Record<string, ColorValue> = {};
    Object.keys(defaultAdditionalColors).forEach((key) => {
      const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      newAdditionalColors[key] = {
        light: lightColors[cssKey] || (defaultAdditionalColors as Record<string, ColorValue>)[key].light,
        dark: darkColors[cssKey],
      };
    });
    setAdditionalColors(newAdditionalColors);

    originalValuesRef.current = {
      colors: { ...newColors },
      fonts: {
        sans: (lightColors['font-sans'] || 'Inter').split(',').map((f) => f.trim()),
        serif: (lightColors['font-serif'] || 'Source Serif 4').split(',').map((f) => f.trim()),
        mono: (lightColors['font-mono'] || 'JetBrains Mono').split(',').map((f) => f.trim()),
      },
      radius: lightColors.radius ? parseFloat(lightColors.radius) : 0.625,
      spacingUnit: 4,
      borderWidth: 1,
      additionalColors: { ...newAdditionalColors },
    };
  };

  // Load theme into state
  const loadThemeIntoState = (themeName: string) => {
    const cssVars = getThemeCSSVariables(themeName);
    if (!cssVars) {
      return;
    }

    const lightColors = cssVars.light || {};
    const darkColors = cssVars.dark || {};

    const newColors: Record<string, ColorValue> = {};
    Object.keys(defaultColors).forEach((key) => {
      const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      newColors[key] = {
        light: lightColors[cssKey] || (defaultColors as Record<string, ColorValue>)[key].light,
        dark: darkColors[cssKey],
      };
    });
    setColors(newColors);

    const newSansFont = (lightColors['font-sans'] || 'Inter').split(',').map((f) => f.trim());
    const newSerifFont = (lightColors['font-serif'] || 'Source Serif 4').split(',').map((f) => f.trim());
    const newMonoFont = (lightColors['font-mono'] || 'JetBrains Mono').split(',').map((f) => f.trim());
    const newRadius = lightColors.radius ? parseFloat(lightColors.radius) : 0.625;

    setSansSerifFont(newSansFont);
    setSerifFont(newSerifFont);
    setMonoFont(newMonoFont);
    if (!isNaN(newRadius)) {
      setRadius(newRadius);
    }

    const newAdditionalColors: Record<string, ColorValue> = {};
    Object.keys(defaultAdditionalColors).forEach((key) => {
      const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      newAdditionalColors[key] = {
        light: lightColors[cssKey] || (defaultAdditionalColors as Record<string, ColorValue>)[key].light,
        dark: darkColors[cssKey],
      };
    });
    setAdditionalColors(newAdditionalColors);

    originalValuesRef.current = {
      colors: { ...newColors },
      fonts: { sans: newSansFont, serif: newSerifFont, mono: newMonoFont },
      radius: newRadius,
      spacingUnit: 4,
      borderWidth: 1,
      additionalColors: { ...newAdditionalColors },
    };
  };

  // Apply theme when selected
  useEffect(() => {
    if (selectedTheme === 'custom') {
      loadCustomThemeFromIframe();
      return;
    }

    if (originalVariables && Object.keys(originalVariables).length > 0) {
      resetThemeChanges();
      diffAndMarkThemeChanges(originalVariables, selectedTheme);
      sendThemeToIframe(selectedTheme);
      loadThemeIntoState(selectedTheme);
    } else {
      resetThemeChanges();
      sendThemeToIframe(selectedTheme);
      loadThemeIntoState(selectedTheme);
    }
  }, [selectedTheme]);

  // Apply hovered theme preview
  useEffect(() => {
    if (hoveredTheme) {
      sendThemeToIframe(hoveredTheme);
    } else if (selectedTheme) {
      sendThemeToIframe(selectedTheme);
      if (Object.keys(customTheme).length > 0) {
        sendVariablesToIframe(customTheme);
      }
    }
  }, [hoveredTheme, selectedTheme, customTheme]);

  // Handle font selection
  const handleFontSelect = (fontType: 'sans' | 'serif' | 'mono', fonts: string[]) => {
    const varName = fontType === 'sans' ? '--font-sans' : fontType === 'serif' ? '--font-serif' : '--font-mono';
    const fontString = fonts.join(', ');
    const originalFonts = originalValuesRef.current?.fonts[fontType] || [];
    markThemeChanged(varName, originalFonts.join(', '), fontString, 'app-settings');

    if (fontType === 'sans') {
      setSansSerifFont(fonts);
    } else if (fontType === 'serif') {
      setSerifFont(fonts);
    } else {
      setMonoFont(fonts);
    }

    setCustomTheme({ ...customTheme, [varName]: fontString });
    sendVariablesToIframe({ [varName]: fontString });
  };

  // Handle font hover - preview the font
  const handleFontHover = (fontType: 'sans' | 'serif' | 'mono', fontName: string) => {
    const varName = fontType === 'sans' ? '--font-sans' : fontType === 'serif' ? '--font-serif' : '--font-mono';
    const currentFonts = fontType === 'sans' ? sansSerifFont : fontType === 'serif' ? serifFont : monoFont;
    // Preview the hovered font at the beginning of the current selection
    const previewFonts = [fontName, ...currentFonts.filter((f) => f !== fontName)];
    sendVariablesToIframe({ [varName]: previewFonts.join(', ') });
  };

  // Handle font hover end - reset to current selection
  const handleFontHoverEnd = (fontType: 'sans' | 'serif' | 'mono') => {
    const varName = fontType === 'sans' ? '--font-sans' : fontType === 'serif' ? '--font-serif' : '--font-mono';
    const currentFonts = fontType === 'sans' ? sansSerifFont : fontType === 'serif' ? serifFont : monoFont;
    sendVariablesToIframe({ [varName]: currentFonts.join(', ') });
  };

  // Handle slider changes
  const handleSliderChange = (key: string, value: number, isHover: boolean = false) => {
    const varName = `--${key}`;
    const varValue = `${value}rem`;

    if (isHover) {
      setHoveredCustomization({ [varName]: varValue });
      sendVariablesToIframe({ [varName]: varValue });
    } else {
      const originalValue =
        key === 'radius'
          ? `${originalValuesRef.current?.radius || 0.625}rem`
          : key === 'spacing-unit'
            ? `${originalValuesRef.current?.spacingUnit || 4}px`
            : `${originalValuesRef.current?.borderWidth || 1}px`;

      markThemeChanged(varName, originalValue, varValue, 'app-settings');
      if (key === 'radius') {
        setRadius(value);
      }

      setCustomTheme({ ...customTheme, [varName]: varValue });
      sendVariablesToIframe({ [varName]: varValue });
    }
  };

  // Reset hover customization
  const _handleHoverEnd = () => {
    setHoveredCustomization(null);
    sendThemeToIframe(selectedTheme);
    if (Object.keys(customTheme).length > 0) {
      sendVariablesToIframe(customTheme);
    }
  };

  // Handle color changes
  const handleColorChange = (colorKey: string, value: string, isDark: boolean, isAdditional: boolean = false) => {
    const cssVarName = colorKeyToCssVar(colorKey);
    const colorState = isAdditional ? additionalColors : colors;
    const setColorState = isAdditional ? setAdditionalColors : setColors;
    const currentColor = colorState[colorKey] || { light: '0 0% 0%' };
    const originalColor = isAdditional
      ? originalValuesRef.current?.additionalColors[colorKey]
      : originalValuesRef.current?.colors[colorKey];

    if (isDark) {
      const lightValue = currentColor.light;
      const originalDarkValue = originalColor?.dark || originalColor?.light || '';
      markThemeChanged(cssVarName, originalDarkValue, value, true);
      setColorState((prev) => ({ ...prev, [colorKey]: { ...prev[colorKey], dark: value } }));
      const cssVarValue = `${lightValue} .dark: ${value}`;
      sendVariablesToIframe({ [cssVarName]: cssVarValue });
      setCustomTheme((prev) => ({ ...prev, [cssVarName]: cssVarValue }));
    } else {
      const darkValue = currentColor.dark;
      const originalLightValue = originalColor?.light || '';
      markThemeChanged(cssVarName, originalLightValue, value, false);
      setColorState((prev) => ({ ...prev, [colorKey]: { ...prev[colorKey], light: value } }));
      const cssVarValue = darkValue ? `${value} .dark: ${darkValue}` : value;
      sendVariablesToIframe({ [cssVarName]: cssVarValue });
      setCustomTheme((prev) => ({ ...prev, [cssVarName]: cssVarValue }));
    }
  };

  const tabs = [
    { id: 'colors' as const, label: 'Colors', icon: Layout },
    { id: 'typography' as const, label: 'Typography', icon: Type },
    { id: 'other' as const, label: 'Other', icon: Settings },
  ];

  // Render color section
  const renderColorSection = (title: string, colorKeys: string[], isAdditional: boolean = false) => {
    const colorState = isAdditional ? additionalColors : colors;
    return (
      <Collapsible defaultOpen>
        <div className="space-y-3">
          <CollapsibleTrigger className="flex w-full items-center justify-between">
            <h3 className="text-sm font-semibold text-bolt-elements-textPrimary">{title}</h3>
            <ChevronDown className="h-4 w-4 text-bolt-elements-textSecondary transition-transform duration-200 data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3">
            {colorKeys.map((key) => {
              const color = colorState[key];
              if (!color) {
                return null;
              }
              const label = key
                .replace(/([A-Z])/g, ' $1')
                .replace(/^./, (str) => str.toUpperCase())
                .trim();
              return (
                <ColorPicker
                  key={key}
                  label={label}
                  lightValue={color.light}
                  darkValue={color.dark}
                  onLightChange={(value) => handleColorChange(key, value, false, isAdditional)}
                  onDarkChange={(value) => handleColorChange(key, value, true, isAdditional)}
                  onLightFocus={() => onThemeModeChange?.('light')}
                  onDarkFocus={() => onThemeModeChange?.('dark')}
                />
              );
            })}
          </CollapsibleContent>
        </div>
      </Collapsible>
    );
  };

  return (
    <div className="flex flex-col h-full" onClick={(e) => e.stopPropagation()}>
      {/* Tabs */}
      {activeTabOverride === undefined && (
        <div className="flex gap-1 p-1 bg-bolt-elements-background-depth-2 rounded-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setInternalActiveTab(tab.id)}
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
      )}

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {activeTab === 'colors' && (
          <div className="space-y-4">
            {renderColorSection('Primary Colors', ['primary', 'primaryForeground'])}
            {renderColorSection('Secondary Colors', ['secondary', 'secondaryForeground'])}
            {renderColorSection('Accent Colors', ['accent', 'accentForeground'])}
            {renderColorSection('Base Colors', ['background', 'foreground', 'muted', 'mutedForeground', 'border'])}
            {renderColorSection('Card Colors', ['card', 'cardForeground'])}
            {renderColorSection('Destructive Colors', ['destructive', 'destructiveForeground'])}
            {renderColorSection(
              'Status Colors',
              ['success', 'successForeground', 'warning', 'warningForeground', 'danger', 'dangerForeground'],
              true,
            )}
            {renderColorSection(
              'Sidebar Colors',
              [
                'sidebar',
                'sidebarForeground',
                'sidebarPrimary',
                'sidebarPrimaryForeground',
                'sidebarAccent',
                'sidebarAccentForeground',
                'sidebarBorder',
                'sidebarRing',
              ],
              true,
            )}
          </div>
        )}

        {activeTab === 'typography' && (
          <div className="space-y-4">
            <Collapsible defaultOpen>
              <div className="space-y-3">
                <CollapsibleTrigger className="flex w-full items-center justify-between">
                  <h3 className="text-sm font-semibold text-bolt-elements-textPrimary">Font Family</h3>
                  <ChevronDown className="h-4 w-4 text-bolt-elements-textSecondary transition-transform duration-200 data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3">
                  <div className="space-y-2">
                    <label className="text-xs text-bolt-elements-textSecondary">Sans-serif Font</label>
                    <MultiSelect
                      defaultValue={sansSerifFont}
                      onValueChange={(value) => handleFontSelect('sans', value)}
                      options={sansSerifFonts}
                      placeholder="Select sans-serif fonts..."
                      maxCount={5}
                      hideSelectAll
                      onOptionHover={(option) => handleFontHover('sans', option.value)}
                      onOptionHoverEnd={() => handleFontHoverEnd('sans')}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-bolt-elements-textSecondary">Serif Font</label>
                    <MultiSelect
                      defaultValue={serifFont}
                      onValueChange={(value) => handleFontSelect('serif', value)}
                      options={serifFonts}
                      placeholder="Select serif fonts..."
                      maxCount={5}
                      hideSelectAll
                      onOptionHover={(option) => handleFontHover('serif', option.value)}
                      onOptionHoverEnd={() => handleFontHoverEnd('serif')}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-bolt-elements-textSecondary">Monospace Font</label>
                    <MultiSelect
                      defaultValue={monoFont}
                      onValueChange={(value) => handleFontSelect('mono', value)}
                      options={monoFonts}
                      placeholder="Select mono fonts..."
                      maxCount={5}
                      hideSelectAll
                      onOptionHover={(option) => handleFontHover('mono', option.value)}
                      onOptionHoverEnd={() => handleFontHoverEnd('mono')}
                    />
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          </div>
        )}

        {activeTab === 'other' && (
          <div className="space-y-4">
            <RadiusSelector
              currentValue={radius}
              onChange={(value) => {
                setRadius(value);
                handleSliderChange('radius', value);
              }}
            />
            <SpacingSelector
              currentValue={spacingUnit}
              onChange={(value) => {
                const originalValue = `${originalValuesRef.current?.spacingUnit || 4}px`;
                const newValue = `${value}px`;
                markThemeChanged('--spacing-unit', originalValue, newValue, 'app-settings');
                setSpacingUnit(value);
                sendVariablesToIframe({ '--spacing-unit': newValue });
              }}
            />
            <BorderWidthSelector
              currentValue={borderWidth}
              onChange={(value) => {
                const originalValue = `${originalValuesRef.current?.borderWidth || 1}px`;
                const newValue = `${value}px`;
                markThemeChanged('--border-width', originalValue, newValue, 'app-settings');
                setBorderWidth(value);
                sendVariablesToIframe({ '--border-width': newValue });
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
