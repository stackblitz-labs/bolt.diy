import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '@nanostores/react';
import { designPanelStore, markThemeChanged, markThemesSaved, resetThemeChanges } from '~/lib/stores/designSystemStore';
import { getAvailableThemes, findMatchingTheme, getThemeCSSVariables } from '~/lib/replay/themeHelper';
import { Skeleton } from '~/components/ui/Skeleton';
import { Sun, Moon, ChevronRight, Palette, Type, Settings, ArrowLeft } from 'lucide-react';
import { ThemePicker } from '~/components/ui/theme-picker';
import type { ThemeOption } from '~/components/ui/theme-picker';
import { classNames } from '~/utils/classNames';
import { TweakCn } from '~/components/chat/Messages/components';
import { chatStore } from '~/lib/stores/chat';
import { callNutAPI } from '~/lib/replay/NutAPI';
import { toast } from 'react-toastify';
import { MultiSelect } from '~/components/ui/multiselect';
import { RadiusSelector, SpacingSelector, BorderWidthSelector } from '~/components/ui/PresetSelector';
import { sansSerifFonts, CUSTOM_THEME_NAME } from '~/lib/theme/config';
import {
  getIframe,
  sendVariablesToAllIframes,
  sendThemeToAllIframes,
  sendThemeModeToAllIframes,
  extractColorsFromVariables,
  getThemeColors,
  diffAndMarkThemeChanges,
} from '~/lib/theme/iframeUtils';

type ViewType = 'overview' | 'colors' | 'typography';

