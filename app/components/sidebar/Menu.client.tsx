import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { Dialog, DialogButton, DialogDescription, DialogRoot, DialogTitle } from '~/components/ui/Dialog';
import { SettingsWindow } from '~/components/settings/SettingsWindow';
import { database, type AppLibraryEntry } from '~/lib/persistence/apps';
import { chatStore } from '~/lib/stores/chat';
import { logger } from '~/utils/logger';
import { HistoryItem } from './HistoryItem';
import { binDates } from './date-binning';
import { useSearchFilter } from '~/lib/hooks/useSearchFilter';
import Cookies from 'js-cookie';
import { useStore } from '@nanostores/react';
import { sidebarMenuStore } from '~/lib/stores/sidebarMenu';
import { messageInputFocusStore } from '~/lib/stores/messageInputFocus';
import useViewport from '~/lib/hooks';
import { Plus, Search, Folder, FolderOpen, PanelLeft, Home } from '~/components/ui/Icon';
import { classNames } from '~/utils/classNames';
import { ClientAuth } from '~/components/auth/ClientAuth';
import WithTooltip from '~/components/ui/Tooltip';
import { TooltipProvider } from '@radix-ui/react-tooltip';

type DialogContent = { type: 'delete'; item: AppLibraryEntry } | null;

const skipConfirmDeleteCookieName = 'skipConfirmDelete';

