import { useStore } from '@nanostores/react';
import { motion } from 'framer-motion';
import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import type { UserProfile } from '~/components/@settings/core/types';
import { Card, CardContent } from '~/components/ui/Card';
import { Switch } from '~/components/ui/Switch';
import { getAllChats } from '~/lib/persistence/chats';
import { openDatabase } from '~/lib/persistence/db';
import { setTheme, themeStore } from '~/lib/stores/theme';
import { THEMES } from '~/types/theme';
import { classNames } from '~/utils/classNames';
import { isMac } from '~/utils/os';

// Helper to get modifier key symbols/text
const getModifierSymbol = (modifier: string): string => {
  switch (modifier) {
    case 'meta':
      return isMac ? '⌘' : 'Win';
    case 'alt':
      return isMac ? '⌥' : 'Alt';
    case 'shift':
      return '⇧';
    default:
      return modifier;
  }
};

export default function SettingsTab() {
  const activeTheme = useStore(themeStore);

  const [interfaceOptions, setInterfaceOptions] = useState(() => {
    const saved = JSON.parse(localStorage.getItem('bolt_interface_options') || '{}');
    return {
      accentIntensity: typeof saved.accentIntensity === 'number' ? saved.accentIntensity : 50,
      cornerRadius: ['sharp', 'soft', 'round'].includes(saved.cornerRadius) ? saved.cornerRadius : 'soft',
      compactMode: Boolean(saved.compactMode),
      animatedTransitions: saved.animatedTransitions !== false,
    };
  });

  const [currentTimezone, setCurrentTimezone] = useState('');
  const [chatStats, setChatStats] = useState({ totalChats: 0, totalMessages: 0, averageMessagesPerChat: 0 });

  const [settings, setSettings] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('bolt_user_profile');
    return saved
      ? JSON.parse(saved)
      : {
          notifications: true,
          language: 'en',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
  });

  useEffect(() => {
    setCurrentTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  useEffect(() => {
    localStorage.setItem('bolt_interface_options', JSON.stringify(interfaceOptions));

    const root = document.documentElement;
    root.dataset.accentIntensity = String(interfaceOptions.accentIntensity);
    root.style.setProperty('--interface-accent-strength', `${interfaceOptions.accentIntensity}%`);
    root.dataset.cornerRadius = interfaceOptions.cornerRadius;
    root.dataset.compactMode = String(interfaceOptions.compactMode);
    root.dataset.animatedTransitions = String(interfaceOptions.animatedTransitions);
  }, [interfaceOptions]);

  useEffect(() => {
    let isActive = true;
    let database: IDBDatabase | undefined;

    const loadChatStats = async () => {
      try {
        database = await openDatabase();

        if (!database || !isActive) {
          database?.close();
          return;
        }

        const chats = await getAllChats(database);
        const totalMessages = chats.reduce((total, chat) => total + chat.messages.length, 0);

        if (isActive) {
          setChatStats({
            totalChats: chats.length,
            totalMessages,
            averageMessagesPerChat: chats.length > 0 ? totalMessages / chats.length : 0,
          });
        }
      } catch (error) {
        console.error('Failed to load chat usage statistics:', error);
      } finally {
        database?.close();
      }
    };

    void loadChatStats();

    return () => {
      isActive = false;
      database?.close();
    };
  }, []);

  // Save settings automatically when they change
  useEffect(() => {
    try {
      // Get existing profile data
      const existingProfile = JSON.parse(localStorage.getItem('bolt_user_profile') || '{}');

      // Merge with new settings
      const updatedProfile = {
        ...existingProfile,
        notifications: settings.notifications,
        language: settings.language,
        timezone: settings.timezone,
      };

      localStorage.setItem('bolt_user_profile', JSON.stringify(updatedProfile));
      toast.success('Settings updated');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to update settings');
    }
  }, [settings]);

  return (
    <div className="space-y-4">
      {/* Chat usage summary */}
      <section aria-labelledby="chat-usage-heading">
        <h2 id="chat-usage-heading" className="mb-3 text-sm font-medium text-bolt-elements-textPrimary">
          Chat Usage
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="bg-bolt-elements-background-depth-2">
            <CardContent className="flex items-center gap-3 !p-4">
              <div className="i-ph-chats-duotone h-6 w-6 shrink-0 text-indigo-500 dark:text-indigo-400" />
              <div>
                <p className="text-sm text-bolt-elements-textSecondary">Total Chats</p>
                <p className="text-2xl font-semibold text-bolt-elements-textPrimary">{chatStats.totalChats}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-bolt-elements-background-depth-2">
            <CardContent className="flex items-center gap-3 !p-4">
              <div className="i-ph-chat-text-duotone h-6 w-6 shrink-0 text-pink-500 dark:text-pink-400" />
              <div>
                <p className="text-sm text-bolt-elements-textSecondary">Total Messages</p>
                <p className="text-2xl font-semibold text-bolt-elements-textPrimary">{chatStats.totalMessages}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-bolt-elements-background-depth-2">
            <CardContent className="flex items-center gap-3 !p-4">
              <div className="i-ph-chart-bar-duotone h-6 w-6 shrink-0 text-green-500 dark:text-green-400" />
              <div>
                <p className="text-sm text-bolt-elements-textSecondary">Avg. Messages / Chat</p>
                <p className="text-2xl font-semibold text-bolt-elements-textPrimary">
                  {chatStats.averageMessagesPerChat.toFixed(1)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Language & Notifications */}
      <motion.div
        className="rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 p-4 space-y-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="i-ph:palette-fill w-4 h-4 text-purple-500" />
          <span className="text-sm font-medium text-bolt-elements-textPrimary">Preferences</span>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="i-ph:translate-fill w-4 h-4 text-bolt-elements-textSecondary" />
            <label className="block text-sm text-bolt-elements-textSecondary">Language</label>
          </div>
          <select
            value={settings.language}
            onChange={(e) => setSettings((prev) => ({ ...prev, language: e.target.value }))}
            className={classNames(
              'w-full px-3 py-2 rounded-lg text-sm',
              'bg-bolt-elements-background-depth-2',
              'border border-bolt-elements-borderColor',
              'text-bolt-elements-textPrimary',
              'focus:outline-none focus:ring-2 focus:ring-purple-500/30',
              'transition-all duration-200',
            )}
          >
            <option value="en">English</option>
            <option value="es">Español</option>
            <option value="fr">Français</option>
            <option value="de">Deutsch</option>
            <option value="it">Italiano</option>
            <option value="pt">Português</option>
            <option value="ru">Русский</option>
            <option value="zh">中文</option>
            <option value="ja">日本語</option>
            <option value="ko">한국어</option>
          </select>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="i-ph:bell-fill w-4 h-4 text-bolt-elements-textSecondary" />
            <label className="block text-sm text-bolt-elements-textSecondary">Notifications</label>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-bolt-elements-textSecondary">
              {settings.notifications ? 'Notifications are enabled' : 'Notifications are disabled'}
            </span>
            <Switch
              checked={settings.notifications}
              onCheckedChange={(checked) => {
                // Update local state
                setSettings((prev) => ({ ...prev, notifications: checked }));

                // Update localStorage immediately
                const existingProfile = JSON.parse(localStorage.getItem('bolt_user_profile') || '{}');

                const updatedProfile = {
                  ...existingProfile,
                  notifications: checked,
                };
                localStorage.setItem('bolt_user_profile', JSON.stringify(updatedProfile));

                // Dispatch storage event for other components
                window.dispatchEvent(
                  new StorageEvent('storage', {
                    key: 'bolt_user_profile',
                    newValue: JSON.stringify(updatedProfile),
                  }),
                );

                toast.success(`Notifications ${checked ? 'enabled' : 'disabled'}`);
              }}
            />
          </div>
        </div>
      </motion.div>

      {/* Timezone */}
      <motion.div
        className="rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 p-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="i-ph:clock-fill w-4 h-4 text-purple-500" />
          <span className="text-sm font-medium text-bolt-elements-textPrimary">Time Settings</span>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="i-ph:globe-fill w-4 h-4 text-bolt-elements-textSecondary" />
            <label className="block text-sm text-bolt-elements-textSecondary">Timezone</label>
          </div>
          <select
            value={settings.timezone}
            onChange={(e) => setSettings((prev) => ({ ...prev, timezone: e.target.value }))}
            className={classNames(
              'w-full px-3 py-2 rounded-lg text-sm',
              'bg-bolt-elements-background-depth-2',
              'border border-bolt-elements-borderColor',
              'text-bolt-elements-textPrimary',
              'focus:outline-none focus:ring-2 focus:ring-purple-500/30',
              'transition-all duration-200',
            )}
          >
            <option value={currentTimezone}>{currentTimezone}</option>
          </select>
        </div>
      </motion.div>

      {/* Simplified Keyboard Shortcuts */}
      <motion.div
        className="rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 p-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="i-ph:keyboard-fill w-4 h-4 text-purple-500" />
          <span className="text-sm font-medium text-bolt-elements-textPrimary">Keyboard Shortcuts</span>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between p-2 rounded-lg bg-bolt-elements-background-depth-2">
            <div className="flex flex-col">
              <span className="text-sm text-bolt-elements-textPrimary">Toggle Theme</span>
              <span className="text-xs text-bolt-elements-textSecondary">Switch between light and dark mode</span>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="px-2 py-1 text-xs font-semibold text-bolt-elements-textSecondary bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded shadow-sm">
                {getModifierSymbol('meta')}
              </kbd>
              <kbd className="px-2 py-1 text-xs font-semibold text-bolt-elements-textSecondary bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded shadow-sm">
                {getModifierSymbol('alt')}
              </kbd>
              <kbd className="px-2 py-1 text-xs font-semibold text-bolt-elements-textSecondary bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded shadow-sm">
                {getModifierSymbol('shift')}
              </kbd>
              <kbd className="px-2 py-1 text-xs font-semibold text-bolt-elements-textSecondary bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded shadow-sm">
                D
              </kbd>
            </div>
          </div>
        </div>
      </motion.div>

      <section
        aria-labelledby="appearance-heading"
        className="rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 p-4"
      >
        <div className="mb-4">
          <h2 id="appearance-heading" className="text-sm font-medium text-bolt-elements-textPrimary">
            Appearance
          </h2>
          <p className="mt-1 text-xs text-bolt-elements-textSecondary">
            Choose a light or dark color palette. Your choice is saved on this device.
          </p>
        </div>
        {(['light', 'dark'] as const).map((mode) => (
          <div key={mode} className="mb-4 last:mb-0">
            <h3 className="mb-2 text-xs font-medium capitalize text-bolt-elements-textSecondary">{mode} themes</h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {THEMES.filter((theme) => theme.mode === mode).map((theme) => {
                const selected = activeTheme === theme.id || (activeTheme === 'dark' && theme.id === 'dark-dracula');

                return (
                  <button
                    key={theme.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setTheme(theme.id)}
                    className={`flex min-h-16 items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                      selected
                        ? 'border-bolt-elements-borderColorActive bg-bolt-elements-background-depth-2 ring-1 ring-bolt-elements-borderColorActive'
                        : 'border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 hover:bg-bolt-elements-background-depth-2'
                    }`}
                  >
                    <span className="flex h-8 w-8 shrink-0 overflow-hidden rounded-md border border-black/10 dark:border-white/10">
                      {theme.colors.map((color) => (
                        <span key={color} className="h-full flex-1" style={{ backgroundColor: color }} />
                      ))}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-bolt-elements-textPrimary">{theme.name}</span>
                      <span className="block text-xs text-bolt-elements-textSecondary">
                        {selected ? 'Selected' : 'Select theme'}
                      </span>
                    </span>
                    {selected && (
                      <span
                        aria-hidden="true"
                        className="i-ph-check-circle-fill ml-auto text-lg text-bolt-elements-borderColorActive"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </section>
      <section
        aria-labelledby="interface-heading"
        className="rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 p-4"
      >
        <div className="mb-3 flex items-center gap-2">
          <span className="i-ph:palette text-bolt-elements-borderColorActive" aria-hidden="true" />
          <h2 id="interface-heading" className="text-sm font-medium text-bolt-elements-textPrimary">
            Interface
          </h2>
          <span className="rounded-full bg-purple-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-purple-500">
            NEW
          </span>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="rounded-lg bg-bolt-elements-background-depth-2 p-3">
            <span className="flex justify-between text-xs font-medium text-bolt-elements-textPrimary">
              <span>Accent intensity</span>
              <span>{interfaceOptions.accentIntensity}%</span>
            </span>
            <span className="mt-1 flex items-center gap-3">
              <span className="text-[11px] text-bolt-elements-textSecondary">Low</span>
              <input
                aria-label="Accent intensity"
                type="range"
                min="0"
                max="100"
                value={interfaceOptions.accentIntensity}
                onChange={(event) =>
                  setInterfaceOptions({ ...interfaceOptions, accentIntensity: Number(event.target.value) })
                }
                className="w-full accent-bolt-elements-borderColorActive"
              />
              <span className="text-[11px] text-bolt-elements-textSecondary">High</span>
            </span>
          </label>
          <div className="flex items-center justify-between rounded-lg bg-bolt-elements-background-depth-2 p-3">
            <div>
              <div className="text-xs font-medium text-bolt-elements-textPrimary">Corner radius</div>
              <div className="text-[11px] text-bolt-elements-textSecondary">Sharp, soft or round</div>
            </div>
            <div
              className="flex rounded-md bg-bolt-elements-background-depth-1 p-0.5"
              role="group"
              aria-label="Corner radius"
            >
              {(['sharp', 'soft', 'round'] as const).map((radius) => (
                <button
                  key={radius}
                  type="button"
                  aria-pressed={interfaceOptions.cornerRadius === radius}
                  onClick={() => setInterfaceOptions({ ...interfaceOptions, cornerRadius: radius })}
                  className={`px-2 py-1 text-[11px] capitalize ${interfaceOptions.cornerRadius === radius ? 'bg-purple-500/20 text-purple-500' : 'text-bolt-elements-textSecondary'}`}
                >
                  {radius}
                </button>
              ))}
            </div>
          </div>
          {(
            [
              ['compactMode', 'Compact mode', 'Tighter spacing in lists'],
              ['animatedTransitions', 'Animated transitions', 'Smooth theme switching'],
            ] as const
          ).map(([key, title, description]) => (
            <label
              key={key}
              className="flex cursor-pointer items-center justify-between rounded-lg bg-bolt-elements-background-depth-2 p-3"
            >
              <span>
                <span className="block text-xs font-medium text-bolt-elements-textPrimary">{title}</span>
                <span className="text-[11px] text-bolt-elements-textSecondary">{description}</span>
              </span>
              <input
                type="checkbox"
                checked={interfaceOptions[key]}
                onChange={(event) => setInterfaceOptions({ ...interfaceOptions, [key]: event.target.checked })}
                className="h-4 w-4 accent-bolt-elements-borderColorActive"
              />
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}
