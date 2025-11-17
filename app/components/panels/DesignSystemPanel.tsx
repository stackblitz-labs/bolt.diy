import { TweakCN } from '~/components/chat/Messages/components';

import { ChevronRight, ChevronLeft, ChevronDown } from '~/components/ui/Icon';

import { useState, useEffect, useRef } from 'react';

import { getAvailableThemes, findMatchingTheme } from '~/lib/replay/themeHelper';

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

  // Load current theme from iframe when design tab is opened
  useEffect(() => {
    if (activeTab === 'design-system' && !hasLoadedThemeRef.current) {
      hasLoadedThemeRef.current = true;

      // Request current theme variables from iframe
      const iframe = document.querySelector('iframe');
      if (iframe?.contentWindow) {
        const requestId = Date.now().toString();
        const handleMessage = (event: MessageEvent) => {
          if (
            event.data?.id === requestId &&
            event.data?.response &&
            event.data?.source === '@@replay-nut'
          ) {
            window.removeEventListener('message', handleMessage);

            const currentVariables = event.data.response as Record<string, string>;
            if (currentVariables && Object.keys(currentVariables).length > 0) {
              // Try to find a matching theme
              const matchingTheme = findMatchingTheme(currentVariables);
              if (matchingTheme) {
                setSelectedTheme(matchingTheme);
                setIsCustomTheme(false);
              } else {
                // Custom theme - set to custom and let TweakCN load the values
                setSelectedTheme(CUSTOM_THEME_NAME);
                setIsCustomTheme(true);
              }
            } else {
              // No variables found, default to first available theme
              setSelectedTheme(availableThemes[0]?.name || 'modern-minimal');
              setIsCustomTheme(false);
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
        }, 5000);
      } else {
        // No iframe found, default to first available theme
        setSelectedTheme(availableThemes[0]?.name || 'modern-minimal');
        setIsCustomTheme(false);
      }
    } else if (activeTab !== 'design-system') {
      // Reset when leaving design tab
      hasLoadedThemeRef.current = false;
      setSelectedTheme(null);
      setIsCustomTheme(false);
    }
  }, [activeTab, availableThemes]);

  const handleThemeChange = (themeName: string) => {
    if (themeName === CUSTOM_THEME_NAME) {
      // Don't allow selecting custom directly
      return;
    }
    setSelectedTheme(themeName);
    setIsCustomTheme(false);
    setHoveredTheme(null);
    setIsThemeDropdownOpen(false);
  };

  const handleThemeHover = (themeName: string) => {
    setHoveredTheme(themeName);
  };

  const handleThemeHoverEnd = () => {
    setHoveredTheme(null);
  };

  const handlePreviousTheme = () => {
    if (isCustomTheme || !selectedTheme) {
      return; // Don't navigate when on custom theme or theme not loaded
    }
    const currentIndex = availableThemes.findIndex((t) => t.name === selectedTheme);
    const previousIndex = currentIndex > 0 ? currentIndex - 1 : availableThemes.length - 1;
    handleThemeChange(availableThemes[previousIndex].name);
  };

  const handleNextTheme = () => {
    if (isCustomTheme || !selectedTheme) {
      return; // Don't navigate when on custom theme or theme not loaded
    }
    const currentIndex = availableThemes.findIndex((t) => t.name === selectedTheme);
    const nextIndex = currentIndex < availableThemes.length - 1 ? currentIndex + 1 : 0;
    handleThemeChange(availableThemes[nextIndex].name);
  };

  return (
    <div className="@container flex flex-col h-full w-full bg-bolt-elements-background-depth-1 rounded-xl border border-bolt-elements-borderColor overflow-hidden">
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
            <DropdownMenu open={isThemeDropdownOpen} onOpenChange={setIsThemeDropdownOpen}>
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
        {selectedTheme && (
          <TweakCN selectedTheme={selectedTheme} hoveredTheme={hoveredTheme} onThemeChange={handleThemeChange} />
        )}
      </div>
    </div>
  );
};