export const Menu = () => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [list, setList] = useState<AppLibraryEntry[] | undefined>(undefined);
  const isOpen = useStore(sidebarMenuStore.isOpen);
  const [dialogContent, setDialogContent] = useState<DialogContent>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [skipConfirmDeleteChecked, setSkipConfirmDeleteChecked] = useState(false);
  const isSmallViewport = useViewport(800);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isCollapsed, setIsCollapsed] = useState(sidebarMenuStore.isCollapsed.get());

  // Sync local state with store
  useEffect(() => {
    const unsubscribe = sidebarMenuStore.isCollapsed.subscribe((collapsed) => {
      setIsCollapsed(collapsed);
    });
    return unsubscribe;
  }, []);
  const { filteredItems: filteredList, handleSearchChange } = useSearchFilter({
    items: list ?? [],
    searchFields: ['title'],
  });

  const loadEntries = useCallback(() => {
    setList(undefined);
    database
      .getAllAppEntries()
      .then(setList)
      .catch((error) => toast.error(error.message));
  }, []);

  const deleteItem = useCallback(
    (event: React.UIEvent, item: AppLibraryEntry) => {
      event.preventDefault();

      setList(list?.filter((chat) => chat.id !== item.id));

      database
        .deleteApp(item.id)
        .then(() => {
          setList(list?.filter((chat) => chat.id !== item.id));

          if (chatStore.currentAppId.get() === item.id) {
            window.location.pathname = '/';
          }
        })
        .catch((error) => {
          toast.error('Failed to delete app');
          logger.error(error);
        });
    },
    [list],
  );

  const closeDialog = () => {
    setDialogContent(null);
    setSkipConfirmDeleteChecked(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadEntries();
    } else {
      // Clear search when menu closes
      setSearchValue('');
      setIsSearchFocused(false);
      if (searchInputRef.current) {
        searchInputRef.current.value = '';
      }
    }
  }, [isOpen]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+K or Cmd+K for search
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        setIsSearchFocused(true);
        // Focus the input after state update
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 0);
      }
      // Ctrl+N or Cmd+N for new app
      if ((event.ctrlKey || event.metaKey) && event.key === 'n') {
        event.preventDefault();
        window.location.href = '/';
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleDeleteClick = (event: React.UIEvent, item: AppLibraryEntry) => {
    event.preventDefault();

    const skipConfirmDelete = Cookies.get(skipConfirmDeleteCookieName);

    if (skipConfirmDelete === 'true') {
      deleteItem(event, item);
    } else {
      setDialogContent({ type: 'delete', item });
    }
  };

  // On mobile, only show menu when isOpen is true, and always show expanded (not collapsed)
  const shouldShowMenu = !isSmallViewport || isOpen;
  const effectiveCollapsed = isSmallViewport ? false : isCollapsed;

  if (!shouldShowMenu) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      className={classNames(
        'flex selection-accent flex-col side-menu fixed top-0 w-full h-full bg-bolt-elements-background-depth-2 border-r border-bolt-elements-borderColor border-opacity-50 z-sidebar shadow-2xl hover:shadow-3xl text-sm backdrop-blur-sm transition-all duration-300',
        effectiveCollapsed ? 'md:w-[60px]' : 'md:w-[260px]',
      )}
    >
      <div className="flex-1 flex flex-col h-full w-full overflow-hidden">
        {/* Header */}
        <div
          className={classNames(
            'py-4 border-b border-bolt-elements-borderColor border-opacity-50',
            effectiveCollapsed ? 'px-2' : 'px-6',
          )}
        >
          <div
            className={classNames(
              'flex items-center mb-6 w-full',
              effectiveCollapsed ? 'justify-center' : 'justify-between',
            )}
          >
            <div
              className={classNames(
                'flex items-center w-full',
                effectiveCollapsed ? 'group relative justify-center' : 'gap-3',
              )}
            >
              {effectiveCollapsed ? (
                <div className="relative w-full flex items-center justify-center">
                  {/* Logo - shows by default when collapsed, hidden on hover */}
                  <div className="w-full flex items-center justify-center group-hover:opacity-0 group-hover:pointer-events-none transition-opacity">
                    <div className="relative w-6 h-6 flex items-center justify-center">
                      <img src="/logo.svg" alt="Logo" className="w-6 h-6" />
                    </div>
                  </div>
                  {/* PanelLeft button - hidden by default when collapsed, shows on hover in same position */}
                  <button
                    onClick={() => {
                      if (isSmallViewport) {
                        sidebarMenuStore.close();
                      } else {
                        const newCollapsed = !isCollapsed;
                        setIsCollapsed(newCollapsed);
                        sidebarMenuStore.setCollapsed(newCollapsed);
                        sidebarMenuStore.open();
                      }
                    }}
                    className="w-full flex items-center justify-center rounded-md hover:bg-bolt-elements-background-depth-1 transition-all opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto absolute inset-0"
                    aria-label={isSmallViewport ? 'Close sidebar' : 'Expand sidebar'}
                  >
                    <PanelLeft size={18} className="text-bolt-elements-textPrimary" />
                  </button>
                </div>
              ) : (
                <div className="w-full flex justify-between items-center">
                  {/* Logo - always visible when expanded */}
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 flex items-center justify-center">
                      <div className="relative w-6 h-6">
                        <img src="/logo.svg" alt="Logo" className="w-6 h-6" />
                      </div>
                    </div>
                    <h1 className="text-bolt-elements-textHeading font-bold text-xl">Replay</h1>
                  </div>
                  {/* PanelLeft button - always visible when expanded */}
                  <button
                    onClick={() => {
                      if (isSmallViewport) {
                        sidebarMenuStore.close();
                      } else {
                        const newCollapsed = !isCollapsed;
                        setIsCollapsed(newCollapsed);
                        sidebarMenuStore.setCollapsed(newCollapsed);
                        sidebarMenuStore.close();
                      }
                    }}
                    className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-bolt-elements-background-depth-1 transition-colors"
                    aria-label={isSmallViewport ? 'Close sidebar' : 'Collapse sidebar'}
                  >
                    <PanelLeft size={20} className="text-bolt-elements-textPrimary" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Menu Items */}
          <div className="space-y-1">
            {/* Home */}
            <TooltipProvider>
              {!effectiveCollapsed ? (
                <a
                  href="/"
                  className={classNames(
                    'w-full flex items-center rounded-md text-bolt-elements-textPrimary transition-colors',
                    effectiveCollapsed ? 'justify-center px-2 py-2' : 'gap-3 px-3 py-2',
                    window.location.pathname === '/' || window.location.pathname === ''
                      ? 'bg-bolt-elements-background-depth-1'
                      : 'hover:bg-bolt-elements-background-depth-1',
                  )}
                  title={effectiveCollapsed ? 'Home' : undefined}
                >
                  <Home size={18} className="text-bolt-elements-textPrimary" />
                  <span className="text-sm font-medium">Home</span>
                </a>
              ) : (
                <WithTooltip tooltip="Home">
                  <a
                    href="/"
                    className={classNames(
                      'w-full flex items-center rounded-md text-bolt-elements-textPrimary transition-colors',
                      effectiveCollapsed ? 'justify-center px-2 py-2' : 'gap-3 px-3 py-2',
                      window.location.pathname === '/' || window.location.pathname === ''
                        ? 'bg-bolt-elements-background-depth-1'
                        : 'hover:bg-bolt-elements-background-depth-1',
                    )}
                    title={effectiveCollapsed ? 'Home' : undefined}
                  >
                    <Home size={18} className="text-bolt-elements-textPrimary" />
                  </a>
                </WithTooltip>
              )}

              {/* New App */}
              {!effectiveCollapsed ? (
                <div
                  onClick={() => {
                    if (isSmallViewport) {
                      sidebarMenuStore.close();
                    } else {
                      setIsCollapsed(true);
                      sidebarMenuStore.setCollapsed(true);
                      sidebarMenuStore.close();
                    }
                    // Trigger focus on message input
                    messageInputFocusStore.triggerFocus();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-md text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-1 transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <Plus size={18} className="text-bolt-elements-textPrimary" />
                    <span className="text-sm font-medium">New App</span>
                  </div>
                  <span className="text-xs text-bolt-elements-textSecondary">Ctrl+N</span>
                </div>
              ) : (
                <WithTooltip tooltip="New App">
                  <div
                    onClick={() => {
                      if (isSmallViewport) {
                        sidebarMenuStore.close();
                      } else {
                        setIsCollapsed(true);
                        sidebarMenuStore.setCollapsed(true);
                        sidebarMenuStore.close();
                      }
                      // Trigger focus on message input
                      messageInputFocusStore.triggerFocus();
                    }}
                    className="w-full flex items-center justify-center px-2 py-2 rounded-md text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-1 transition-colors cursor-pointer"
                    title="New App"
                  >
                    <Plus size={18} className="text-bolt-elements-textPrimary" />
                  </div>
                </WithTooltip>
              )}

              {/* Search - transforms to input when clicked */}
              {!effectiveCollapsed &&
                (!isSearchFocused && !searchValue ? (
                  <button
                    onClick={() => {
                      setIsSearchFocused(true);
                      // Focus the input after state update
                      setTimeout(() => {
                        searchInputRef.current?.focus();
                      }, 0);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-md text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-1 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <Search size={18} className="text-bolt-elements-textPrimary" />
                      <span className="text-sm font-medium">Search</span>
                    </div>
                    <span className="text-xs text-bolt-elements-textSecondary">Ctrl+K</span>
                  </button>
                ) : (
                  <div className="relative w-full">
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-bolt-elements-textTertiary">
                      <Search size={18} />
                    </div>
                    <input
                      ref={searchInputRef}
                      className="w-full bg-bolt-elements-background-depth-1 pl-10 pr-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 placeholder-bolt-elements-textTertiary text-bolt-elements-textPrimary border border-bolt-elements-borderColor border-opacity-50 transition-all duration-200"
                      type="search"
                      placeholder="Search apps..."
                      value={searchValue}
                      onChange={(e) => {
                        setSearchValue(e.target.value);
                        handleSearchChange(e);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          setSearchValue('');
                          handleSearchChange({ target: { value: '' } } as React.ChangeEvent<HTMLInputElement>);
                          searchInputRef.current?.blur();
                          setIsSearchFocused(false);
                        }
                      }}
                      onBlur={() => {
                        // Keep search visible if there's a search term
                        if (!searchValue) {
                          setIsSearchFocused(false);
                        }
                      }}
                      aria-label="Search apps"
                    />
                  </div>
                ))}
              {effectiveCollapsed && (
                <WithTooltip tooltip="Search">
                  <button
                    onClick={() => {
                      if (isSmallViewport) {
                        sidebarMenuStore.close();
                        setIsSearchFocused(true);
                        setTimeout(() => {
                          searchInputRef.current?.focus();
                        }, 0);
                      } else {
                        setIsCollapsed(false);
                        sidebarMenuStore.setCollapsed(false);
                        setIsSearchFocused(true);
                        setTimeout(() => {
                          searchInputRef.current?.focus();
                        }, 0);
                      }
                    }}
                    className="w-full flex items-center justify-center px-2 py-2 rounded-md text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-1 transition-colors"
                    title="Search"
                  >
                    <Search size={18} className="text-bolt-elements-textPrimary" />
                  </button>
                </WithTooltip>
              )}
            </TooltipProvider>
          </div>
        </div>

        {!effectiveCollapsed && (
          <div className="px-6 py-4 border-b border-bolt-elements-borderColor border-opacity-50 bg-bolt-elements-background-depth-1 bg-opacity-50">
            <div className="flex items-center gap-3">
              <Folder className="text-bolt-elements-textSecondary" size={18} />
              <h3 className="text-bolt-elements-textHeading font-semibold">Your Projects</h3>
              {list && list.length > 0 && (
                <span className="ml-auto text-xs text-bolt-elements-textSecondary bg-bolt-elements-background-depth-3 px-2.5 py-1 rounded-lg border border-bolt-elements-borderColor border-opacity-30 font-medium shadow-sm">
                  {list.length}
                </span>
              )}
            </div>
          </div>
        )}
        {effectiveCollapsed && (
          <div className="px-2 py-4 border-b border-bolt-elements-borderColor border-opacity-50 bg-bolt-elements-background-depth-1 bg-opacity-50">
            <div className="flex items-center justify-center">
              <Folder className="text-bolt-elements-textSecondary" size={18} />
            </div>
          </div>
        )}
        {!effectiveCollapsed && (
          <div className="flex-1 overflow-auto px-2 pb-4">
            {filteredList.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center bg-bolt-elements-background-depth-1 bg-opacity-30 rounded-md border border-bolt-elements-borderColor border-opacity-30 mt-2">
                {list === undefined ? (
                  <>
                    <div className="w-10 h-10 border-2 border-bolt-elements-borderColor border-opacity-30 border-t-blue-500 rounded-full animate-spin mb-4 shadow-sm" />
                    <p className="text-bolt-elements-textSecondary text-sm font-medium">Loading apps...</p>
                  </>
                ) : list.length === 0 ? (
                  <>
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-2xl flex items-center justify-center mb-6 border border-blue-500/20 shadow-lg">
                      <FolderOpen className="text-blue-500" size={24} />
                    </div>
                    <p className="text-bolt-elements-textHeading font-semibold mb-2 text-lg">No apps yet</p>
                    <p className="text-bolt-elements-textSecondary text-sm">Create your first app to get started</p>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 bg-gradient-to-br from-orange-500/10 to-yellow-500/10 rounded-2xl flex items-center justify-center mb-6 border border-orange-500/20 shadow-lg">
                      <Search className="text-orange-500" size={24} />
                    </div>
                    <p className="text-bolt-elements-textHeading font-semibold mb-2 text-lg">No matches found</p>
                    <p className="text-bolt-elements-textSecondary text-sm">Try a different search term</p>
                  </>
                )}
              </div>
            )}

            <DialogRoot open={dialogContent !== null}>
              {binDates(filteredList).map(({ category, items }) => (
                <div key={category} className="mb-6 first:mt-0">
                  <div className="text-bolt-elements-textSecondary text-xs font-semibold uppercase tracking-wider sticky top-0 z-10 bg-bolt-elements-background-depth-2 bg-opacity-80 backdrop-blur-sm py-4 mb-4 border-b border-bolt-elements-borderColor border-opacity-20">
                    {category}
                  </div>
                  <div className="space-y-2">
                    {items.map((item) => (
                      <HistoryItem key={item.id} item={item} onDelete={(event) => handleDeleteClick(event, item)} />
                    ))}
                  </div>
                </div>
              ))}
              <Dialog onBackdrop={closeDialog} onClose={closeDialog}>
                {dialogContent?.type === 'delete' && (
                  <>
                    <DialogTitle>Delete App?</DialogTitle>
                    <DialogDescription asChild>
                      <div>
                        <p>
                          You are about to delete <strong>{dialogContent.item.title}</strong>.
                        </p>
                        <p className="mt-1">Are you sure you want to delete this app?</p>
                        <div className="mt-4 flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="skipConfirmDelete"
                            checked={skipConfirmDeleteChecked}
                            onChange={(e) => {
                              setSkipConfirmDeleteChecked(e.target.checked);
                            }}
                          />
                          <label htmlFor="skipConfirmDelete" className="text-sm">
                            Don't ask me again
                          </label>
                        </div>
                      </div>
                    </DialogDescription>
                    <div className="px-5 pb-4 bg-bolt-elements-background-depth-2 flex gap-2 justify-end">
                      <DialogButton type="secondary" onClick={closeDialog}>
                        Cancel
                      </DialogButton>
                      <DialogButton
                        type="danger"
                        onClick={(event) => {
                          deleteItem(event, dialogContent.item);
                          closeDialog();
                          if (skipConfirmDeleteChecked) {
                            Cookies.set(skipConfirmDeleteCookieName, 'true');
                          }
                        }}
                      >
                        Delete
                      </DialogButton>
                    </div>
                  </>
                )}
              </Dialog>
            </DialogRoot>
          </div>
        )}

        <div className={classNames('py-4 mt-auto px-2 relative overflow-visible')}>
          <ClientAuth isSidebarCollapsed={isCollapsed} />
        </div>
      </div>
      <SettingsWindow open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
};
