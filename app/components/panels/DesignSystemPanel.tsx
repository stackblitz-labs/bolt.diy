import { TweakCN } from '~/components/chat/Messages/components';

import { ChevronRight, ChevronLeft, ChevronDown } from '~/components/ui/Icon';

import { useState, useEffect, useRef, useCallback } from 'react';

import { getAvailableThemes, findMatchingTheme } from '~/lib/replay/themeHelper';

import { Skeleton } from '~/components/ui/Skeleton';

import { Sun, Moon } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';

import { classNames } from '~/utils/classNames';

import { useStore } from '@nanostores/react';

import { activeSidebarTab } from '~/lib/stores/sidebarNav';

const CUSTOM_THEME_NAME = 'custom';

export const DesignSystemPanel = () => {
  const activeTab = useStore(activeSidebarTab);
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [hoveredTheme, setHoveredTheme] = useState<string | null>(null);
  const [isThemeDropdownOpen, setIsThemeDropdownOpen] = useState(false);
  const [isCustomTheme, setIsCustomTheme] = useState(false);
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('light');
  const [isLoading, setIsLoading] = useState(false);
  const [themeKey, setThemeKey] = useState(0); // Key to force TweakCN remount on reset
  const originalThemeRef = useRef<string | null>(null); // Store original theme when dropdown opens
  const hasLoadedThemeRef = useRef(false);
  const availableThemes = getAvailableThemes();

  // Send theme mode change to iframe
  const sendThemeModeToIframe = (mode: 'light' | 'dark') => {
    const iframe = document.querySelector('iframe');
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

  // Listen for theme changes from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Listen for theme changes from the iframe
      if (event.data?.type === 'THEME_CHANGED' && event.data?.source === 'app-theme-provider') {
        const newTheme = event.data.theme;
        if (newTheme === 'light' || newTheme === 'dark') {
          setThemeMode(newTheme);
        }
      }
      // Listen for initial app ready message
      if (event.data?.type === 'APP_READY' && event.data?.source === 'app-theme-provider') {
        const initialTheme = event.data.theme;
        if (initialTheme === 'light' || initialTheme === 'dark') {
          setThemeMode(initialTheme);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  // Toggle theme mode
  const handleThemeModeToggle = () => {
    const newMode = themeMode === 'light' ? 'dark' : 'light';
    setThemeMode(newMode);
    sendThemeModeToIframe(newMode);
  };

  // Function to load theme from iframe
  const loadThemeFromIframe = useCallback(() => {
    setIsLoading(true);
    const iframe = document.querySelector('iframe');
    if (iframe?.contentWindow) {
      const requestId = Date.now().toString();
      const handleMessage = (event: MessageEvent) => {
        if (event.data?.id === requestId && event.data?.response && event.data?.source === '@@replay-nut') {
          window.removeEventListener('message', handleMessage);
          setIsLoading(false);

          const currentVariables = event.data.response as Record<string, string>;
          if (currentVariables && Object.keys(currentVariables).length > 0) {
            // Try to find a matching theme
            const matchingTheme = findMatchingTheme(currentVariables);
            if (matchingTheme) {
              setSelectedTheme(matchingTheme);
              setIsCustomTheme(false);
              setThemeKey((prev) => prev + 1); // Force TweakCN to reload
            } else {
              // Custom theme - set to custom and let TweakCN load the values
              setSelectedTheme(CUSTOM_THEME_NAME);
              setIsCustomTheme(true);
              setThemeKey((prev) => prev + 1); // Force TweakCN to reload
            }
          } else {
            // No variables found, default to first available theme
            setSelectedTheme(availableThemes[0]?.name || 'modern-minimal');
            setIsCustomTheme(false);
            setThemeKey((prev) => prev + 1); // Force TweakCN to reload
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

      // Cleanup timeout
      setTimeout(() => {
        window.removeEventListener('message', handleMessage);
        setIsLoading(false);
      }, 5000);
    } else {
      // No iframe found, default to first available theme
      setSelectedTheme(availableThemes[0]?.name || 'modern-minimal');
      setIsCustomTheme(false);
      setIsLoading(false);
    }
  }, [availableThemes]);

  // Load current theme from iframe when design tab is opened
  useEffect(() => {
    if (activeTab === 'design-system') {
      if (!hasLoadedThemeRef.current || selectedTheme === null) {
        hasLoadedThemeRef.current = true;
        loadThemeFromIframe();
      }
    } else if (activeTab !== 'design-system') {
      // Reset when leaving design tab
      hasLoadedThemeRef.current = false;
      setSelectedTheme(null);
      setIsCustomTheme(false);
      setIsLoading(false);
    }
  }, [activeTab, availableThemes, loadThemeFromIframe, selectedTheme]);

  // Listen for theme reset and APP_READY messages
  useEffect(() => {
    let waitingForReload = false;

    const handleReset = () => {
      // Clear the design system panel
      setSelectedTheme(null);
      setIsCustomTheme(false);
      setIsLoading(true);
      hasLoadedThemeRef.current = false;
      setThemeKey((prev) => prev + 1); // Force TweakCN to remount
      waitingForReload = true;
    };

    const handleMessage = (event: MessageEvent) => {
      // Listen for APP_READY after a reset to reload the theme
      if (event.data?.type === 'APP_READY' && event.data?.source === 'app-theme-provider') {
        if (waitingForReload) {
          waitingForReload = false;
          // Small delay to ensure iframe is fully ready
          setTimeout(() => {
            if (activeTab === 'design-system') {
              hasLoadedThemeRef.current = false; // Force reload
              loadThemeFromIframe();
            }
          }, 500);
        }
      }
    };

    window.addEventListener('theme-reset-requested', handleReset);
    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('theme-reset-requested', handleReset);
      window.removeEventListener('message', handleMessage);
    };
  }, [activeTab, loadThemeFromIframe]);

  const handleThemeChange = (themeName: string) => {
    if (themeName === CUSTOM_THEME_NAME) {
      // Don't allow selecting custom directly
      return;
    }
    setSelectedTheme(themeName);
    setIsCustomTheme(false);
    setHoveredTheme(null);
    setIsThemeDropdownOpen(false);
    originalThemeRef.current = null; // Clear stored original theme after selection
  };

  const handleThemeHover = (themeName: string) => {
    // Always set hover to enable preview
    setHoveredTheme(themeName);
  };

  const handleThemeHoverEnd = () => {
    // Clear hover when mouse leaves
    setHoveredTheme(null);
  };

  const handleDropdownOpenChange = (open: boolean) => {
    setIsThemeDropdownOpen(open);

    if (open) {
      // Store the current theme when dropdown opens
      originalThemeRef.current = selectedTheme;
    } else {
      // Dropdown is closing
      // If no theme was selected and we have a stored original theme, restore it
      if (originalThemeRef.current !== null && originalThemeRef.current === selectedTheme) {
        // User didn't select a new theme, restore original preview
        setHoveredTheme(null);
      } else if (originalThemeRef.current !== null && hoveredTheme !== null) {
        // User hovered but didn't select - restore original theme
        setHoveredTheme(null);
        // The selectedTheme should already be the original, but ensure hover is cleared
      }
      originalThemeRef.current = null;
    }
  };

  const handlePreviousTheme = () => {
    if (isCustomTheme || !selectedTheme) {
      return; // Don't navigate when on custom theme or theme not loaded
    }
    const currentIndex = availableThemes.findIndex((t) => t.name === selectedTheme);
    if (currentIndex === -1) {
      // If theme not found, default to first theme
      if (availableThemes.length > 0) {
        handleThemeChange(availableThemes[0].name);
      }
      return;
    }
    const previousIndex = currentIndex > 0 ? currentIndex - 1 : availableThemes.length - 1;
    const previousTheme = availableThemes[previousIndex];
    if (previousTheme) {
      handleThemeChange(previousTheme.name);
    }
  };

  const handleNextTheme = () => {
    if (isCustomTheme || !selectedTheme) {
      return; // Don't navigate when on custom theme or theme not loaded
    }
    const currentIndex = availableThemes.findIndex((t) => t.name === selectedTheme);
    if (currentIndex === -1) {
      // If theme not found, default to first theme
      if (availableThemes.length > 0) {
        handleThemeChange(availableThemes[0].name);
      }
      return;
    }
    const nextIndex = currentIndex < availableThemes.length - 1 ? currentIndex + 1 : 0;
    const nextTheme = availableThemes[nextIndex];
    if (nextTheme) {
      handleThemeChange(nextTheme.name);
    }
  };

  return (
    <div className="@container flex flex-col h-full w-full bg-bolt-elements-background-depth-1 rounded-xl border border-bolt-elements-borderColor shadow-lg overflow-hidden">
      <div className="bg-bolt-elements-background-depth-1 border-b border-bolt-elements-borderColor border-opacity-50 shadow-sm rounded-t-xl">
        <div className="flex items-center gap-2 px-4 h-[38px]">
          {/* Theme Navigation - Left Side */}
          <div className="flex-1 text-bolt-elements-textSecondary text-sm font-medium truncate">Design System</div>

          {/* Theme Navigation - Right Side */}
          <div className="flex items-center gap-1">
            {/* Theme Mode Toggle */}
            <button
              onClick={handleThemeModeToggle}
              className="p-1.5 rounded-lg text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-2 transition-all duration-200 flex-shrink-0"
              title={themeMode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            >
              {themeMode === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>
            <DropdownMenu open={isThemeDropdownOpen} onOpenChange={handleDropdownOpenChange}>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 px-2 py-1 text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-2 rounded-md transition-colors">
                  <span className="truncate font-medium">
                    {isCustomTheme
                      ? 'Custom'
                      : availableThemes.find((t) => t.name === selectedTheme)?.title || 'Select Theme'}
                  </span>
                  <ChevronDown size={14} className="flex-shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64 max-h-80 overflow-y-auto" onCloseAutoFocus={handleThemeHoverEnd}>
                <DropdownMenuLabel>Available Themes</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {isCustomTheme && (
                  <DropdownMenuItem
                    className="bg-bolt-elements-background-depth-2 cursor-default"
                    onMouseEnter={handleThemeHoverEnd}
                  >
                    <div className="flex flex-col gap-1 w-full">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">Custom</span>
                        <span className="text-xs">✓</span>
                      </div>
                      <span className="text-xs text-bolt-elements-textSecondary line-clamp-2">
                        Custom theme with modifications
                      </span>
                    </div>
                  </DropdownMenuItem>
                )}
                {availableThemes.map((theme) => (
                  <DropdownMenuItem
                    key={theme.name}
                    onClick={() => handleThemeChange(theme.name)}
                    onMouseEnter={() => handleThemeHover(theme.name)}
                    onMouseLeave={handleThemeHoverEnd}
                    className={classNames({
                      'bg-bolt-elements-background-depth-2': selectedTheme === theme.name && !isCustomTheme,
                    })}
                  >
                    <div className="flex flex-col gap-1 w-full">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{theme.title}</span>
                        {selectedTheme === theme.name && !isCustomTheme && <span className="text-xs">✓</span>}
                      </div>
                      <span className="text-xs text-bolt-elements-textSecondary line-clamp-2">{theme.description}</span>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              onClick={handlePreviousTheme}
              className="p-1 rounded-lg text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-2 transition-all duration-200 flex-shrink-0"
              title="Previous theme"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={handleNextTheme}
              className="p-1 rounded-lg text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-2 transition-all duration-200 flex-shrink-0"
              title="Next theme"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col">
        {isLoading || !selectedTheme ? (
          <div className="flex-1 p-6 space-y-6">
            {/* Header skeleton */}
            <div className="space-y-4">
              <Skeleton className="h-8 w-48" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-10 w-32 rounded-lg" />
                <Skeleton className="h-10 w-10 rounded-lg" />
              </div>
            </div>

            {/* Tabs skeleton */}
            <div className="flex gap-2 border-b border-bolt-elements-borderColor pb-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-8 w-24 rounded-lg" />
              ))}
            </div>

            {/* Content skeleton */}
            <div className="space-y-6">
              {[1, 2, 3].map((section) => (
                <div key={section} className="space-y-4">
                  <Skeleton className="h-6 w-32" />
                  <div className="grid grid-cols-1 @[500px]:grid-cols-2 gap-4">
                    {[1, 2].map((item) => (
                      <div key={item} className="space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-10 w-10 rounded border" />
                          <Skeleton className="h-8 flex-1 rounded-md" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <TweakCN
            key={themeKey}
            selectedTheme={selectedTheme}
            hoveredTheme={hoveredTheme}
            onThemeChange={handleThemeChange}
            onThemeModeChange={sendThemeModeToIframe}
          />
        )}
      </div>
    </div>
  );
};
