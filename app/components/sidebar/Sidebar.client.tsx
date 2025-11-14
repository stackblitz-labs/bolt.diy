'use client';

import { useState, useEffect, useCallback } from 'react';

import { Button } from '~/components/ui/button';

import { MessageSquare, Trash2, PenLine, LogIn } from '~/components/ui/Icon';

import { ScrollArea } from '~/components/ui/scroll-area';

import { database, type AppLibraryEntry } from '~/lib/persistence/apps';

import { binDates } from '~/components/sidebar/date-binning';

import { chatStore } from '~/lib/stores/chat';

import { useStore } from '@nanostores/react';

import { toast } from 'react-toastify';

import { NutLogo } from './NutLogo';

import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '~/components/ui/context-menu';

import { useEditAppTitle } from '~/lib/hooks/useEditAppTitle';

import { userStore } from '~/lib/stores/auth';

import { authModalStore } from '~/lib/stores/authModal';

import { UserProfileMenu } from '~/components/header/UserProfileMenu';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

interface AppItemProps {
  item: AppLibraryEntry;
  isActive: boolean;
  onDelete: () => void;
}

function AppItem({ item, isActive, onDelete }: AppItemProps) {
  const { editing, handleChange, handleBlur, handleSubmit, handleKeyDown, currentTitle, toggleEditMode } =
    useEditAppTitle({
      initialTitle: item.title,
      customAppId: item.id,
    });

  if (editing) {
    return (
      <div className="px-2">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            type="text"
            className="flex-1 bg-bolt-elements-background-depth-1 text-bolt-elements-textPrimary rounded-md px-2 py-1.5 text-sm border border-bolt-elements-borderColor focus:ring-2 focus:ring-bolt-elements-focus focus:outline-none"
            autoFocus
            value={currentTitle}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
          />
        </form>
      </div>
    );
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <a
          href={`/app/${item.id}`}
          className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
            isActive
              ? 'bg-bolt-elements-background-depth-3 text-bolt-elements-textPrimary'
              : 'text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-2 hover:text-bolt-elements-textPrimary'
          }`}
        >
          <MessageSquare size={16} className="flex-shrink-0" />
          <span className="flex-1 truncate">{item.title}</span>
        </a>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem
          onClick={(e) => {
            e.preventDefault();
            toggleEditMode();
          }}
          className="gap-2"
        >
          <PenLine size={16} />
          <span>Rename</span>
        </ContextMenuItem>
        <ContextMenuItem
          onClick={(e) => {
            e.preventDefault();
            onDelete();
          }}
          className="gap-2 text-destructive focus:text-destructive"
        >
          <Trash2 size={16} />
          <span>Delete</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const [list, setList] = useState<AppLibraryEntry[] | undefined>(undefined);
  const currentAppId = useStore(chatStore.currentAppId);
  const user = useStore(userStore);

  const handleLoginClick = () => {
    authModalStore.open(false);
  };

  const loadEntries = useCallback(() => {
    database
      .getAllAppEntries()
      .then(setList)
      .catch((error) => toast.error(error.message));
  }, []);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const handleDelete = useCallback((itemId: string) => {
    if (!window.confirm('Are you sure you want to delete this app?')) {
      return;
    }

    database
      .deleteApp(itemId)
      .then(() => {
        setList((prev) => prev?.filter((app) => app.id !== itemId));
        if (chatStore.currentAppId.get() === itemId) {
          window.location.pathname = '/';
        }
        toast.success('App deleted');
      })
      .catch((error) => {
        toast.error('Failed to delete app');
        console.error(error);
      });
  }, []);

  return (
    <div
      className={`absolute left-2 top-2 bottom-2 z-50 flex flex-col rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 shadow-2xl transition-all duration-300 ${
        isOpen ? 'w-64 translate-x-0' : 'w-64 -translate-x-[calc(100%+0.5rem)]'
      }`}
    >
      {/* Header */}
      <div className="flex flex-col gap-3 p-3 border-b border-bolt-elements-borderColor">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <NutLogo />
            <span className="font-semibold text-bolt-elements-textPrimary">Nut</span>
          </div>
          {user ? (
            <UserProfileMenu />
          ) : (
            <Button onClick={handleLoginClick} variant="ghost" size="sm" className="h-8 px-3 text-xs">
              <LogIn size={14} className="mr-1" />
              Login
            </Button>
          )}
        </div>
      </div>

      {/* Navigation Items */}
      <ScrollArea className="flex-1 px-2 py-3">
        {list === undefined ? (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-8 h-8 border-2 border-bolt-elements-borderColor border-t-bolt-elements-textPrimary rounded-full animate-spin" />
            <p className="text-sm text-bolt-elements-textSecondary mt-2">Loading...</p>
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center px-4">
            <MessageSquare size={32} className="text-bolt-elements-textSecondary mb-2" />
            <p className="text-sm font-medium text-bolt-elements-textPrimary">No apps yet</p>
            <p className="text-xs text-bolt-elements-textSecondary mt-1">Create your first app</p>
          </div>
        ) : (
          <div className="space-y-4">
            {binDates(list).map(({ category, items }) => (
              <div key={category}>
                <p className="px-3 mb-2 text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider">
                  {category}
                </p>
                <div className="space-y-1">
                  {items.map((item) => (
                    <AppItem
                      key={item.id}
                      item={item}
                      isActive={currentAppId === item.id}
                      onDelete={() => handleDelete(item.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
