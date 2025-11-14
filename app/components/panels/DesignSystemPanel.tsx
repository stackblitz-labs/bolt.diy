import { TweakCN } from '~/components/chat/Messages/components';

import { ChevronRight, ChevronLeft, ChevronDown } from '~/components/ui/Icon';

import { useState } from 'react';

import { getAvailableThemes } from '~/lib/replay/themeHelper';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';

import { classNames } from '~/utils/classNames';

export const DesignSystemPanel = () => {
  const [selectedTheme, setSelectedTheme] = useState('modern-minimal');
  const [hoveredTheme, setHoveredTheme] = useState<string | null>(null);
  const [isThemeDropdownOpen, setIsThemeDropdownOpen] = useState(false);
  const availableThemes = getAvailableThemes();

  const handleThemeChange = (themeName: string) => {
    setSelectedTheme(themeName);
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
    const currentIndex = availableThemes.findIndex((t) => t.name === selectedTheme);
    const previousIndex = currentIndex > 0 ? currentIndex - 1 : availableThemes.length - 1;
    handleThemeChange(availableThemes[previousIndex].name);
  };

  const handleNextTheme = () => {
    const currentIndex = availableThemes.findIndex((t) => t.name === selectedTheme);
    const nextIndex = currentIndex < availableThemes.length - 1 ? currentIndex + 1 : 0;
    handleThemeChange(availableThemes[nextIndex].name);
  };

  return (
    <div className="flex flex-col h-full w-full bg-bolt-elements-background-depth-1 rounded-xl border border-bolt-elements-borderColor overflow-hidden">
      <div className="bg-bolt-elements-background-depth-1 border-b border-bolt-elements-borderColor border-opacity-50 shadow-sm rounded-t-xl">
        <div className="flex items-center gap-2 px-4 h-[38px]">
          {/* Theme Navigation - Left Side */}
          <div className="flex-1 text-bolt-elements-textSecondary text-sm font-medium truncate">Design System</div>

          {/* Theme Navigation - Right Side */}
          <div className="flex items-center gap-1">
            <DropdownMenu open={isThemeDropdownOpen} onOpenChange={setIsThemeDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 px-2 py-1 text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-2 rounded-md transition-colors">
                  <span className="truncate font-medium">
                    {availableThemes.find((t) => t.name === selectedTheme)?.title || 'Select Theme'}
                  </span>
                  <ChevronDown size={14} className="flex-shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64 max-h-80 overflow-y-auto" onCloseAutoFocus={handleThemeHoverEnd}>
                <DropdownMenuLabel>Available Themes</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {availableThemes.map((theme) => (
                  <DropdownMenuItem
                    key={theme.name}
                    onClick={() => handleThemeChange(theme.name)}
                    onMouseEnter={() => handleThemeHover(theme.name)}
                    onMouseLeave={handleThemeHoverEnd}
                    className={classNames({
                      'bg-bolt-elements-background-depth-2': selectedTheme === theme.name,
                    })}
                  >
                    <div className="flex flex-col gap-1 w-full">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{theme.title}</span>
                        {selectedTheme === theme.name && <span className="text-xs">✓</span>}
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
        <TweakCN selectedTheme={selectedTheme} hoveredTheme={hoveredTheme} onThemeChange={handleThemeChange} />
      </div>
    </div>
  );
};
