import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '~/components/ui/command';
import { Popover, PopoverContent, PopoverAnchor } from '~/components/ui/popover';
import { classNames } from '~/utils/classNames';
import {
  ChevronDown,
  File,
  Home,
  Settings,
  User,
  Search,
  MessageSquare,
  LogIn,
  LogOut,
  Layout,
  List,
  CreditCard,
} from '~/components/ui/Icon';

interface Page {
  name?: string;
  path: string;
  icon?: string;
}

// Map common page names/paths to icons
function getPageIcon(page: Page) {
  const name = (page.name || '').toLowerCase();
  const path = page.path.toLowerCase();

  if (path === '/' || name === 'home' || name === 'homepage') {
    return <Home size={14} className="shrink-0 text-bolt-elements-textTertiary" />;
  }
  if (name.includes('settings') || path.includes('settings')) {
    return <Settings size={14} className="shrink-0 text-bolt-elements-textTertiary" />;
  }
  if (
    name.includes('profile') ||
    name.includes('user') ||
    name.includes('account') ||
    path.includes('profile') ||
    path.includes('user') ||
    path.includes('account')
  ) {
    return <User size={14} className="shrink-0 text-bolt-elements-textTertiary" />;
  }
  if (name.includes('dashboard') || path.includes('dashboard')) {
    return <Layout size={14} className="shrink-0 text-bolt-elements-textTertiary" />;
  }
  if (name.includes('search') || path.includes('search')) {
    return <Search size={14} className="shrink-0 text-bolt-elements-textTertiary" />;
  }
  if (name.includes('contact') || name.includes('message') || path.includes('contact') || path.includes('message')) {
    return <MessageSquare size={14} className="shrink-0 text-bolt-elements-textTertiary" />;
  }
  if (name.includes('login') || name.includes('signin') || path.includes('login') || path.includes('signin')) {
    return <LogIn size={14} className="shrink-0 text-bolt-elements-textTertiary" />;
  }
  if (name.includes('logout') || name.includes('signout') || path.includes('logout') || path.includes('signout')) {
    return <LogOut size={14} className="shrink-0 text-bolt-elements-textTertiary" />;
  }
  if (name.includes('list') || path.includes('list')) {
    return <List size={14} className="shrink-0 text-bolt-elements-textTertiary" />;
  }
  if (
    name.includes('payment') ||
    name.includes('billing') ||
    name.includes('checkout') ||
    path.includes('payment') ||
    path.includes('billing') ||
    path.includes('checkout')
  ) {
    return <CreditCard size={14} className="shrink-0 text-bolt-elements-textTertiary" />;
  }

  // Default icon
  return <File size={14} className="shrink-0 text-bolt-elements-textTertiary" />;
}

interface UrlComboboxProps {
  url: string;
  onUrlChange: (url: string) => void;
  onUrlSubmit: (url: string) => void;
  onPageSelect: (pagePath: string) => void;
  pages?: Page[];
  isSmallViewport?: boolean;
  className?: string;
}

