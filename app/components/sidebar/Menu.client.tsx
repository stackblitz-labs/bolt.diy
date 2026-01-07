import { motion, type Variants } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { Dialog, DialogButton, DialogDescription, DialogRoot, DialogTitle } from '~/components/ui/Dialog';
import { SettingsWindow } from '~/components/settings/SettingsWindow';
//import { SettingsButton } from '~/components/ui/SettingsButton';
import { database, type AppLibraryEntry } from '~/lib/persistence/apps';
import { chatStore } from '~/lib/stores/chat';
import { cubicEasingFn } from '~/utils/easings';
import { logger } from '~/utils/logger';
import { HistoryItem } from './HistoryItem';
import { binDates } from './date-binning';
import { useSearchFilter } from '~/lib/hooks/useSearchFilter';
import Cookies from 'js-cookie';
import Feedback from './Feedback/FeedbackButton';
import { useStore } from '@nanostores/react';
import { sidebarMenuStore } from '~/lib/stores/sidebarMenu';
import useViewport from '~/lib/hooks';
import { X, Plus, Search, Folder, FolderOpen } from '~/components/ui/Icon';

const menuVariants = {
  closed: {
    opacity: 0,
    visibility: 'hidden',
    left: '-150px',
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
  open: {
    opacity: 1,
    visibility: 'initial',
    left: 0,
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
} satisfies Variants;

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
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isSmallViewport) {
      return undefined;
    }

    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;

    const handleTouchStart = (event: TouchEvent) => {
      touchStartX = event.changedTouches[0].screenX;
      touchStartY = event.changedTouches[0].screenY;
    };

    const handleTouchEnd = (event: TouchEvent) => {
      touchEndX = event.changedTouches[0].screenX;
      touchEndY = event.changedTouches[0].screenY;

      const deltaX = touchEndX - touchStartX;
      const deltaY = touchEndY - touchStartY;
      const minSwipeDistance = 50;
      const maxVerticalDistance = 50;

      if (Math.abs(deltaY) > maxVerticalDistance) {
        return;
      }

      if (deltaX > minSwipeDistance && !isOpen) {
        sidebarMenuStore.open();
      }

      if (deltaX < -minSwipeDistance && isOpen) {
        sidebarMenuStore.close();
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isSmallViewport, isOpen]);

  useEffect(() => {
    if (isSmallViewport) {
      return undefined;
    }

    const enterThreshold = 40;
    const exitThreshold = 40;

    function onMouseMove(event: MouseEvent) {
      if (event.pageX < enterThreshold) {
        sidebarMenuStore.open();
      }

      if (menuRef.current && event.clientX > menuRef.current.getBoundingClientRect().right + exitThreshold) {
        sidebarMenuStore.close();
      }
    }

    window.addEventListener('mousemove', onMouseMove);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, [isSmallViewport, isOpen]);

  const handleDeleteClick = (event: React.UIEvent, item: AppLibraryEntry) => {
    event.preventDefault();

    const skipConfirmDelete = Cookies.get(skipConfirmDeleteCookieName);

    if (skipConfirmDelete === 'true') {
      deleteItem(event, item);
    } else {
      setDialogContent({ type: 'delete', item });
    }
  };

  return (
    <motion.div
      ref={menuRef}
      initial="closed"
      animate={isOpen ? 'open' : 'closed'}
      variants={menuVariants}
      className="flex selection-accent flex-col side-menu fixed top-0 w-full md:w-[350px] h-full bg-bolt-elements-background-depth-2 border-r md:rounded-r-3xl border-bolt-elements-borderColor border-opacity-50 z-sidebar shadow-2xl hover:shadow-3xl text-sm backdrop-blur-sm transition-shadow duration-300"
    >
      <div className="md:hidden flex justify-end p-4">
        <button
          onClick={() => sidebarMenuStore.close()}
          className="w-10 h-10 rounded-xl bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor hover:bg-bolt-elements-background-depth-1 transition-all duration-200 flex items-center justify-center text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary shadow-sm hover:shadow-md hover:scale-105 group"
        >
          <X className="transition-transform duration-200 group-hover:scale-110" size={18} />
        </button>
      </div>

      <div className="h-[55px] md:block hidden" />
      <div className="flex-1 flex flex-col h-full w-full overflow-hidden">
        <div className="px-6 py-4 border-b border-bolt-elements-borderColor border-opacity-50">
          <div className="flex items-center gap-3 mb-6">
            {/* <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-bolt-elements-borderColor border-opacity-50 p-1.5 bg-gradient-to-br from-blue-500/10 to-green-500/10 shadow-sm">
              <img src="/logo-styled.svg" alt="Replay Builder" className="w-full h-full" />
            </div> */}
            <h1 className="text-bolt-elements-textHeading font-bold text-xl">Replay Builder</h1>
          </div>

          <div className="space-y-2">
            <a
              href="/"
              className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:from-blue-600 hover:to-indigo-600 rounded-xl px-4 py-3 transition-all duration-200 text-sm font-semibold shadow-lg hover:shadow-xl hover:scale-[1.02] border border-white/20 hover:border-white/30 group"
            >
              <Plus className="transition-transform duration-200 group-hover:scale-110" size={18} />
              <span className="transition-transform duration-200 group-hover:scale-105">New App</span>
            </a>
          </div>
        </div>

        <div className="px-6 py-4 border-b border-bolt-elements-borderColor border-opacity-50">
          <div className="relative group">
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-bolt-elements-textTertiary group-focus-within:text-blue-500 transition-colors duration-200">
              <Search size={18} />
            </div>
            <input
              className="w-full bg-bolt-elements-background-depth-3 pl-10 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 placeholder-bolt-elements-textTertiary text-bolt-elements-textPrimary border border-bolt-elements-borderColor border-opacity-50 transition-all duration-200 shadow-sm focus:shadow-md hover:shadow-sm"
              type="search"
              placeholder="Search apps..."
              onChange={handleSearchChange}
              aria-label="Search apps"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-b border-bolt-elements-borderColor border-opacity-50 bg-bolt-elements-background-depth-1 bg-opacity-50">
          <div className="flex items-center gap-3">
            <Folder className="text-bolt-elements-textSecondary" size={18} />
            <h3 className="text-bolt-elements-textHeading font-semibold">Your Apps</h3>
            {list && list.length > 0 && (
              <span className="ml-auto text-xs text-bolt-elements-textSecondary bg-bolt-elements-background-depth-3 px-2.5 py-1 rounded-lg border border-bolt-elements-borderColor border-opacity-30 font-medium shadow-sm">
                {list.length}
              </span>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-auto px-6 pb-4">
          {filteredList.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center bg-bolt-elements-background-depth-1 bg-opacity-30 rounded-xl mx-2 border border-bolt-elements-borderColor border-opacity-30 mt-4">
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

        <div className="border-t border-bolt-elements-borderColor border-opacity-50 bg-bolt-elements-background-depth-1 bg-opacity-50 backdrop-blur-sm px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* For now settings are disabled as we don't have any <SettingsButton onClick={() => setIsSettingsOpen(true)} /> */}
              {/* <div className="h-6 w-px bg-bolt-elements-borderColor/50" /> */}
              <Feedback />
            </div>
          </div>
        </div>
      </div>
      <SettingsWindow open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </motion.div>
  );
};