export const DesignSystemPanel = () => {
  const isVisible = useStore(designPanelStore.isVisible);
  const themeChanges = useStore(designPanelStore.themeChanges);
  const appId = useStore(chatStore.currentAppId);

  const [currentView, setCurrentView] = useState<ViewType>('overview');
  const [hoveredSection, setHoveredSection] = useState<string | null>(null);
  const [currentFont, setCurrentFont] = useState<string[]>(['Inter']);
  const [radius, setRadius] = useState(0.5);
  const [spacingUnit, setSpacingUnit] = useState(4);
  const [borderWidth, setBorderWidth] = useState(1);
  const [currentColors, setCurrentColors] = useState<string[]>([]);
  const [customTheme, setCustomTheme] = useState<Record<string, string>>({});
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [hoveredTheme, setHoveredTheme] = useState<string | null>(null);
  const [isCustomTheme, setIsCustomTheme] = useState(false);
  const isHoveringRef = useRef(false);
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('light');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [themeKey] = useState(0);

  const originalThemeRef = useRef<string | null>(null);
  const originalVariablesRef = useRef<Record<string, string> | null>(null);
  const originalFontRef = useRef<string[] | null>(null);
  const originalRadiusRef = useRef<number | null>(null);
  const originalSpacingUnitRef = useRef<number | null>(null);
  const originalBorderWidthRef = useRef<number | null>(null);
  const originalThemeNameRef = useRef<string | null>(null);
  const hasLoadedThemeRef = useRef(false);

  const availableThemes = getAvailableThemes();

  // Load theme from iframe
  const loadThemeFromIframe = useCallback(() => {
    setIsLoading(true);
    const iframe = getIframe();
    if (!iframe?.contentWindow) {
      setIsLoading(false);
      if (availableThemes.length > 0) {
        setSelectedTheme(availableThemes[0].name);
        setIsCustomTheme(false);
      }
      return;
    }

    const requestId = Date.now().toString();
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.id === requestId && event.data?.response && event.data?.source === '@@replay-nut') {
        window.removeEventListener('message', handleMessage);
        setIsLoading(false);

        const currentVariables = event.data.response as Record<string, string>;
        if (currentVariables && Object.keys(currentVariables).length > 0) {
          originalVariablesRef.current = { ...currentVariables };

          // Extract font
          const fontSansRaw = currentVariables['--font-sans'] || 'Inter';
          const fontSans = fontSansRaw.replace(/^["']|["']/g, '').split('.dark:')[0];
          const fontSansArray = fontSans.split(',').map((f) => f.trim());
          setCurrentFont(fontSansArray);
          originalFontRef.current = fontSansArray;

          // Extract radius
          const radiusValue = currentVariables['--radius'];
          if (radiusValue) {
            const radiusNum = parseFloat(radiusValue.replace('rem', '')) || 0.5;
            setRadius(radiusNum);
            originalRadiusRef.current = radiusNum;
          }

          // Extract spacing unit
          const spacingValue = currentVariables['--spacing-unit'];
          if (spacingValue) {
            const spacingNum = parseFloat(spacingValue.replace('px', '')) || 4;
            setSpacingUnit(spacingNum);
            originalSpacingUnitRef.current = spacingNum;
          } else {
            originalSpacingUnitRef.current = 4;
          }

          // Extract border width
          const borderWidthValue = currentVariables['--border-width'];
          if (borderWidthValue) {
            const borderWidthNum = parseFloat(borderWidthValue.replace('px', '')) || 1;
            setBorderWidth(borderWidthNum);
            originalBorderWidthRef.current = borderWidthNum;
          } else {
            originalBorderWidthRef.current = 1;
          }

          // Extract and display current colors
          const colors = extractColorsFromVariables(currentVariables);
          setCurrentColors(colors);

          // Try to find matching theme
          const matchingTheme = findMatchingTheme(currentVariables);
          if (matchingTheme) {
            setSelectedTheme(matchingTheme);
            setIsCustomTheme(false);
            originalThemeNameRef.current = matchingTheme;
            const themeColors = getThemeColors(matchingTheme);
            if (themeColors.length > 0) {
              setCurrentColors(themeColors);
            }
          } else {
            setSelectedTheme(CUSTOM_THEME_NAME);
            setIsCustomTheme(true);
            originalThemeNameRef.current = CUSTOM_THEME_NAME;
            setCustomTheme(currentVariables);
          }
        } else {
          if (availableThemes.length > 0) {
            setSelectedTheme(availableThemes[0].name);
            setIsCustomTheme(false);
            originalThemeNameRef.current = availableThemes[0].name;
          }
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
      setIsLoading(false);
    }, 5000);
  }, [availableThemes]);

  // Re-inject unsaved changes into all iframes
  const reinjectUnsavedChanges = useCallback(() => {
    // Don't re-inject if currently hovering over a theme (to prevent jitter)
    if (isHoveringRef.current) {
      return;
    }
    if (!themeChanges.hasChanges) {
      return;
    }

    const variablesToInject: Record<string, string> = {};

    // Collect all light theme changes
    Object.entries(themeChanges.lightThemeChanges).forEach(([key, change]) => {
      const trimmedValue = change.newValue?.trim() || '';
      if (trimmedValue !== '') {
        variablesToInject[key] = trimmedValue;
      }
    });

    // Collect dark theme changes (combine with light if exists)
    Object.entries(themeChanges.darkThemeChanges).forEach(([key, change]) => {
      const trimmedDarkValue = change.newValue?.trim() || '';
      if (trimmedDarkValue !== '') {
        const lightChange = themeChanges.lightThemeChanges[key];
        const trimmedLightValue = lightChange?.newValue?.trim() || '';
        if (trimmedLightValue !== '') {
          variablesToInject[key] = `${trimmedLightValue} .dark: ${trimmedDarkValue}`;
        } else {
          variablesToInject[`${key}-dark`] = trimmedDarkValue;
        }
      }
    });

    // Collect app settings changes
    Object.entries(themeChanges.appSettingsChanges).forEach(([key, change]) => {
      const trimmedValue = change.newValue?.trim() || '';
      if (trimmedValue !== '') {
        variablesToInject[key] = trimmedValue;
      }
    });

    // Send to all iframes
    if (Object.keys(variablesToInject).length > 0) {
      sendVariablesToAllIframes(variablesToInject);
      console.log('[DesignSystemPanel] Re-injected', Object.keys(variablesToInject).length, 'unsaved changes');
    }
  }, [themeChanges]);

  // Load theme when panel becomes visible
  useEffect(() => {
    if (isVisible) {
      if (!hasLoadedThemeRef.current || selectedTheme === null) {
        hasLoadedThemeRef.current = true;
        loadThemeFromIframe();
      } else {
        // Re-inject unsaved changes if panel is already loaded (but not during hover)
        if (!isHoveringRef.current) {
          reinjectUnsavedChanges();
        }
      }
    } else {
      hasLoadedThemeRef.current = false;
      setSelectedTheme(null);
      setIsCustomTheme(false);
      setIsLoading(false);
      setCurrentView('overview');
      isHoveringRef.current = false; // Reset hover state when panel closes
    }
  }, [isVisible, loadThemeFromIframe, selectedTheme, reinjectUnsavedChanges]);

  // Re-inject unsaved changes on mount if they exist
  useEffect(() => {
    if (themeChanges.hasChanges && !isHoveringRef.current) {
      // Small delay to ensure iframes are ready
      const timeoutId = setTimeout(() => {
        if (!isHoveringRef.current) {
          reinjectUnsavedChanges();
        }
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, []); // Only run on mount

  // Listen for theme mode changes
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'THEME_CHANGED' && event.data?.source === 'app-theme-provider') {
        const newTheme = event.data.theme;
        if (newTheme === 'light' || newTheme === 'dark') {
          setThemeMode(newTheme);
        }
      }
      if (event.data?.type === 'APP_READY' && event.data?.source === 'app-theme-provider') {
        const initialTheme = event.data.theme;
        if (initialTheme === 'light' || initialTheme === 'dark') {
          setThemeMode(initialTheme);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Handle theme mode toggle
  const handleThemeModeToggle = () => {
    const newMode = themeMode === 'light' ? 'dark' : 'light';
    setThemeMode(newMode);
    sendThemeModeToAllIframes(newMode);
  };

  // Handle theme change
  const handleThemeChange = (themeName: string) => {
    if (themeName === CUSTOM_THEME_NAME) {
      return;
    }

    resetThemeChanges();

    if (originalVariablesRef.current && Object.keys(originalVariablesRef.current).length > 0) {
      diffAndMarkThemeChanges(originalVariablesRef.current, themeName);
    }

    setSelectedTheme(themeName);
    setIsCustomTheme(false);
    setHoveredTheme(null);
    originalThemeRef.current = null;
    sendThemeToAllIframes(themeName);

    // Update colors preview
    const themeColors = getThemeColors(themeName);
    if (themeColors.length > 0) {
      setCurrentColors(themeColors);
    }

    // Extract and apply all theme settings
    const cssVars = getThemeCSSVariables(themeName);
    if (cssVars?.light) {
      // Update font
      const fontSans = cssVars.light['font-sans'];
      if (fontSans) {
        const fontArray = fontSans.split(',').map((f) => f.trim());
        setCurrentFont(fontArray);
        setCustomTheme((prev) => ({ ...prev, '--font-sans': fontSans }));
      }

      // Update radius
      const radiusValue = cssVars.light.radius;
      if (radiusValue) {
        const radiusNum = parseFloat(radiusValue.replace('rem', '')) || 0.5;
        setRadius(radiusNum);
        setCustomTheme((prev) => ({ ...prev, '--radius': radiusValue }));
      }

      // Update spacing unit (default to 4 if not specified)
      const spacingValue = cssVars.light['spacing-unit'];
      if (spacingValue) {
        const spacingNum = parseFloat(spacingValue.replace('px', '')) || 4;
        setSpacingUnit(spacingNum);
        setCustomTheme((prev) => ({ ...prev, '--spacing-unit': spacingValue }));
      } else {
        setSpacingUnit(4);
      }

      // Update border width (default to 1 if not specified)
      const borderWidthValue = cssVars.light['border-width'];
      if (borderWidthValue) {
        const borderWidthNum = parseFloat(borderWidthValue.replace('px', '')) || 1;
        setBorderWidth(borderWidthNum);
        setCustomTheme((prev) => ({ ...prev, '--border-width': borderWidthValue }));
      } else {
        setBorderWidth(1);
      }
    }
  };

  // Handle theme hover
  const handleThemeHover = (themeName: string) => {
    isHoveringRef.current = true;
    setHoveredTheme(themeName);
    sendThemeToAllIframes(themeName);
  };

  // Handle theme picker hover end - reset to selected theme
  const handleThemePickerHoverEnd = () => {
    isHoveringRef.current = false;
    setHoveredTheme(null);
    if (selectedTheme && !isCustomTheme) {
      sendThemeToAllIframes(selectedTheme);
    } else if (customTheme && Object.keys(customTheme).length > 0) {
      sendVariablesToAllIframes(customTheme);
    } else if (themeChanges.hasChanges) {
      // Re-inject unsaved changes after hover ends
      setTimeout(() => {
        reinjectUnsavedChanges();
      }, 100);
    }
  };

  // Handle font change
  const handleFontChange = (fonts: string[]) => {
    const originalValue = (originalFontRef.current || ['Inter']).join(', ');
    markThemeChanged('--font-sans', originalValue, fonts.join(', '), 'app-settings');
    setCurrentFont(fonts);
    setCustomTheme((prev) => ({ ...prev, '--font-sans': fonts.join(', ') }));
    sendVariablesToAllIframes({ '--font-sans': fonts.join(', ') });
  };

  // Handle font hover - preview the font
  const handleFontHover = (fontName: string) => {
    isHoveringRef.current = true;
    const previewFonts = [fontName, ...currentFont.filter((f) => f !== fontName)];
    sendVariablesToAllIframes({ '--font-sans': previewFonts.join(', ') });
  };

  // Handle font hover end - reset to current selection
  const handleFontHoverEnd = () => {
    isHoveringRef.current = false;
    sendVariablesToAllIframes({ '--font-sans': currentFont.join(', ') });
    // Re-inject unsaved changes after hover ends if needed
    if (themeChanges.hasChanges) {
      setTimeout(() => {
        reinjectUnsavedChanges();
      }, 100);
    }
  };

  // Handle radius change
  const handleRadiusChange = (value: number) => {
    const originalValue = originalRadiusRef.current || 0.5;
    markThemeChanged('--radius', `${originalValue}rem`, `${value}rem`, 'app-settings');
    setRadius(value);
    setCustomTheme((prev) => ({ ...prev, '--radius': `${value}rem` }));
    sendVariablesToAllIframes({ '--radius': `${value}rem` });
  };

  // Handle spacing unit change
  const handleSpacingUnitChange = (value: number) => {
    const originalValue = originalSpacingUnitRef.current || 4;
    markThemeChanged('--spacing-unit', `${originalValue}px`, `${value}px`, 'app-settings');
    setSpacingUnit(value);
    setCustomTheme((prev) => ({ ...prev, '--spacing-unit': `${value}px` }));
    sendVariablesToAllIframes({ '--spacing-unit': `${value}px` });
  };

  // Handle border width change
  const handleBorderWidthChange = (value: number) => {
    const originalValue = originalBorderWidthRef.current || 1;
    markThemeChanged('--border-width', `${originalValue}px`, `${value}px`, 'app-settings');
    setBorderWidth(value);
    setCustomTheme((prev) => ({ ...prev, '--border-width': `${value}px` }));
    sendVariablesToAllIframes({ '--border-width': `${value}px` });
  };

  // Handle save
  const handleSave = useCallback(async () => {
    if (!appId || isSaving) {
      return;
    }

    setIsSaving(true);
    try {
      const currentState = { ...originalVariablesRef.current, ...customTheme };
      const matchingTheme = findMatchingTheme(currentState);

      if (matchingTheme) {
        setSelectedTheme(matchingTheme);
        setIsCustomTheme(false);
        setCustomTheme({});
        originalThemeNameRef.current = matchingTheme;
        sendThemeToAllIframes(matchingTheme);
        const themeColors = getThemeColors(matchingTheme);
        if (themeColors.length > 0) {
          setCurrentColors(themeColors);
        }
      } else {
        originalThemeNameRef.current = CUSTOM_THEME_NAME;
      }

      if (originalVariablesRef.current) {
        originalVariablesRef.current = { ...originalVariablesRef.current, ...customTheme };
      }

      // Serialize all theme changes
      const themeVariables: Record<string, string> = {};
      Object.entries(themeChanges.lightThemeChanges).forEach(([key, change]) => {
        const trimmedValue = change.newValue?.trim() || '';
        if (trimmedValue !== '') {
          themeVariables[key] = trimmedValue;
        }
      });
      Object.entries(themeChanges.darkThemeChanges).forEach(([key, change]) => {
        const trimmedDarkValue = change.newValue?.trim() || '';
        if (trimmedDarkValue === '') {
          return;
        }
        const lightChange = themeChanges.lightThemeChanges[key];
        const trimmedLightValue = lightChange?.newValue?.trim() || '';
        if (trimmedLightValue !== '') {
          themeVariables[key] = `${trimmedLightValue} .dark: ${trimmedDarkValue}`;
        } else {
          themeVariables[`${key}-dark`] = trimmedDarkValue;
        }
      });
      Object.entries(themeChanges.appSettingsChanges).forEach(([key, change]) => {
        const trimmedValue = change.newValue?.trim() || '';
        if (trimmedValue !== '') {
          themeVariables[key] = trimmedValue;
        }
      });

      await callNutAPI('set-app-theme', {
        appId,
        theme: JSON.stringify(themeVariables),
      });
      markThemesSaved();
      toast.success('Theme changes saved successfully');
    } catch (error) {
      console.error('Failed to save theme changes:', error);
      toast.error('Failed to save theme changes');
    } finally {
      setIsSaving(false);
    }
  }, [appId, isSaving, customTheme, themeChanges]);

  // Handle discard
  const handleDiscard = useCallback(() => {
    resetThemeChanges();
    const originalThemeName = originalThemeNameRef.current;
    if (originalThemeName && originalThemeName !== CUSTOM_THEME_NAME) {
      setSelectedTheme(originalThemeName);
      setIsCustomTheme(false);
      setCustomTheme({});
      sendThemeToAllIframes(originalThemeName);
      const themeColors = getThemeColors(originalThemeName);
      if (themeColors.length > 0) {
        setCurrentColors(themeColors);
      }
    } else if (originalVariablesRef.current) {
      setSelectedTheme(CUSTOM_THEME_NAME);
      setIsCustomTheme(true);
      setCustomTheme(originalVariablesRef.current);
      sendVariablesToAllIframes(originalVariablesRef.current);
      if (originalFontRef.current) {
        setCurrentFont(originalFontRef.current);
        sendVariablesToAllIframes({ '--font-sans': originalFontRef.current.join(', ') });
      }
      if (originalRadiusRef.current !== null) {
        setRadius(originalRadiusRef.current);
        sendVariablesToAllIframes({ '--radius': `${originalRadiusRef.current}rem` });
      }
      if (originalSpacingUnitRef.current !== null) {
        setSpacingUnit(originalSpacingUnitRef.current);
        sendVariablesToAllIframes({ '--spacing-unit': `${originalSpacingUnitRef.current}px` });
      } else {
        setSpacingUnit(4);
        sendVariablesToAllIframes({ '--spacing-unit': '4px' });
      }
      if (originalBorderWidthRef.current !== null) {
        setBorderWidth(originalBorderWidthRef.current);
        sendVariablesToAllIframes({ '--border-width': `${originalBorderWidthRef.current}px` });
      } else {
        setBorderWidth(1);
        sendVariablesToAllIframes({ '--border-width': '1px' });
      }
      setCurrentColors(extractColorsFromVariables(originalVariablesRef.current));
    }
    setHoveredTheme(null);
    designPanelStore.isVisible.set(false);
  }, []);

  // Register handlers
  useEffect(() => {
    if (isVisible) {
      designPanelStore.handlers.set({ onSave: handleSave, onDiscard: handleDiscard, isSaving });
    } else {
      designPanelStore.handlers.set({});
    }
  }, [isVisible, handleSave, handleDiscard, isSaving]);

  // Render overview
  const renderOverview = () => (
    <div className="p-6 space-y-4">
      {/* Colors Section */}
      <div
        className="relative border-b border-bolt-elements-borderColor pb-4"
        onMouseEnter={() => setHoveredSection('colors')}
        onMouseLeave={() => setHoveredSection(null)}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Palette size={18} className="text-bolt-elements-textSecondary" />
            <h3 className="text-sm font-medium text-bolt-elements-textPrimary">Colors</h3>
          </div>
          <button
            onClick={() => setCurrentView('colors')}
            className={classNames(
              'flex items-center gap-1 px-2 py-1 text-xs font-medium text-bolt-elements-textPrimary bg-bolt-elements-background-depth-3 rounded border border-bolt-elements-borderColor hover:bg-bolt-elements-background-depth-4 transition-all',
              hoveredSection === 'colors' ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
            )}
          >
            <span>Advanced</span>
            <ChevronRight size={12} />
          </button>
        </div>
        <div className="flex items-center gap-2 mb-3">
          <ThemePicker
            options={availableThemes.map(
              (theme): ThemeOption => ({
                name: theme.name,
                title: theme.title,
                colors: getThemeColors(theme.name),
              }),
            )}
            value={selectedTheme}
            onChange={handleThemeChange}
            onHover={handleThemeHover}
            onHoverEnd={handleThemePickerHoverEnd}
            showCustomOption={isCustomTheme || themeChanges.hasChanges}
            isCustom={isCustomTheme || themeChanges.hasChanges}
            customColors={currentColors}
            placeholder="Select Theme"
          />
        </div>
      </div>

      {/* Fonts Section */}
      <div
        className="relative border-b border-bolt-elements-borderColor pb-4"
        onMouseEnter={() => setHoveredSection('typography')}
        onMouseLeave={() => setHoveredSection(null)}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Type size={18} className="text-bolt-elements-textSecondary" />
            <h3 className="text-sm font-medium text-bolt-elements-textPrimary">Fonts</h3>
          </div>
          <button
            onClick={() => setCurrentView('typography')}
            className={classNames(
              'flex items-center gap-1 px-2 py-1 text-xs font-medium text-bolt-elements-textPrimary bg-bolt-elements-background-depth-3 rounded border border-bolt-elements-borderColor hover:bg-bolt-elements-background-depth-4 transition-all',
              hoveredSection === 'typography' ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
            )}
          >
            <span>Advanced</span>
            <ChevronRight size={12} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <MultiSelect
            defaultValue={currentFont}
            onValueChange={handleFontChange}
            options={sansSerifFonts}
            placeholder="Select fonts..."
            maxCount={3}
            hideSelectAll
            onOptionHover={(option) => handleFontHover(option.value)}
            onOptionHoverEnd={handleFontHoverEnd}
          />
        </div>
      </div>

      {/* Other Settings Section */}
      <div className="space-y-4">
        <RadiusSelector
          icon={<Settings size={18} className="text-bolt-elements-textSecondary" />}
          currentValue={radius}
          onChange={handleRadiusChange}
        />
        <SpacingSelector
          icon={<Settings size={18} className="text-bolt-elements-textSecondary" />}
          currentValue={spacingUnit}
          onChange={handleSpacingUnitChange}
        />
        <BorderWidthSelector
          icon={<Settings size={18} className="text-bolt-elements-textSecondary" />}
          currentValue={borderWidth}
          onChange={handleBorderWidthChange}
        />
      </div>
    </div>
  );

  // Render detail view
  const renderDetailView = () => {
    if (currentView === 'overview') {
      return renderOverview();
    }

    return (
      <div className="p-6">
        <button
          onClick={() => setCurrentView('overview')}
          className="flex items-center gap-2 mb-4 text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors"
        >
          <ArrowLeft size={16} />
          <span>Back to Overview</span>
        </button>
        <TweakCn
          key={`${themeKey}-${currentView}`}
          selectedTheme={selectedTheme || undefined}
          hoveredTheme={hoveredTheme}
          originalVariables={originalVariablesRef.current}
          onThemeChange={handleThemeChange}
          onThemeModeChange={sendThemeModeToAllIframes}
          activeTabOverride={
            currentView === 'colors' ? 'colors' : currentView === 'typography' ? 'typography' : undefined
          }
        />
      </div>
    );
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="@container flex flex-col h-full w-full bg-bolt-elements-background-depth-1 rounded-xl border border-bolt-elements-borderColor shadow-lg overflow-hidden">
      <div className="bg-bolt-elements-background-depth-1 border-b border-bolt-elements-borderColor border-opacity-50 shadow-sm rounded-t-xl">
        <div className="flex items-center justify-between px-2 h-[38px]">
          <div className="flex-1 text-bolt-elements-textSecondary text-sm font-medium truncate pl-1">
            {currentView === 'overview' ? 'Design System' : currentView.charAt(0).toUpperCase() + currentView.slice(1)}
          </div>
          <div className="flex items-center gap-0.5 flex-shrink-0 pr-1">
            <button
              onClick={handleThemeModeToggle}
              className="p-1.5 rounded-lg text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-2 transition-all duration-200"
              title={themeMode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            >
              {themeMode === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col">
        {isLoading || !selectedTheme ? (
          <div className="flex-1 p-6 space-y-6">
            <Skeleton className="h-8 w-48" />
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          </div>
        ) : (
          renderDetailView()
        )}
      </div>
    </div>
  );
};