export function UrlCombobox({
  url,
  onUrlChange,
  onUrlSubmit,
  onPageSelect,
  pages = [],
  isSmallViewport = false,
  className,
}: UrlComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Extract the base URL and path from the current URL
  const { baseUrl, path } = useMemo(() => {
    try {
      const urlObj = new URL(url);
      return {
        baseUrl: `${urlObj.protocol}//${urlObj.host}`,
        path: urlObj.pathname + urlObj.search + urlObj.hash,
      };
    } catch {
      const match = url.match(/^(https?:\/\/[^/]+)(\/.*)?$/);
      if (match) {
        return {
          baseUrl: match[1],
          path: match[2] || '/',
        };
      }
      return {
        baseUrl: '',
        path: url || '/',
      };
    }
  }, [url]);

  // Display path without leading slash
  const displayPath = useMemo(() => {
    return path.startsWith('/') ? path.slice(1) : path;
  }, [path]);

  // Filter pages based on search value
  const filteredPages = useMemo(() => {
    if (!pages.length) return [];

    const search = searchValue.toLowerCase().trim();
    if (!search) return pages;

    return pages.filter((page) => {
      const pagePath = page.path.toLowerCase();
      const pageName = (page.name || '').toLowerCase();
      const normalizedSearch = search.startsWith('/') ? search.slice(1) : search;
      const normalizedPath = pagePath.startsWith('/') ? pagePath.slice(1) : pagePath;

      return normalizedPath.includes(normalizedSearch) || pageName.includes(normalizedSearch);
    });
  }, [pages, searchValue]);

  // Reset selected index when filtered pages change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredPages.length]);

  const hasPages = pages.length > 0;

  // Reset selected index when filtered pages change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredPages.length]);

  const handlePageSelect = useCallback(
    (pagePath: string) => {
      onPageSelect(pagePath);
      setSearchValue('');
      setSelectedIndex(0);
      setOpen(false);
      inputRef.current?.blur();
    },
    [onPageSelect],
  );

  // Handle input change with URL detection
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;

      // Check if the value looks like a full URL being pasted
      if (value.match(/^https?:\/\//)) {
        // It's a full URL, update the entire URL
        onUrlChange(value);
        setSearchValue('');
      } else {
        // It's a search/path value
        setSearchValue(value);

        if (hasPages && !open) {
          setOpen(true);
        }
      }
    },
    [hasPages, open, onUrlChange],
  );

  // Handle paste specially to detect full URLs
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      const pastedText = e.clipboardData.getData('text');

      // If pasting a full URL, handle it specially
      if (pastedText.match(/^https?:\/\//)) {
        e.preventDefault();
        onUrlChange(pastedText);
        setSearchValue('');
      }
    },
    [onUrlChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();

        // If dropdown is open and we have a selected item, use that
        if (open && filteredPages.length > 0) {
          const selectedPage = filteredPages[selectedIndex];
          if (selectedPage) {
            handlePageSelect(selectedPage.path);
            return;
          }
        }

        if (searchValue.trim()) {
          const normalizedSearch = searchValue.toLowerCase().trim();
          const searchWithoutSlash = normalizedSearch.startsWith('/') ? normalizedSearch.slice(1) : normalizedSearch;

          // Find exact or partial match
          const exactMatch = pages.find((page) => {
            const pagePath = page.path.toLowerCase();
            const pathWithoutSlash = pagePath.startsWith('/') ? pagePath.slice(1) : pagePath;
            const pageName = (page.name || '').toLowerCase();
            return pathWithoutSlash === searchWithoutSlash || pageName === normalizedSearch;
          });

          const partialMatch = filteredPages[0];
          const matchedPage = exactMatch || partialMatch;

          if (matchedPage) {
            handlePageSelect(matchedPage.path);
            return;
          }

          // Navigate to the search value as a path
          const newPath = searchValue.startsWith('/') ? searchValue : '/' + searchValue;
          const newUrl = baseUrl + newPath;
          onUrlChange(newUrl);
          onUrlSubmit(newUrl);
          setSearchValue('');
        } else {
          onUrlSubmit(url);
        }

        setOpen(false);
        inputRef.current?.blur();
      } else if (e.key === 'Escape') {
        setSearchValue('');
        setOpen(false);
        inputRef.current?.blur();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (!open && hasPages) {
          setOpen(true);
        } else if (open && filteredPages.length > 0) {
          setSelectedIndex((prev) => Math.min(prev + 1, filteredPages.length - 1));
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (open && filteredPages.length > 0) {
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
        }
      }
    },
    [
      url,
      searchValue,
      baseUrl,
      pages,
      filteredPages,
      onUrlChange,
      onUrlSubmit,
      hasPages,
      open,
      selectedIndex,
      handlePageSelect,
    ],
  );

  const handleDropdownClick = useCallback(() => {
    if (!open) {
      setSearchValue('');
      inputRef.current?.focus();
    }
    setOpen(!open);
  }, [open]);

  const handleDropdownDoubleClick = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  }, [url]);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    setSearchValue('');
    if (hasPages) {
      setOpen(true);
    }
  }, [hasPages]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    setSearchValue('');
  }, []);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Determine what to show in the input
  const inputValue = useMemo(() => {
    if (isFocused) {
      return searchValue;
    }
    return displayPath;
  }, [isFocused, searchValue, displayPath]);

  return (
    <div ref={containerRef} className="flex-grow min-w-0">
      <Popover open={open && hasPages} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div
            className={classNames(
              'flex items-center bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textSecondary px-3 py-2 text-sm hover:bg-bolt-elements-background-depth-3 hover:border-bolt-elements-borderColor focus-within:bg-bolt-elements-background-depth-3 focus-within:border-blue-500/50 focus-within:text-bolt-elements-textPrimary transition-all duration-200 shadow-sm hover:shadow-md cursor-text',
              {
                'rounded-xl': !isSmallViewport,
              },
              className,
            )}
            onClick={() => {
              inputRef.current?.focus();
              if (hasPages) {
                setSearchValue('');
                setOpen(true);
              }
            }}
            onDoubleClick={handleDropdownDoubleClick}
          >
            {/* Base URL - always visible, shrinks as needed */}
            <span className="text-bolt-elements-textTertiary shrink min-w-0 truncate pointer-events-none">
              {baseUrl}/
            </span>

            {/* Path input */}
            <input
              ref={inputRef}
              title="Search pages or enter path"
              data-slot="input-group-control"
              className="flex-1 min-w-[60px] bg-transparent border-none outline-none focus:ring-0 focus:ring-offset-0 p-0 text-bolt-elements-textPrimary"
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onPaste={handlePaste}
              placeholder={isFocused ? 'Search pages...' : ''}
            />

            {hasPages && (
              <>
                <div className="w-px h-4 bg-bolt-elements-textSecondary opacity-30 shrink-0 mx-2 pointer-events-none" />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDropdownClick();
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    handleDropdownDoubleClick();
                  }}
                  className="flex items-center gap-1 px-1 py-1 rounded-md hover:bg-bolt-elements-background-depth-3 transition-colors text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary shrink-0"
                  title="Click to switch page, double-click to copy URL"
                >
                  <ChevronDown
                    size={16}
                    className={classNames('transition-transform duration-200', {
                      'rotate-180': open,
                    })}
                  />
                </button>
              </>
            )}
          </div>
        </PopoverAnchor>
        <PopoverContent
          className="p-0 w-[var(--radix-popover-trigger-width)] max-h-[300px] overflow-hidden"
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <Command className="rounded-lg border-0" shouldFilter={false}>
            <CommandList>
              <CommandEmpty className="py-4 text-center text-sm text-bolt-elements-textSecondary">
                No pages found.
              </CommandEmpty>
              <CommandGroup>
                {filteredPages.map((page, index) => (
                  <CommandItem
                    key={index}
                    value={`${page.name || ''} ${page.path}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handlePageSelect(page.path);
                    }}
                    onSelect={() => handlePageSelect(page.path)}
                    data-selected={index === selectedIndex}
                    className={classNames('flex items-center gap-2 cursor-pointer px-3 py-2', {
                      'bg-bolt-elements-background-depth-2': index === selectedIndex,
                    })}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    {getPageIcon(page)}
                    <span className="font-medium truncate flex-1">{page.name || page.path}</span>
                    <span className="text-xs text-bolt-elements-textSecondary shrink-0">{page.path}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
