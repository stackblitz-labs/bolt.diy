import { memo, useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Switch from '@radix-ui/react-switch';
import * as Slider from '@radix-ui/react-slider';
import { classNames } from '~/utils/classNames';
import { motion, AnimatePresence } from 'framer-motion';

interface AutoSaveSettingsProps {
  onSettingsChange?: (settings: AutoSaveConfig) => void;
  trigger?: React.ReactNode;
}

export interface AutoSaveConfig {
  enabled: boolean;
  interval: number; // in seconds
  minChanges: number;
  saveOnBlur: boolean;
  saveBeforeRun: boolean;
  showNotifications: boolean;
}

const DEFAULT_CONFIG: AutoSaveConfig = {
  enabled: false,
  interval: 30,
  minChanges: 1,
  saveOnBlur: true,
  saveBeforeRun: true,
  showNotifications: true,
};

const PRESET_INTERVALS = [
  { label: '10s', value: 10 },
  { label: '30s', value: 30 },
  { label: '1m', value: 60 },
  { label: '2m', value: 120 },
  { label: '5m', value: 300 },
];

export const AutoSaveSettings = memo(({ onSettingsChange, trigger }: AutoSaveSettingsProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<AutoSaveConfig>(() => {
    // Load from localStorage if available
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('bolt-autosave-config');

      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // Invalid JSON, use defaults
        }
      }
    }

    return DEFAULT_CONFIG;
  });

  // Save to localStorage whenever config changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('bolt-autosave-config', JSON.stringify(config));
    }

    onSettingsChange?.(config);
  }, [config, onSettingsChange]);

  const updateConfig = <K extends keyof AutoSaveConfig>(key: K, value: AutoSaveConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <Dialog.Trigger asChild>
        {trigger || (
          <button className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-background-depth-3 text-bolt-elements-textPrimary transition-colors">
            <div className="i-ph:gear-duotone" />
            <span className="text-sm">Auto-save Settings</span>
          </button>
        )}
      </Dialog.Trigger>

      <AnimatePresence>
        {isOpen && (
          <Dialog.Portal>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
              />
            </Dialog.Overlay>

            <Dialog.Content asChild>
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md"
              >
                <div className="bg-bolt-elements-background-depth-1 rounded-xl shadow-2xl border border-bolt-elements-borderColor">
                  {/* Header */}
                  <div className="flex items-center justify-between p-6 border-b border-bolt-elements-borderColor">
                    <Dialog.Title className="text-lg font-semibold text-bolt-elements-textPrimary">
                      Auto-save Settings
                    </Dialog.Title>
                    <Dialog.Close className="p-1 rounded-lg hover:bg-bolt-elements-background-depth-2 transition-colors">
                      <div className="i-ph:x text-xl text-bolt-elements-textTertiary" />
                    </Dialog.Close>
                  </div>

                  {/* Content */}
                  <div className="p-6 space-y-6">
                    {/* Enable/Disable Auto-save */}
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium text-bolt-elements-textPrimary">Enable Auto-save</label>
                        <p className="text-xs text-bolt-elements-textTertiary mt-1">
                          Automatically save files at regular intervals
                        </p>
                      </div>
                      <Switch.Root
                        checked={config.enabled}
                        onCheckedChange={(checked) => updateConfig('enabled', checked)}
                        className={classNames(
                          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                          config.enabled ? 'bg-accent-500' : 'bg-bolt-elements-background-depth-3',
                        )}
                      >
                        <Switch.Thumb className="block h-4 w-4 translate-x-1 rounded-full bg-white transition-transform data-[state=checked]:translate-x-6" />
                      </Switch.Root>
                    </div>

                    {/* Save Interval */}
                    <div
                      className={classNames(
                        'space-y-3 transition-opacity',
                        !config.enabled ? 'opacity-50 pointer-events-none' : '',
                      )}
                    >
                      <div>
                        <label className="text-sm font-medium text-bolt-elements-textPrimary">
                          Save Interval: {config.interval}s
                        </label>
                        <p className="text-xs text-bolt-elements-textTertiary mt-1">How often to save changes</p>
                      </div>

                      <Slider.Root
                        value={[config.interval]}
                        onValueChange={([value]) => updateConfig('interval', value)}
                        min={5}
                        max={300}
                        step={5}
                        className="relative flex items-center select-none touch-none w-full h-5"
                      >
                        <Slider.Track className="bg-bolt-elements-background-depth-3 relative grow rounded-full h-1">
                          <Slider.Range className="absolute bg-accent-500 rounded-full h-full" />
                        </Slider.Track>
                        <Slider.Thumb className="block w-4 h-4 bg-white rounded-full shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-accent-500" />
                      </Slider.Root>

                      {/* Preset buttons */}
                      <div className="flex gap-2">
                        {PRESET_INTERVALS.map((preset) => (
                          <button
                            key={preset.value}
                            onClick={() => updateConfig('interval', preset.value)}
                            className={classNames(
                              'px-2 py-1 text-xs rounded-md transition-colors',
                              config.interval === preset.value
                                ? 'bg-accent-500 text-white'
                                : 'bg-bolt-elements-background-depth-2 text-bolt-elements-textTertiary hover:bg-bolt-elements-background-depth-3',
                            )}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Minimum Changes */}
                    <div
                      className={classNames(
                        'space-y-3 transition-opacity',
                        !config.enabled ? 'opacity-50 pointer-events-none' : '',
                      )}
                    >
                      <div>
                        <label className="text-sm font-medium text-bolt-elements-textPrimary">
                          Minimum Changes: {config.minChanges}
                        </label>
                        <p className="text-xs text-bolt-elements-textTertiary mt-1">
                          Minimum number of files to trigger auto-save
                        </p>
                      </div>

                      <Slider.Root
                        value={[config.minChanges]}
                        onValueChange={([value]) => updateConfig('minChanges', value)}
                        min={1}
                        max={10}
                        step={1}
                        className="relative flex items-center select-none touch-none w-full h-5"
                      >
                        <Slider.Track className="bg-bolt-elements-background-depth-3 relative grow rounded-full h-1">
                          <Slider.Range className="absolute bg-accent-500 rounded-full h-full" />
                        </Slider.Track>
                        <Slider.Thumb className="block w-4 h-4 bg-white rounded-full shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-accent-500" />
                      </Slider.Root>
                    </div>

                    {/* Additional Options */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-sm font-medium text-bolt-elements-textPrimary">
                            Save on Tab Switch
                          </label>
                          <p className="text-xs text-bolt-elements-textTertiary mt-1">
                            Save when switching to another tab
                          </p>
                        </div>
                        <Switch.Root
                          checked={config.saveOnBlur}
                          onCheckedChange={(checked) => updateConfig('saveOnBlur', checked)}
                          className={classNames(
                            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                            config.saveOnBlur ? 'bg-accent-500' : 'bg-bolt-elements-background-depth-3',
                          )}
                        >
                          <Switch.Thumb className="block h-4 w-4 translate-x-1 rounded-full bg-white transition-transform data-[state=checked]:translate-x-6" />
                        </Switch.Root>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-sm font-medium text-bolt-elements-textPrimary">Save Before Run</label>
                          <p className="text-xs text-bolt-elements-textTertiary mt-1">
                            Save all files before running commands
                          </p>
                        </div>
                        <Switch.Root
                          checked={config.saveBeforeRun}
                          onCheckedChange={(checked) => updateConfig('saveBeforeRun', checked)}
                          className={classNames(
                            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                            config.saveBeforeRun ? 'bg-accent-500' : 'bg-bolt-elements-background-depth-3',
                          )}
                        >
                          <Switch.Thumb className="block h-4 w-4 translate-x-1 rounded-full bg-white transition-transform data-[state=checked]:translate-x-6" />
                        </Switch.Root>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-sm font-medium text-bolt-elements-textPrimary">
                            Show Notifications
                          </label>
                          <p className="text-xs text-bolt-elements-textTertiary mt-1">
                            Display toast notifications on save
                          </p>
                        </div>
                        <Switch.Root
                          checked={config.showNotifications}
                          onCheckedChange={(checked) => updateConfig('showNotifications', checked)}
                          className={classNames(
                            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                            config.showNotifications ? 'bg-accent-500' : 'bg-bolt-elements-background-depth-3',
                          )}
                        >
                          <Switch.Thumb className="block h-4 w-4 translate-x-1 rounded-full bg-white transition-transform data-[state=checked]:translate-x-6" />
                        </Switch.Root>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between p-6 border-t border-bolt-elements-borderColor">
                    <button
                      onClick={() => setConfig(DEFAULT_CONFIG)}
                      className="px-4 py-2 text-sm text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary transition-colors"
                    >
                      Reset to Defaults
                    </button>
                    <Dialog.Close className="px-4 py-2 text-sm bg-accent-500 text-white rounded-lg hover:bg-accent-600 transition-colors">
                      Done
                    </Dialog.Close>
                  </div>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
});

AutoSaveSettings.displayName = 'AutoSaveSettings';
