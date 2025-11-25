'use client';

import * as React from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '~/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '~/components/ui/command';

export interface ThemeOption {
  name: string;
  title: string;
  colors?: string[];
}

export interface ThemePickerProps {
  options: ThemeOption[];
  value: string | null;
  onChange: (themeName: string) => void;
  onHover?: (themeName: string) => void;
  onHoverEnd?: () => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Show "Custom" as the first option when true */
  showCustomOption?: boolean;
  /** Whether the current value is a custom theme */
  isCustom?: boolean;
  /** Colors to show for the custom theme */
  customColors?: string[];
  /** Searchable */
  searchable?: boolean;
}

export const ThemePicker = React.forwardRef<HTMLButtonElement, ThemePickerProps>(
  (
    {
      options,
      value,
      onChange,
      onHover,
      onHoverEnd,
      placeholder = 'Select theme...',
      className,
      disabled,
      showCustomOption = false,
      isCustom = false,
      customColors = [],
      searchable = true,
    },
    ref,
  ) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState('');

    const handleOpenChange = (open: boolean) => {
      setIsOpen(open);
      if (open) {
        setSearchQuery('');
      } else {
        onHoverEnd?.();
      }
    };

    const handleSelect = (themeName: string) => {
      onChange(themeName);
      setIsOpen(false);
    };

    const filteredOptions = options.filter(
      (option) =>
        option.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        option.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );

    const selectedTheme = options.find((o) => o.name === value);
    const displayTitle = isCustom ? 'Custom' : selectedTheme?.title || placeholder;
    const displayColors = isCustom ? customColors : selectedTheme?.colors || [];

    return (
      <Popover open={isOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            ref={ref}
            type="button"
            disabled={disabled}
            className={cn(
              'flex min-h-[40px] w-full items-center justify-between rounded-lg border px-3 py-2',
              'bg-bolt-elements-background-depth-2 border-bolt-elements-borderColor',
              'hover:border-bolt-elements-borderColorActive',
              'focus:outline-none focus:ring-1 focus:ring-bolt-elements-borderColorActive',
              disabled && 'opacity-50 cursor-not-allowed',
              className,
            )}
          >
            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
              <span className="text-sm text-bolt-elements-textPrimary truncate text-left">{displayTitle}</span>
              {displayColors.length > 0 && (
                <div className="flex gap-1.5">
                  {displayColors.slice(0, 4).map((color, idx) => (
                    <div
                      key={idx}
                      className="w-5 h-5 rounded border border-bolt-elements-borderColor"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              )}
            </div>
            <ChevronDown
              className={cn(
                'h-4 w-4 text-bolt-elements-textSecondary transition-transform flex-shrink-0',
                isOpen && 'rotate-180',
              )}
            />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
          onMouseLeave={() => onHoverEnd?.()}
        >
          <Command>
            {searchable && (
              <CommandInput placeholder="Search themes..." value={searchQuery} onValueChange={setSearchQuery} />
            )}
            <CommandList>
              <CommandEmpty>No themes found.</CommandEmpty>
              <CommandGroup>
                {showCustomOption && (
                  <CommandItem
                    onSelect={() => {}}
                    className={cn('cursor-default', isCustom && 'bg-bolt-elements-background-depth-2')}
                  >
                    <div className="flex flex-col gap-2 w-full">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm text-bolt-elements-textPrimary">Custom</span>
                        {isCustom && <Check className="h-4 w-4" />}
                      </div>
                      {customColors.length > 0 && (
                        <div className="flex gap-1.5">
                          {customColors.slice(0, 4).map((color, idx) => (
                            <div
                              key={idx}
                              className="w-5 h-5 rounded border border-bolt-elements-borderColor"
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </CommandItem>
                )}
                {filteredOptions.map((theme) => {
                  const isSelected = value === theme.name && !isCustom;
                  return (
                    <CommandItem
                      key={theme.name}
                      onSelect={() => handleSelect(theme.name)}
                      onMouseEnter={() => onHover?.(theme.name)}
                      className="cursor-pointer"
                    >
                      <div className="flex flex-col gap-2 w-full">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-sm text-bolt-elements-textPrimary truncate">
                            {theme.title}
                          </span>
                          {isSelected && <Check className="h-4 w-4" />}
                        </div>
                        {theme.colors && theme.colors.length > 0 && (
                          <div className="flex gap-1.5">
                            {theme.colors.slice(0, 4).map((color, idx) => (
                              <div
                                key={idx}
                                className="w-5 h-5 rounded border border-bolt-elements-borderColor"
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  },
);

ThemePicker.displayName = 'ThemePicker';
